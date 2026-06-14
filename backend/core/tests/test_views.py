import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard

pytestmark = pytest.mark.django_db  # allow DB access in all tests


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="pytest_teacher",
        defaults={"email": "teacher@test.com", "role": "TEACHER"}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="pytest_student",
        defaults={"email": "student@test.com", "role": "STUDENT"}
    )
    student.set_password("password123")
    student.save()
    return student


def authenticate(client, user):
    """Helper to log in and set JWT token."""
    resp = client.post("/api/token/", {"username": user.username, "password": "password123"})
    assert resp.status_code == 200
    token = resp.data["access"]
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def test_list_materials(api_client, teacher_user):
    client = authenticate(api_client, teacher_user)
    resp = client.get("/api/materials/")  # <-- corrected path
    assert resp.status_code == 200
    assert "materials" in resp.data


def test_teacher_upload_and_flashcards(api_client, teacher_user):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        "/api/teacher/upload/",  # <-- corrected path
        {"title": "Pytest Material", "content": "Heart pumps blood."},
        format="json"
    )
    assert resp.status_code == 201
    material_id = resp.data["material_id"]
    assert Material.objects.filter(id=material_id).exists()
    assert Flashcard.objects.filter(material_id=material_id).exists()


def test_student_queue_and_submit(api_client, student_user):
    client = authenticate(api_client, student_user)
    material = Material.objects.first()
    if not material:
        pytest.skip("No materials available. Run teacher upload first.")
    resp = client.get(f"/api/materials/{material.id}/queue/")  # <-- corrected path
    assert resp.status_code == 200
    queue = resp.data["queue"]
    if queue:
        card = queue[0]
        resp2 = client.post(
            "/api/flashcards/submit/",  # <-- corrected path
            {"flashcard_id": card["id"], "selected_choice": "Z"},
            format="json"
        )
        assert resp2.status_code == 200
        assert "analytics" in resp2.data
