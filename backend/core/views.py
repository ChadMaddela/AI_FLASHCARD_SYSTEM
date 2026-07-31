import logging
import os
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import Material, Flashcard, StudentPerformance, User, ConfidenceRating, QuizSession, QuizAttempt, QuizAnswer
from .spacing_engine import process_student_response, get_next_cards_for_student
from .serializers import (
    UserSerializer, FlashcardSerializer, MaterialSerializer, MaterialCreateSerializer,
    RegisterSerializer, AdminUserSerializer, QuizSessionSerializer, QuizAttemptSerializer,
)
from .tasks import generate_flashcards_task
from . import analytics
from . import reports
from . import pdf_reports
from django.http import HttpResponse
from .storage import upload_bytes_and_get_url, delete_object, path_from_public_url
from .file_extraction import extract_text_from_file
import uuid

logger = logging.getLogger(__name__)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_card_queue(request, material_id):
    """Retrieve up to 10 cards for review based on mastery tracking and an optional sub-topic filter."""
    material = get_object_or_404(Material, id=material_id)
    student = request.user
    
    # 🎛️ Extract sub_topic filter from request query string
    sub_topic_filter = request.query_params.get("sub_topic", None)

    # Cards due for review (or never-seen) via the SM-2 scheduling engine.
    # An empty result correctly means "nothing due right now" — no plain fallback here,
    # since showing not-yet-due cards would defeat the point of spaced repetition.
    selected_cards = get_next_cards_for_student(student, material=material, sub_topic=sub_topic_filter, limit=10)

    payload = []
    for c in selected_cards:
        perf = StudentPerformance.objects.filter(student=student, flashcard=c).first()
        item = {
            "id": c.id,
            "card_type": c.card_type,
            "question": c.question,
            "sub_topic": c.sub_topic,
            "image_url": c.image_url,
            "current_mastery_level": perf.mastery_level if perf else 0,
            "due_date": perf.due_date.isoformat() if perf else None,
        }
        if c.card_type == Flashcard.CARD_TYPE_MCQ:
            item["choices"] = {
                "A": c.choice_a,
                "B": c.choice_b,
                "C": c.choice_c,
                "D": c.choice_d
            }
        else:
            item["answer"] = c.answer
        payload.append(item)

    # 🗂️ Pull unique string tags directly from the material to populate navigation pills dynamically
    all_sub_topics = list(
        Flashcard.objects.filter(material=material)
        .values_list("sub_topic", flat=True)
        .distinct()
    )
    # Clean up empty strings or null entries safely
    all_sub_topics = [topic for topic in all_sub_topics if topic]

    return Response({
        "queue": payload,
        "available_topics": all_sub_topics
    }, status=status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def teacher_upload_material(request):
    """Teachers upload lecture materials (text or file) → Gemini generates flashcards."""
    if request.user.role != "TEACHER":
        return Response({"error": "Unauthorized. Only teachers can upload materials."}, 
                        status=status.HTTP_403_FORBIDDEN)

    title = request.data.get("title")
    content_text = request.data.get("content")
    uploaded_file = request.FILES.get("file")

    generation_mode = (request.data.get("generation_mode") or Flashcard.CARD_TYPE_MCQ).upper()
    if generation_mode not in (Flashcard.CARD_TYPE_MCQ, Flashcard.CARD_TYPE_BASIC, Flashcard.CARD_TYPE_CLOZE):
        generation_mode = Flashcard.CARD_TYPE_MCQ

    if not title and not uploaded_file:
        return Response({"error": "Provide either 'title' + 'content' or upload a file."},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        if uploaded_file:
            content_text = extract_text_from_file(uploaded_file)

        if not content_text or not content_text.strip():
            return Response({"error": "No text could be extracted from the file/content input."},
                            status=status.HTTP_400_BAD_REQUEST)

        # 1. Save base metadata record to database
        material = Material.objects.create(
            title=title or uploaded_file.name,
            description=f"Uploaded material processed. Size: {len(content_text)} chars.",
            content_text=content_text,
            uploaded_by=request.user
        )

        if uploaded_file:
            uploaded_file.seek(0)
            raw_file_bytes = uploaded_file.read()

            file_ext = os.path.splitext(uploaded_file.name)[1].lower()
            supabase_storage_path = f"materials/material_{material.id}{file_ext}"

            # 2. Upload file to storage (Will bypass RLS cleanly using the Service Role Key!)
            material.file_url = upload_bytes_and_get_url(
                "materials", supabase_storage_path, raw_file_bytes,
                getattr(uploaded_file, "content_type", "application/octet-stream")
            )
            material.save(update_fields=["file_url"])

        # 3. Dispatch flashcard generation (Gemini call) to a background Celery task —
        #    this is the slow step (15-30s+), so the request returns immediately instead
        #    of blocking on it.
        material.generation_status = Material.STATUS_PROCESSING
        material.save(update_fields=["generation_status"])

        generate_flashcards_task.delay(material.id, generation_mode)

        return Response({
            "message": "Material uploaded. Flashcards are generating in the background.",
            "material_id": material.id,
            "file_url": material.file_url,
            "generation_status": material.generation_status,
        }, status=status.HTTP_202_ACCEPTED)

    except Exception as e:
        logger.exception("Failed to process upload")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_answer(request):
    """Process a student's response (MCQ choice or self-graded recall rating) → reschedule + analytics."""
    flashcard_id = request.data.get("flashcard_id")
    selected_choice = request.data.get("selected_choice")
    grade = request.data.get("grade")
    confidence = request.data.get("confidence")

    if not flashcard_id:
        return Response({"error": "Field 'flashcard_id' is required."},
                        status=status.HTTP_400_BAD_REQUEST)

    if confidence and confidence not in dict(ConfidenceRating.CONFIDENCE_CHOICES):
        return Response({"error": "Field 'confidence' must be one of GUESSING/UNSURE/CONFIDENT."},
                        status=status.HTTP_400_BAD_REQUEST)

    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    student = request.user

    if flashcard.card_type == Flashcard.CARD_TYPE_MCQ:
        if not selected_choice:
            return Response({"error": "Field 'selected_choice' is required for MCQ cards."},
                            status=status.HTTP_400_BAD_REQUEST)
        perf = process_student_response(student, flashcard, selected_choice=selected_choice)
    else:
        if (grade or "").lower() not in ("again", "hard", "good", "easy"):
            return Response({"error": "Field 'grade' must be one of again/hard/good/easy for recall cards."},
                            status=status.HTTP_400_BAD_REQUEST)
        perf = process_student_response(student, flashcard, grade=grade.lower())

    if confidence:
        ConfidenceRating.objects.create(
            student=student, flashcard=flashcard, confidence=confidence, is_correct=perf.is_correct
        )

    body = {
        "card_type": flashcard.card_type,
        "analytics": {
            "updated_mastery_level": perf.mastery_level,
            "total_attempts": perf.attempts_count,
            "accuracy_percentage": perf.accuracy_percentage,
            "sub_topic_tracked": flashcard.sub_topic,
            "due_date": perf.due_date.isoformat(),
            "interval_days": perf.interval_days,
            "ease_factor": perf.ease_factor,
        }
    }

    if flashcard.card_type == Flashcard.CARD_TYPE_MCQ:
        body["is_correct"] = perf.is_correct
        body["correct_answer"] = flashcard.correct_choice
    else:
        body["answer"] = flashcard.answer

    return Response(body, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_me(request):
    """Return full info about the currently authenticated user, including their role."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


@api_view(["POST"])
@permission_classes([AllowAny])
def register_user(request):
    """Public self-registration. New accounts are always created with role=STUDENT."""
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response({"message": "Registration successful."}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    """List all user accounts (teacher-only) for the admin user-management page."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    users = User.objects.all().order_by("username")
    return Response(AdminUserSerializer(users, many=True).data)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_user(request, user_id):
    """Edit a user's details/credentials and role (teacher-only)."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    target = get_object_or_404(User, id=user_id)
    serializer = AdminUserSerializer(target, data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_analytics(request):
    """The calling user's own learning analytics (accuracy, mastery distribution, per-topic breakdown)."""
    return Response(analytics.compute_student_analytics(request.user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def students_analytics_summary(request):
    """One summary row per student (teacher-only) for the analytics student picker."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    return Response(analytics.compute_all_students_summary())


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_analytics_detail(request, user_id):
    """A single student's full analytics breakdown (teacher-only)."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    student = get_object_or_404(User, id=user_id, role=User.ROLE_STUDENT)
    return Response(analytics.compute_student_analytics(student))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def class_analytics(request):
    """Class-wide aggregate analytics across all students (teacher-only)."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    return Response(analytics.compute_class_analytics())


def _pdf_response(pdf_bytes, filename):
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def class_analytics_pdf(request):
    """Class-wide analytics as a downloadable PDF (teacher-only)."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    pdf_bytes = pdf_reports.render_class_analytics_pdf(analytics.compute_class_analytics())
    return _pdf_response(pdf_bytes, "class_analytics.pdf")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_analytics_pdf(request, user_id):
    """A single student's analytics as a downloadable PDF (teacher-only)."""
    if request.user.role != User.ROLE_TEACHER:
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    student = get_object_or_404(User, id=user_id, role=User.ROLE_STUDENT)
    pdf_bytes = pdf_reports.render_student_analytics_pdf(student, analytics.compute_student_analytics(student))
    return _pdf_response(pdf_bytes, f"student_analytics_{student.username}.pdf")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_flashcards(request):
    """List all flashcards (teacher view)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
        
    flashcards = Flashcard.objects.all().order_by("-id")
    serializer = FlashcardSerializer(flashcards, many=True)
    return Response({"flashcards": serializer.data}, status=status.HTTP_200_OK)


def _best_effort_delete_flashcard_image(image_url):
    """Mirrors delete_material's storage cleanup pattern — never let a storage hiccup block the request."""
    if not image_url:
        return
    try:
        delete_object("materials", path_from_public_url("materials", image_url))
    except Exception as bucket_err:
        logger.warning(f"Flashcard image storage drop warning: {str(bucket_err)}")


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def update_flashcard(request, flashcard_id):
    """Update a flashcard (teacher edit) — optionally replacing or removing its image."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    serializer = FlashcardSerializer(flashcard, data=request.data, partial=True)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES.get("image")
    remove_image = str(request.data.get("remove_image", "")).lower() == "true"
    extra = {}

    if image_file:
        ext = os.path.splitext(image_file.name)[1].lower() or ".jpg"
        path = f"flashcard_images/flashcard_{flashcard.id}_{uuid.uuid4().hex}{ext}"
        extra["image_url"] = upload_bytes_and_get_url(
            "materials", path, image_file.read(), getattr(image_file, "content_type", "image/jpeg")
        )
        _best_effort_delete_flashcard_image(flashcard.image_url)
    elif remove_image:
        _best_effort_delete_flashcard_image(flashcard.image_url)
        extra["image_url"] = None

    serializer.save(**extra)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_flashcard(request, flashcard_id):
    """Delete a flashcard (teacher delete), cleaning up its image from storage if it had one."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    _best_effort_delete_flashcard_image(flashcard.image_url)
    flashcard.delete()
    return Response({"message": "Flashcard deleted."}, status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_materials(request):
    """List lecture materials cleanly using MaterialSerializer to preserve file_url."""
    user = request.user

    if user.role == "TEACHER":
        materials = Material.objects.filter(uploaded_by=user).order_by("-created_at")
    elif user.role == "STUDENT":
        materials = Material.objects.all().order_by("-created_at")
    else:
        materials = Material.objects.none()

    serializer = MaterialSerializer(materials, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_material(request, material_id):
    """Delete lecture material record, cascaded flashcards, and remove asset from Supabase bucket."""
    if request.user.role != "TEACHER":
        return Response({"error": "Unauthorized. Only teachers can manage storage lifecycles."}, 
                        status=status.HTTP_403_FORBIDDEN)

    material = get_object_or_404(Material, id=material_id)

    try:
        # If a file link exists, parse out its name to purge the asset from Supabase storage
        if material.file_url:
            try:
                delete_object("materials", path_from_public_url("materials", material.file_url))
            except Exception as bucket_err:
                logger.warning(f"Storage bucket drop warning or bypassed file skip trace: {str(bucket_err)}")

        # Drop DB object row cleanly (Cascades down to clean performance trackers/flashcards automatically)
        material.delete()
        return Response({"message": "Material and storage bucket payload cleanly removed."}, status=status.HTTP_200_OK)

    except Exception as e:
        logger.exception("Failed to execute material storage destruction lifecycles")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def material_flashcards(request, material_id):
    """List a material's flashcards (teacher-only — includes teacher-facing fields like bloom_level)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    flashcards = Flashcard.objects.filter(material_id=material_id)
    serializer = FlashcardSerializer(flashcards, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def create_flashcard(request, material_id):
    """Create a flashcard (teacher-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    # NOTE: request.data is a QueryDict for multipart/form submissions — spreading it with
    # {**request.data} wraps every value in a list (Django's dict()/** conversion exposes
    # QueryDict's internal multi-value storage directly), so flatten it via .dict() first.
    payload = request.data.dict() if hasattr(request.data, "dict") else dict(request.data)
    payload["material"] = material_id
    serializer = FlashcardSerializer(data=payload)
    serializer.is_valid(raise_exception=True)

    image_file = request.FILES.get("image")
    image_url = None
    if image_file:
        ext = os.path.splitext(image_file.name)[1].lower() or ".jpg"
        path = f"flashcard_images/material_{material_id}_{uuid.uuid4().hex}{ext}"
        image_url = upload_bytes_and_get_url(
            "materials", path, image_file.read(), getattr(image_file, "content_type", "image/jpeg")
        )

    serializer.save(image_url=image_url)
    return Response(serializer.data, status=201)


# ==========================================================================
# Quiz Sessions — bounded, one-time MCQ assessments (pretest/posttest/quiz),
# distinct from the ongoing spaced-repetition practice queue above.
# ==========================================================================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_quiz_session(request):
    """Create a quiz session for a material from a chosen set of MCQ flashcards (teacher-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    serializer = QuizSessionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save(created_by=request.user)
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def material_quiz_sessions(request, material_id):
    """List a material's quiz sessions (teacher-only, teacher's own materials only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    material = get_object_or_404(Material, id=material_id, uploaded_by=request.user)
    sessions = QuizSession.objects.filter(material=material).order_by("-created_at")
    return Response(QuizSessionSerializer(sessions, many=True).data)


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def toggle_quiz_session(request, quiz_id):
    """Open/close a quiz session for students (teacher-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    quiz.is_active = not quiz.is_active
    quiz.save(update_fields=["is_active"])
    return Response(QuizSessionSerializer(quiz).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def quiz_session_results(request, quiz_id):
    """Per-student attempt scores for one quiz session (teacher-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    attempts = QuizAttempt.objects.filter(quiz_session=quiz).select_related("student").order_by("student__username")
    return Response(QuizAttemptSerializer(attempts, many=True).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def material_quiz_improvement(request, material_id):
    """
    Pairs each student's PRETEST and POSTTEST attempts for a material (when both exist) and
    returns the score-percentage delta per student, plus the class average pretest/posttest/
    improvement (teacher-only).
    """
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)

    material = get_object_or_404(Material, id=material_id, uploaded_by=request.user)

    pretest_attempts = {
        a.student_id: a
        for a in QuizAttempt.objects.filter(
            quiz_session__material=material, quiz_session__quiz_type=QuizSession.TYPE_PRETEST, completed_at__isnull=False
        ).select_related("student")
    }
    posttest_attempts = {
        a.student_id: a
        for a in QuizAttempt.objects.filter(
            quiz_session__material=material, quiz_session__quiz_type=QuizSession.TYPE_POSTTEST, completed_at__isnull=False
        ).select_related("student")
    }

    per_student = []
    for student_id in set(pretest_attempts) & set(posttest_attempts):
        pre = pretest_attempts[student_id]
        post = posttest_attempts[student_id]
        per_student.append({
            "student_id": student_id,
            "username": pre.student.username,
            "pretest_percentage": pre.score_percentage,
            "posttest_percentage": post.score_percentage,
            "improvement": round(post.score_percentage - pre.score_percentage, 2),
        })
    per_student.sort(key=lambda row: row["username"])

    class_avg_pre = round(sum(r["pretest_percentage"] for r in per_student) / len(per_student), 2) if per_student else 0.0
    class_avg_post = round(sum(r["posttest_percentage"] for r in per_student) / len(per_student), 2) if per_student else 0.0

    return Response({
        "students": per_student,
        "class_average_pretest": class_avg_pre,
        "class_average_posttest": class_avg_post,
        "class_average_improvement": round(class_avg_post - class_avg_pre, 2),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def available_quiz_sessions(request):
    """Quizzes the student can take or has already completed, across all visible materials."""
    student = request.user
    sessions = QuizSession.objects.filter(is_active=True).select_related("material")

    completed_by_session = {
        a.quiz_session_id: a
        for a in QuizAttempt.objects.filter(student=student, completed_at__isnull=False)
    }

    payload = []
    for quiz in sessions:
        attempt = completed_by_session.get(quiz.id)
        payload.append({
            "id": quiz.id,
            "title": quiz.title,
            "quiz_type": quiz.quiz_type,
            "material_id": quiz.material_id,
            "material_title": quiz.material.title,
            "question_count": quiz.flashcards.count(),
            "completed": attempt is not None,
            "score": attempt.score if attempt else None,
            "total_questions": attempt.total_questions if attempt else None,
            "score_percentage": attempt.score_percentage if attempt else None,
        })
    return Response(payload)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def start_quiz_session(request, quiz_id):
    """Begins (or resumes) a student's attempt and returns the quiz's questions — no answer key included."""
    quiz = get_object_or_404(QuizSession, id=quiz_id, is_active=True)
    student = request.user

    existing = QuizAttempt.objects.filter(quiz_session=quiz, student=student).first()
    if existing and existing.completed_at:
        return Response({"error": "You have already completed this quiz."}, status=status.HTTP_400_BAD_REQUEST)

    QuizAttempt.objects.get_or_create(quiz_session=quiz, student=student)

    questions = [
        {
            "id": c.id,
            "question": c.question,
            "choices": {"A": c.choice_a, "B": c.choice_b, "C": c.choice_c, "D": c.choice_d},
        }
        for c in quiz.flashcards.all()
    ]
    return Response({"quiz_id": quiz.id, "title": quiz.title, "quiz_type": quiz.quiz_type, "questions": questions})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_quiz_session(request, quiz_id):
    """Grades a student's full set of quiz answers in one shot; one official submission per student."""
    quiz = get_object_or_404(QuizSession, id=quiz_id)
    student = request.user

    attempt = QuizAttempt.objects.filter(quiz_session=quiz, student=student).first()
    if not attempt:
        return Response({"error": "Start the quiz before submitting."}, status=status.HTTP_400_BAD_REQUEST)
    if attempt.completed_at:
        return Response({"error": "You have already completed this quiz."}, status=status.HTTP_400_BAD_REQUEST)

    answers = request.data.get("answers", [])
    if not answers:
        return Response({"error": "Field 'answers' is required."}, status=status.HTTP_400_BAD_REQUEST)

    valid_flashcard_ids = set(quiz.flashcards.values_list("id", flat=True))
    score = 0
    answer_rows = []
    for item in answers:
        flashcard_id = item.get("flashcard_id")
        selected_choice = (item.get("selected_choice") or "").strip().upper()
        if flashcard_id not in valid_flashcard_ids:
            continue
        flashcard = Flashcard.objects.get(id=flashcard_id)
        is_correct = selected_choice == flashcard.correct_choice.strip().upper()
        if is_correct:
            score += 1
        answer_rows.append(QuizAnswer(
            quiz_attempt=attempt, flashcard=flashcard, selected_choice=selected_choice, is_correct=is_correct
        ))

    QuizAnswer.objects.bulk_create(answer_rows)
    attempt.score = score
    attempt.total_questions = len(valid_flashcard_ids)
    attempt.completed_at = timezone.now()
    attempt.save(update_fields=["score", "total_questions", "completed_at"])

    return Response(QuizAttemptSerializer(attempt).data, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def item_analysis_report(request, quiz_id):
    """Difficulty/discrimination/distractor-efficiency report for one quiz session (teacher-only, owner-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    return Response(reports.compute_item_analysis(quiz))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def competency_mastery_report(request, quiz_id):
    """Per-topic mastery report (DepEd MPS scale) for one quiz session (teacher-only, owner-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    return Response(reports.compute_competency_mastery(quiz))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def table_of_specifications_report(request, quiz_id):
    """Table of Specifications for one quiz session, from ad-hoc teacher-entered hours-per-topic (teacher-only, owner-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)

    hours = request.data.get("hours")
    if not isinstance(hours, dict):
        return Response({"error": "Field 'hours' (an object of sub_topic -> hours) is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = reports.compute_tos(quiz, hours)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    return Response(result)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def table_of_specifications_pdf(request, quiz_id):
    """Table of Specifications as a downloadable PDF (teacher-only, owner-only). Recomputes server-side from the posted hours, same as the JSON endpoint."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)

    hours = request.data.get("hours")
    if not isinstance(hours, dict):
        return Response({"error": "Field 'hours' (an object of sub_topic -> hours) is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        result = reports.compute_tos(quiz, hours)
    except ValueError as exc:
        return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    pdf_bytes = pdf_reports.render_tos_pdf(result)
    return _pdf_response(pdf_bytes, f"tos_{quiz_id}.pdf")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def item_analysis_pdf(request, quiz_id):
    """Item analysis report as a downloadable PDF (teacher-only, owner-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    pdf_bytes = pdf_reports.render_item_analysis_pdf(reports.compute_item_analysis(quiz))
    return _pdf_response(pdf_bytes, f"item_analysis_{quiz_id}.pdf")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def competency_mastery_pdf(request, quiz_id):
    """Competency mastery report as a downloadable PDF (teacher-only, owner-only)."""
    if request.user.role != "TEACHER":
        return Response({"error": "Access denied."}, status=status.HTTP_403_FORBIDDEN)
    quiz = get_object_or_404(QuizSession, id=quiz_id, created_by=request.user)
    pdf_bytes = pdf_reports.render_competency_mastery_pdf(reports.compute_competency_mastery(quiz))
    return _pdf_response(pdf_bytes, f"competency_mastery_{quiz_id}.pdf")