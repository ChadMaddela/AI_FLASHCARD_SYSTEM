import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, StudentPerformance
from core.spacing_engine import process_student_response

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="cloze_pytest_teacher",
        defaults={"email": "cloze_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="cloze_pytest_student",
        defaults={"email": "cloze_student@test.com", "role": User.ROLE_STUDENT}
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


def make_cloze_card(material):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_CLOZE,
        question="The _____ is the powerhouse of the cell.",
        answer="mitochondria", sub_topic="Cell Biology",
    )


def test_cloze_card_graded_like_basic_card(teacher_user, student_user, material):
    card = make_cloze_card(material)

    perf = process_student_response(student_user, card, grade="good")
    assert perf.is_correct is True
    assert perf.attempts_count == 1
    assert perf.correct_attempts_count == 1
    # First-ever review stays in learning steps (same as BASIC), doesn't graduate immediately.
    assert perf.is_learning is True

    perf2 = process_student_response(student_user, card, grade="again")
    assert perf2.is_correct is False
    assert perf2.attempts_count == 2


def test_create_cloze_flashcard_requires_answer(api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {"card_type": "CLOZE", "question": "The _____ pumps blood.", "sub_topic": "Circulatory"},
        format="json",
    )
    assert resp.status_code == 400
    assert "answer" in resp.data


def test_create_cloze_flashcard_succeeds_with_answer(api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {
            "card_type": "CLOZE", "question": "The _____ pumps blood.",
            "answer": "heart", "sub_topic": "Circulatory",
        },
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["card_type"] == "CLOZE"
    assert resp.data["answer"] == "heart"


def test_student_queue_returns_answer_for_cloze_card(api_client, teacher_user, student_user, material):
    make_cloze_card(material)
    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/materials/{material.id}/queue/")
    assert resp.status_code == 200
    card = resp.data["queue"][0]
    assert card["card_type"] == "CLOZE"
    assert card["answer"] == "mitochondria"
    assert "choices" not in card


def test_submit_answer_for_cloze_card_with_grade(api_client, teacher_user, student_user, material):
    card = make_cloze_card(material)
    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/flashcards/submit/",
        {"flashcard_id": card.id, "grade": "easy"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["card_type"] == "CLOZE"
    assert resp.data["answer"] == "mitochondria"
