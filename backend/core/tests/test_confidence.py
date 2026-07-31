import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, ConfidenceRating
from core import analytics

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="confidence_pytest_teacher",
        defaults={"email": "confidence_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="confidence_pytest_student",
        defaults={"email": "confidence_student@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


def authenticate(client, user, password="password123"):
    resp = client.post("/api/token/", {"username": user.username, "password": password})
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


def make_mcq(material, correct_choice="A"):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice=correct_choice, sub_topic="Topic",
    )


def test_submit_with_confidence_logs_correct_rating(api_client, teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, correct_choice="A")

    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/flashcards/submit/",
        {"flashcard_id": card.id, "selected_choice": "A", "confidence": "CONFIDENT"},
        format="json",
    )
    assert resp.status_code == 200

    rating = ConfidenceRating.objects.get(student=student_user, flashcard=card)
    assert rating.confidence == "CONFIDENT"
    assert rating.is_correct is True


def test_submit_with_confidence_logs_incorrect_rating(api_client, teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, correct_choice="A")

    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/flashcards/submit/",
        {"flashcard_id": card.id, "selected_choice": "Z", "confidence": "GUESSING"},
        format="json",
    )
    assert resp.status_code == 200

    rating = ConfidenceRating.objects.get(student=student_user, flashcard=card)
    assert rating.confidence == "GUESSING"
    assert rating.is_correct is False


def test_submit_without_confidence_logs_nothing(api_client, teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, correct_choice="A")

    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/flashcards/submit/",
        {"flashcard_id": card.id, "selected_choice": "A"},
        format="json",
    )
    assert resp.status_code == 200
    assert not ConfidenceRating.objects.filter(student=student_user, flashcard=card).exists()


def test_submit_with_invalid_confidence_rejected(api_client, teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, correct_choice="A")

    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/flashcards/submit/",
        {"flashcard_id": card.id, "selected_choice": "A", "confidence": "VERY_SURE"},
        format="json",
    )
    assert resp.status_code == 400


def test_confidence_breakdown_math(teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material)

    ConfidenceRating.objects.create(student=student_user, flashcard=card, confidence="CONFIDENT", is_correct=True)
    ConfidenceRating.objects.create(student=student_user, flashcard=card, confidence="CONFIDENT", is_correct=True)
    ConfidenceRating.objects.create(student=student_user, flashcard=card, confidence="CONFIDENT", is_correct=False)

    result = analytics.compute_student_analytics(student_user)
    confident_row = next(r for r in result["confidence_breakdown"] if r["confidence"] == "CONFIDENT")
    assert confident_row["total"] == 3
    assert confident_row["accuracy_percentage"] == 66.7


def test_class_confidence_breakdown_excludes_teachers(teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material)

    ConfidenceRating.objects.create(student=student_user, flashcard=card, confidence="UNSURE", is_correct=True)
    ConfidenceRating.objects.create(student=teacher_user, flashcard=card, confidence="UNSURE", is_correct=False)

    result = analytics.compute_class_analytics()
    unsure_row = next(r for r in result["confidence_breakdown"] if r["confidence"] == "UNSURE")
    assert unsure_row["total"] == 1  # only the student's rating, not the teacher's
    assert unsure_row["accuracy_percentage"] == 100.0
