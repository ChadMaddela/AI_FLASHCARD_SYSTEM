import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="bloom_pytest_teacher",
        defaults={"email": "bloom_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="bloom_pytest_student",
        defaults={"email": "bloom_student@test.com", "role": User.ROLE_STUDENT}
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


def make_mcq(material, bloom_level=None):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice="A", sub_topic="T", bloom_level=bloom_level,
    )


def test_material_flashcards_requires_teacher(api_client, student_user, material):
    make_mcq(material)
    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/materials/{material.id}/flashcards/")
    assert resp.status_code == 403


def test_create_flashcard_requires_teacher(api_client, student_user, material):
    client = authenticate(api_client, student_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {"card_type": "MCQ", "question": "Q", "choice_a": "a", "choice_b": "b",
         "choice_c": "c", "choice_d": "d", "correct_choice": "A", "sub_topic": "T"},
        format="json",
    )
    assert resp.status_code == 403


def test_create_flashcard_accepts_valid_bloom_level(api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {"card_type": "MCQ", "question": "Q", "choice_a": "a", "choice_b": "b",
         "choice_c": "c", "choice_d": "d", "correct_choice": "A", "sub_topic": "T",
         "bloom_level": "ANALYZING"},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["bloom_level"] == "ANALYZING"


def test_create_flashcard_rejects_invalid_bloom_level(api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {"card_type": "MCQ", "question": "Q", "choice_a": "a", "choice_b": "b",
         "choice_c": "c", "choice_d": "d", "correct_choice": "A", "sub_topic": "T",
         "bloom_level": "NOT_A_REAL_LEVEL"},
        format="json",
    )
    assert resp.status_code == 400


def test_teacher_can_override_bloom_level_on_update(api_client, teacher_user, material):
    card = make_mcq(material, bloom_level="REMEMBERING")
    client = authenticate(api_client, teacher_user)
    resp = client.put(
        f"/api/flashcards/{card.id}/update/",
        {"bloom_level": "EVALUATING"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["bloom_level"] == "EVALUATING"


def test_student_queue_never_includes_bloom_level(api_client, teacher_user, student_user, material):
    make_mcq(material, bloom_level="CREATING")
    client = authenticate(api_client, student_user)
    resp = client.get(f"/api/materials/{material.id}/queue/")
    assert resp.status_code == 200
    for card in resp.data["queue"]:
        assert "bloom_level" not in card
