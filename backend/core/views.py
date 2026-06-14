import json
import logging
import os
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.core.files.storage import default_storage
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from google import genai
from google.genai import types
from config import settings
from .models import Material, Flashcard, StudentPerformance, User
from .spacing_engine import process_student_response, get_next_cards_for_student
from .serializers import UserSerializer, FlashcardSerializer, MaterialSerializer, MaterialCreateSerializer, PerformanceSummarySerializer    
import docx
import PyPDF2
from pptx import Presentation
from PIL import Image
import pytesseract

logger = logging.getLogger(__name__)
client = genai.Client(api_key=settings.GEMINI_API_KEY)


def extract_text_from_file(file_path):
    """Extract text depending on file type."""
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        text = ""
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text += page.extract_text() or ""
        return text

    elif ext == ".docx":
        doc = docx.Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs])

    elif ext == ".pptx":
        prs = Presentation(file_path)
        text = ""
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text"):
                    text += shape.text + "\n"
        return text

    elif ext in [".jpg", ".jpeg", ".png"]:
        img = Image.open(file_path)
        return pytesseract.image_to_string(img)

    else:
        raise ValueError(f"Unsupported file type: {ext}")


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_card_queue(request, material_id):
    """Retrieve up to 10 cards for review based on mastery tracking.
       If student has no mastery records yet, serve initial flashcards."""
    material = get_object_or_404(Material, id=material_id)
    student = request.user

    # Adaptive queue first
    selected_cards = get_next_cards_for_student(student, material=material, limit=10)

    # Fallback for new students or empty queryset
    if not selected_cards or len(selected_cards) == 0:
        selected_cards = Flashcard.objects.filter(material=material).order_by("id")[:10]

    payload = []
    for c in selected_cards:
        perf = StudentPerformance.objects.filter(student=student, flashcard=c).first()
        payload.append({
            "id": c.id,
            "question": c.question,
            "choices": {
                "A": c.choice_a,
                "B": c.choice_b,
                "C": c.choice_c,
                "D": c.choice_d
            },
            "sub_topic": c.sub_topic,
            "current_mastery_level": perf.mastery_level if perf else 0
        })

    return Response({"queue": payload}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def teacher_upload_material(request):
    """Teachers upload lecture materials (text or file) → Gemini generates flashcards."""
    title = request.data.get("title")
    content_text = request.data.get("content")
    uploaded_file = request.FILES.get("file")

    if not title and not uploaded_file:
        return Response({"error": "Provide either 'title' + 'content' or upload a file."},
                        status=status.HTTP_400_BAD_REQUEST)

    try:
        if uploaded_file:
            file_path = default_storage.save(uploaded_file.name, uploaded_file)
            full_path = default_storage.path(file_path)
            content_text = extract_text_from_file(full_path)

        if not content_text:
            return Response({"error": "No text could be extracted from the file."},
                            status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            material = Material.objects.create(
                title=title or uploaded_file.name,
                description=f"Uploaded file processed. Size: {len(content_text)} chars.",
                content_text=content_text,
                uploaded_by=request.user
            )

            prompt = (
                f"Generate 5–10 multiple-choice questions (MCQs) from the following material. "
                f"Each question must have 4 choices (A–D), identify the correct choice, and state the sub-topic.\n\n"
                f"Study Material:\n{content_text}"
            )

            response_schema = types.Schema(
                type=types.Type.ARRAY,
                items=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "question": types.Schema(type=types.Type.STRING),
                        "choice_a": types.Schema(type=types.Type.STRING),
                        "choice_b": types.Schema(type=types.Type.STRING),
                        "choice_c": types.Schema(type=types.Type.STRING),
                        "choice_d": types.Schema(type=types.Type.STRING),
                        "correct_choice": types.Schema(type=types.Type.STRING),
                        "sub_topic": types.Schema(type=types.Type.STRING),
                    },
                    required=["question", "choice_a", "choice_b", "choice_c", "choice_d", "correct_choice", "sub_topic"]
                )
            )

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=response_schema,
                    temperature=0.2
                )
            )

            raw_output = response.candidates[0].content.parts[0].text
            generated_cards = json.loads(raw_output)

            flashcards_to_create = [
                Flashcard(
                    material=material,
                    question=item["question"],
                    choice_a=item["choice_a"],
                    choice_b=item["choice_b"],
                    choice_c=item["choice_c"],
                    choice_d=item["choice_d"],
                    correct_choice=item["correct_choice"].upper().strip(),
                    sub_topic=item["sub_topic"]
                )
                for item in generated_cards
            ]

            Flashcard.objects.bulk_create(flashcards_to_create)

        return Response({
            "message": "Material uploaded and flashcards created via Gemini AI.",
            "material_id": material.id,
            "flashcards_count": len(flashcards_to_create)
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.exception("Failed to process upload")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def student_card_queue(request, material_id):
    """Retrieve up to 10 cards for review based on mastery tracking.
       If student has no mastery records yet, serve initial flashcards."""
    material = get_object_or_404(Material, id=material_id)
    student = request.user

    # Adaptive queue first
    selected_cards = get_next_cards_for_student(student, material=material, limit=10)

    # Fallback for new students
    if not selected_cards:
        selected_cards = Flashcard.objects.filter(material=material).order_by("id")[:10]

    payload = []
    for c in selected_cards:
        perf = StudentPerformance.objects.filter(student=student, flashcard=c).first()
        payload.append({
            "id": c.id,
            "question": c.question,
            "choices": {
                "A": c.choice_a,
                "B": c.choice_b,
                "C": c.choice_c,
                "D": c.choice_d
            },
            "sub_topic": c.sub_topic,
            "current_mastery_level": perf.mastery_level if perf else 0
        })

    return Response({"queue": payload}, status=status.HTTP_200_OK)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_answer(request):
    """Process student answer → update mastery level + analytics."""
    flashcard_id = request.data.get("flashcard_id")
    selected_choice = request.data.get("selected_choice")

    if not flashcard_id or not selected_choice:
        return Response({"error": "Fields 'flashcard_id' and 'selected_choice' are required."},
                        status=status.HTTP_400_BAD_REQUEST)

    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    student = request.user

    perf = process_student_response(student, flashcard, selected_choice)
    is_correct = (selected_choice.strip().upper() == flashcard.correct_choice.upper())
    accuracy_rate = perf.accuracy_percentage

    return Response({
        "is_correct": is_correct,
        "correct_answer": flashcard.correct_choice,
        "analytics": {
            "updated_mastery_level": perf.mastery_level,
            "total_attempts": perf.attempts_count,
            "accuracy_percentage": accuracy_rate,
            "sub_topic_tracked": flashcard.sub_topic
        }
    }, status=status.HTTP_200_OK)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_me(request):
    """Return full info about the currently authenticated user, including their role."""
    serializer = UserSerializer(request.user)
    return Response(serializer.data)


# -------------------------------
# FLASHCARD MANAGEMENT ENDPOINTS
# -------------------------------

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_flashcards(request):
    """List all flashcards (teacher view)."""
    flashcards = Flashcard.objects.all().order_by("-id")
    serializer = FlashcardSerializer(flashcards, many=True)
    return Response({"flashcards": serializer.data}, status=status.HTTP_200_OK)


@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_flashcard(request, flashcard_id):
    """Update a flashcard (teacher edit)."""
    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    serializer = FlashcardSerializer(flashcard, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_flashcard(request, flashcard_id):
    """Delete a flashcard (teacher delete)."""
    flashcard = get_object_or_404(Flashcard, id=flashcard_id)
    flashcard.delete()
    return Response({"message": "Flashcard deleted."}, status=status.HTTP_204_NO_CONTENT)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_materials(request):
    user = request.user

    if user.role == "TEACHER":
        # Teachers only see their own uploads
        materials = Material.objects.filter(uploaded_by=user).order_by("-created_at")
    elif user.role == "STUDENT":
        # Students see ALL materials uploaded by teachers
        materials = Material.objects.all().order_by("-created_at")
    else:
        # Fallback: no role → no materials
        materials = Material.objects.none()

    serializer = MaterialSerializer(materials, many=True)
    return Response(serializer.data, status=200)

