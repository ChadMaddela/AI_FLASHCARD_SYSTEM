import os
import django
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, QuizSession, QuizAttempt, QuizAnswer
from core import reports

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="reports_pytest_teacher",
        defaults={"email": "reports_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def other_teacher(db):
    teacher, _ = User.objects.get_or_create(
        username="reports_pytest_other_teacher",
        defaults={"email": "reports_other_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="reports_pytest_student",
        defaults={"email": "reports_student@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


@pytest.fixture
def material(db, teacher_user):
    return Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)


def authenticate(client, user, password="password123"):
    resp = client.post("/api/token/", {"username": user.username, "password": password})
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


def make_mcq(material, correct="A", sub_topic="T", bloom_level=None):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice=correct, sub_topic=sub_topic, bloom_level=bloom_level,
    )


def make_student(username):
    student, _ = User.objects.get_or_create(
        username=username, defaults={"email": f"{username}@test.com", "role": User.ROLE_STUDENT}
    )
    return student


def make_attempt(quiz, student, score, total_questions):
    """A completed attempt with an explicit total score (independent of per-item answers below)."""
    return QuizAttempt.objects.create(
        quiz_session=quiz, student=student, score=score, total_questions=total_questions,
        completed_at=timezone.now(),
    )


# ---------------------------------------------------------------------------
# compute_item_analysis
# ---------------------------------------------------------------------------

def test_item_analysis_difficulty_and_discrimination(teacher_user, material):
    card = make_mcq(material, correct="A", sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    # 5 students, distinct total scores -> unambiguous upper/lower 27% (group_size=1): s1 top, s5 bottom.
    s1 = make_student("ia_s1"); s2 = make_student("ia_s2"); s3 = make_student("ia_s3")
    s4 = make_student("ia_s4"); s5 = make_student("ia_s5")
    a1 = make_attempt(quiz, s1, 10, 10)
    a2 = make_attempt(quiz, s2, 8, 10)
    a3 = make_attempt(quiz, s3, 6, 10)
    a4 = make_attempt(quiz, s4, 4, 10)
    a5 = make_attempt(quiz, s5, 2, 10)

    # Good discriminator: top scorer (A) and 2nd-place correct; bottom two wrong.
    QuizAnswer.objects.create(quiz_attempt=a1, flashcard=card, selected_choice="A", is_correct=True)
    QuizAnswer.objects.create(quiz_attempt=a2, flashcard=card, selected_choice="A", is_correct=True)
    QuizAnswer.objects.create(quiz_attempt=a3, flashcard=card, selected_choice="B", is_correct=False)
    QuizAnswer.objects.create(quiz_attempt=a4, flashcard=card, selected_choice="B", is_correct=False)
    QuizAnswer.objects.create(quiz_attempt=a5, flashcard=card, selected_choice="C", is_correct=False)

    result = reports.compute_item_analysis(quiz)
    assert result["completed_attempts"] == 5
    assert result["insufficient_data_for_discrimination"] is False

    item = result["items"][0]
    assert item["difficulty_index"] == 0.4  # 2/5
    assert item["difficulty_label"] == "Average"
    assert item["discrimination_index"] == 1.0  # correct_upper(1) - correct_lower(0) / group_size(1)
    assert item["discrimination_label"] == "Excellent"

    distractor_d = next(d for d in item["distractors"] if d["choice"] == "D")
    assert distractor_d["count"] == 0
    assert distractor_d["flagged_non_functional"] is True

    distractor_b = next(d for d in item["distractors"] if d["choice"] == "B")
    assert distractor_b["count"] == 2
    assert distractor_b["flagged_non_functional"] is False


def test_item_analysis_negative_discrimination_flags_miskeyed_style_item(teacher_user, material):
    card = make_mcq(material, correct="A", sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    s1 = make_student("neg_s1"); s5 = make_student("neg_s5")
    a1 = make_attempt(quiz, s1, 10, 10)  # top scorer
    a5 = make_attempt(quiz, s5, 0, 10)   # bottom scorer

    QuizAnswer.objects.create(quiz_attempt=a1, flashcard=card, selected_choice="B", is_correct=False)
    QuizAnswer.objects.create(quiz_attempt=a5, flashcard=card, selected_choice="A", is_correct=True)

    result = reports.compute_item_analysis(quiz)
    item = result["items"][0]
    assert item["discrimination_index"] == -1.0
    assert item["discrimination_label"] == "Poor"


def test_item_analysis_insufficient_data_with_single_attempt(teacher_user, material):
    card = make_mcq(material, correct="A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    s1 = make_student("solo_s1")
    a1 = make_attempt(quiz, s1, 1, 1)
    QuizAnswer.objects.create(quiz_attempt=a1, flashcard=card, selected_choice="A", is_correct=True)

    result = reports.compute_item_analysis(quiz)
    assert result["insufficient_data_for_discrimination"] is True
    assert result["items"][0]["discrimination_index"] is None
    assert result["items"][0]["discrimination_label"] is None


def test_item_analysis_zero_attempts_no_crash(teacher_user, material):
    card = make_mcq(material)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    result = reports.compute_item_analysis(quiz)
    assert result["completed_attempts"] == 0
    assert result["items"][0]["total_attempts"] == 0
    assert result["items"][0]["discrimination_index"] is None


# ---------------------------------------------------------------------------
# compute_competency_mastery
# ---------------------------------------------------------------------------

def test_competency_mastery_per_topic_and_below_mastery_list(teacher_user, material):
    card_a1 = make_mcq(material, correct="A", sub_topic="Topic A")
    card_a2 = make_mcq(material, correct="A", sub_topic="Topic A")
    card_b1 = make_mcq(material, correct="A", sub_topic="")  # blank -> Uncategorized
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card_a1, card_a2, card_b1)

    strong = make_student("mastery_strong")
    weak = make_student("mastery_weak")
    a_strong = make_attempt(quiz, strong, 3, 3)
    a_weak = make_attempt(quiz, weak, 1, 3)

    QuizAnswer.objects.create(quiz_attempt=a_strong, flashcard=card_a1, selected_choice="A", is_correct=True)
    QuizAnswer.objects.create(quiz_attempt=a_strong, flashcard=card_a2, selected_choice="A", is_correct=True)
    QuizAnswer.objects.create(quiz_attempt=a_strong, flashcard=card_b1, selected_choice="A", is_correct=True)

    QuizAnswer.objects.create(quiz_attempt=a_weak, flashcard=card_a1, selected_choice="A", is_correct=True)
    QuizAnswer.objects.create(quiz_attempt=a_weak, flashcard=card_a2, selected_choice="B", is_correct=False)
    QuizAnswer.objects.create(quiz_attempt=a_weak, flashcard=card_b1, selected_choice="B", is_correct=False)

    result = reports.compute_competency_mastery(quiz)
    topic_a = next(t for t in result["topics"] if t["sub_topic"] == "Topic A")
    topic_uncat = next(t for t in result["topics"] if t["sub_topic"] == "Uncategorized")

    # Topic A: strong=100%, weak=50% -> avg 75% -> "Moving Towards Mastery"
    assert topic_a["avg_score_percentage"] == 75.0
    assert topic_a["mastery_level"] == "Moving Towards Mastery"
    assert len(topic_a["students_below_mastery"]) == 1
    assert topic_a["students_below_mastery"][0]["username"] == "mastery_weak"

    # Uncategorized bucket: strong=100%, weak=0% -> avg 50% -> "Average"
    assert topic_uncat["item_count"] == 1
    assert topic_uncat["avg_score_percentage"] == 50.0
    assert topic_uncat["mastery_level"] == "Average"


def test_competency_mastery_zero_attempts_no_crash(teacher_user, material):
    make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(Flashcard.objects.filter(material=material).first())

    result = reports.compute_competency_mastery(quiz)
    assert result["completed_attempts"] == 0
    assert result["topics"][0]["avg_score_percentage"] == 0.0
    assert result["topics"][0]["students_below_mastery"] == []


# ---------------------------------------------------------------------------
# compute_tos
# ---------------------------------------------------------------------------

def test_tos_ideal_vs_actual_and_bloom_breakdown(teacher_user, material):
    make_mcq(material, sub_topic="Topic A", bloom_level=Flashcard.BLOOM_REMEMBERING)
    make_mcq(material, sub_topic="Topic A", bloom_level=Flashcard.BLOOM_ANALYZING)
    make_mcq(material, sub_topic="Topic B", bloom_level=Flashcard.BLOOM_UNDERSTANDING)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(*Flashcard.objects.filter(material=material))

    result = reports.compute_tos(quiz, {"Topic A": 3, "Topic B": 1})
    assert result["total_items"] == 3
    assert result["total_hours"] == 4.0

    topic_a = next(t for t in result["topics"] if t["sub_topic"] == "Topic A")
    topic_b = next(t for t in result["topics"] if t["sub_topic"] == "Topic B")

    assert topic_a["percentage_weight"] == 75.0
    assert topic_a["ideal_item_count"] == round(0.75 * 3)
    assert topic_a["actual_item_count"] == 2
    assert topic_a["bloom_breakdown"][Flashcard.BLOOM_REMEMBERING] == 1
    assert topic_a["bloom_breakdown"][Flashcard.BLOOM_ANALYZING] == 1
    assert topic_a["bloom_breakdown"][Flashcard.BLOOM_UNDERSTANDING] == 0

    assert topic_b["percentage_weight"] == 25.0
    assert topic_b["actual_item_count"] == 1


def test_tos_topic_with_hours_but_no_items_still_shown(teacher_user, material):
    make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(*Flashcard.objects.filter(material=material))

    result = reports.compute_tos(quiz, {"Topic A": 2, "Topic Never Tested": 1})
    topic_untested = next(t for t in result["topics"] if t["sub_topic"] == "Topic Never Tested")
    assert topic_untested["actual_item_count"] == 0
    assert topic_untested["percentage_weight"] == round((1 / 3) * 100, 2)


def test_tos_rejects_zero_total_hours(teacher_user, material):
    make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(*Flashcard.objects.filter(material=material))

    with pytest.raises(ValueError):
        reports.compute_tos(quiz, {"Topic A": 0})


def test_tos_rejects_negative_hours(teacher_user, material):
    make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(*Flashcard.objects.filter(material=material))

    with pytest.raises(ValueError):
        reports.compute_tos(quiz, {"Topic A": -1})


# ---------------------------------------------------------------------------
# View-level: auth/ownership/shape
# ---------------------------------------------------------------------------

def test_item_analysis_view_requires_teacher(api_client, student_user, teacher_user, material):
    card = make_mcq(material)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/quizzes/{quiz.id}/item-analysis/")
    assert resp.status_code == 403


def test_competency_mastery_view_requires_ownership(api_client, teacher_user, other_teacher, material):
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    client = authenticate(api_client, other_teacher)
    resp = client.get(f"/api/quizzes/{quiz.id}/competency-mastery/")
    assert resp.status_code == 404


def test_tos_view_returns_computed_shape(api_client, teacher_user, material):
    card = make_mcq(material, sub_topic="Topic A", bloom_level=Flashcard.BLOOM_REMEMBERING)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, teacher_user)
    resp = client.post(f"/api/quizzes/{quiz.id}/tos/", {"hours": {"Topic A": 2}}, format="json")
    assert resp.status_code == 200
    assert resp.data["total_items"] == 1
    assert resp.data["topics"][0]["sub_topic"] == "Topic A"


def test_tos_view_rejects_invalid_hours(api_client, teacher_user, material):
    card = make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, teacher_user)
    resp = client.post(f"/api/quizzes/{quiz.id}/tos/", {"hours": {"Topic A": -5}}, format="json")
    assert resp.status_code == 400
