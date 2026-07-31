import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, QuizSession
from core import pdf_reports

pytestmark = pytest.mark.django_db

PDF_SIGNATURE = b"%PDF"


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="pdf_pytest_teacher",
        defaults={"email": "pdf_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def other_teacher(db):
    teacher, _ = User.objects.get_or_create(
        username="pdf_pytest_other_teacher",
        defaults={"email": "pdf_other_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="pdf_pytest_student",
        defaults={"email": "pdf_student@test.com", "role": User.ROLE_STUDENT}
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


# ---------------------------------------------------------------------------
# Unit tests: render_* functions produce valid, non-trivial PDF bytes
# ---------------------------------------------------------------------------

def test_render_class_analytics_pdf_with_data():
    data = {
        "student_count": 3,
        "class_accuracy_percentage": 82.5,
        "topic_breakdown": [{"sub_topic": "Cells", "avg_mastery": 3.2, "accuracy_percentage": 75.0}],
        "confidence_breakdown": [{"confidence": "CONFIDENT", "total": 10, "accuracy_percentage": 90.0}],
    }
    pdf_bytes = pdf_reports.render_class_analytics_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE
    assert len(pdf_bytes) > 500


def test_render_class_analytics_pdf_empty_data_no_crash():
    data = {"student_count": 0, "class_accuracy_percentage": 0.0, "topic_breakdown": [], "confidence_breakdown": []}
    pdf_bytes = pdf_reports.render_class_analytics_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


def test_render_student_analytics_pdf_with_data(teacher_user):
    student = User(username="render_student_test")
    data = {
        "cards_seen": 10, "cards_mastered": 4, "cards_due": 2, "accuracy_percentage": 66.6,
        "mastery_distribution": [{"mastery_level": lvl, "count": lvl} for lvl in range(6)],
        "topic_breakdown": [{"sub_topic": "Bones", "avg_mastery": 2.1, "accuracy_percentage": 55.0}],
        "confidence_breakdown": [{"confidence": "GUESSING", "total": 5, "accuracy_percentage": 20.0}],
    }
    pdf_bytes = pdf_reports.render_student_analytics_pdf(student, data)
    assert pdf_bytes[:4] == PDF_SIGNATURE
    assert len(pdf_bytes) > 500


def test_render_student_analytics_pdf_empty_data_no_crash():
    student = User(username="render_student_empty")
    data = {
        "cards_seen": 0, "cards_mastered": 0, "cards_due": 0, "accuracy_percentage": 0.0,
        "mastery_distribution": [{"mastery_level": lvl, "count": 0} for lvl in range(6)],
        "topic_breakdown": [], "confidence_breakdown": [],
    }
    pdf_bytes = pdf_reports.render_student_analytics_pdf(student, data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


def test_render_tos_pdf_with_data():
    data = {
        "quiz_id": 1, "quiz_title": "Quiz A", "total_items": 3, "total_hours": 4.0,
        "topics": [{
            "sub_topic": "Topic A", "hours": 3.0, "percentage_weight": 75.0,
            "ideal_item_count": 2, "actual_item_count": 2,
            "bloom_breakdown": {level: 1 if level == "REMEMBERING" else 0 for level in pdf_reports.BLOOM_LEVEL_ORDER},
        }],
    }
    pdf_bytes = pdf_reports.render_tos_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE
    assert len(pdf_bytes) > 500


def test_render_tos_pdf_no_topics_no_crash():
    data = {"quiz_id": 1, "quiz_title": "Quiz A", "total_items": 0, "total_hours": 0.0, "topics": []}
    pdf_bytes = pdf_reports.render_tos_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


def test_render_item_analysis_pdf_with_data():
    data = {
        "quiz_id": 1, "quiz_title": "Quiz A", "completed_attempts": 5,
        "insufficient_data_for_discrimination": False,
        "items": [{
            "flashcard_id": 1, "question": "What is 2+2?", "sub_topic": "Math",
            "bloom_level": "REMEMBERING", "total_attempts": 5,
            "difficulty_index": 0.6, "difficulty_label": "Average",
            "discrimination_index": 0.4, "discrimination_label": "Excellent",
            "distractors": [
                {"choice": "A", "text": "3", "is_correct": False, "count": 1, "percentage": 20.0,
                 "upper_count": 0, "lower_count": 1, "flagged_non_functional": False},
                {"choice": "B", "text": "4", "is_correct": True, "count": 4, "percentage": 80.0,
                 "upper_count": 1, "lower_count": 0, "flagged_non_functional": False},
            ],
        }],
    }
    pdf_bytes = pdf_reports.render_item_analysis_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE
    assert len(pdf_bytes) > 500


def test_render_item_analysis_pdf_no_items_no_crash():
    data = {"quiz_id": 1, "quiz_title": "Quiz A", "completed_attempts": 0,
            "insufficient_data_for_discrimination": True, "items": []}
    pdf_bytes = pdf_reports.render_item_analysis_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


def test_render_item_analysis_pdf_null_discrimination_no_crash():
    data = {
        "quiz_id": 1, "quiz_title": "Quiz A", "completed_attempts": 1,
        "insufficient_data_for_discrimination": True,
        "items": [{
            "flashcard_id": 1, "question": "Q", "sub_topic": "Uncategorized",
            "bloom_level": None, "total_attempts": 1,
            "difficulty_index": 1.0, "difficulty_label": "Easy",
            "discrimination_index": None, "discrimination_label": None,
            "distractors": [
                {"choice": "A", "text": "a", "is_correct": True, "count": 1, "percentage": 100.0,
                 "upper_count": 0, "lower_count": 0, "flagged_non_functional": False},
            ],
        }],
    }
    pdf_bytes = pdf_reports.render_item_analysis_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


def test_render_competency_mastery_pdf_with_data():
    data = {
        "quiz_id": 1, "quiz_title": "Quiz A", "completed_attempts": 2,
        "topics": [{
            "sub_topic": "Topic A", "item_count": 2, "students_assessed": 2,
            "avg_score_percentage": 40.0, "mastery_level": "Average",
            "students_below_mastery": [{"student_id": 1, "username": "weak_student", "score_percentage": 20.0}],
        }],
    }
    pdf_bytes = pdf_reports.render_competency_mastery_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE
    assert len(pdf_bytes) > 500


def test_render_competency_mastery_pdf_no_topics_no_crash():
    data = {"quiz_id": 1, "quiz_title": "Quiz A", "completed_attempts": 0, "topics": []}
    pdf_bytes = pdf_reports.render_competency_mastery_pdf(data)
    assert pdf_bytes[:4] == PDF_SIGNATURE


# ---------------------------------------------------------------------------
# View-level: auth/ownership/shape
# ---------------------------------------------------------------------------

def test_class_analytics_pdf_requires_teacher(api_client, student_user):
    client = authenticate(api_client, student_user)
    resp = client.get("/api/analytics/class/pdf/")
    assert resp.status_code == 403


def test_class_analytics_pdf_returns_pdf_for_teacher(api_client, teacher_user):
    client = authenticate(api_client, teacher_user)
    resp = client.get("/api/analytics/class/pdf/")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert "attachment" in resp["Content-Disposition"]
    assert resp.content[:4] == PDF_SIGNATURE


def test_student_analytics_pdf_requires_teacher(api_client, student_user):
    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/analytics/students/{student_user.id}/pdf/")
    assert resp.status_code == 403


def test_student_analytics_pdf_returns_pdf_for_teacher(api_client, teacher_user, student_user):
    client = authenticate(api_client, teacher_user)
    resp = client.get(f"/api/analytics/students/{student_user.id}/pdf/")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp.content[:4] == PDF_SIGNATURE


def test_tos_pdf_requires_ownership(api_client, teacher_user, other_teacher, material):
    card = make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, other_teacher)
    resp = client.post(f"/api/quizzes/{quiz.id}/tos/pdf/", {"hours": {"Topic A": 1}}, format="json")
    assert resp.status_code == 404


def test_tos_pdf_returns_pdf_for_owner(api_client, teacher_user, material):
    card = make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, teacher_user)
    resp = client.post(f"/api/quizzes/{quiz.id}/tos/pdf/", {"hours": {"Topic A": 1}}, format="json")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    assert resp.content[:4] == PDF_SIGNATURE


def test_item_analysis_pdf_requires_teacher(api_client, student_user, teacher_user, material):
    card = make_mcq(material)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/quizzes/{quiz.id}/item-analysis/pdf/")
    assert resp.status_code == 403


def test_item_analysis_pdf_returns_pdf_for_owner(api_client, teacher_user, material):
    card = make_mcq(material)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, teacher_user)
    resp = client.get(f"/api/quizzes/{quiz.id}/item-analysis/pdf/")
    assert resp.status_code == 200
    assert resp.content[:4] == PDF_SIGNATURE


def test_competency_mastery_pdf_requires_ownership(api_client, teacher_user, other_teacher, material):
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    client = authenticate(api_client, other_teacher)
    resp = client.get(f"/api/quizzes/{quiz.id}/competency-mastery/pdf/")
    assert resp.status_code == 404


def test_competency_mastery_pdf_returns_pdf_for_owner(api_client, teacher_user, material):
    card = make_mcq(material, sub_topic="Topic A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, teacher_user)
    resp = client.get(f"/api/quizzes/{quiz.id}/competency-mastery/pdf/")
    assert resp.status_code == 200
    assert resp.content[:4] == PDF_SIGNATURE
