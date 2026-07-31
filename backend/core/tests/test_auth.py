import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User

pytestmark = pytest.mark.django_db

STRONG_PASSWORD = "Xk9$mQr2vLpz!"


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="auth_pytest_teacher",
        defaults={"email": "auth_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="auth_pytest_student",
        defaults={"email": "auth_student@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


def authenticate(client, user, password="password123"):
    resp = client.post("/api/token/", {"username": user.username, "password": password})
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


def test_register_creates_student_even_if_role_teacher_requested(api_client):
    resp = api_client.post(
        "/api/register/",
        {
            "username": "new_recruit",
            "email": "new_recruit@test.com",
            "password": STRONG_PASSWORD,
            "role": "TEACHER",  # must be ignored — self-registration is always STUDENT
        },
        format="json",
    )
    assert resp.status_code == 201
    user = User.objects.get(username="new_recruit")
    assert user.role == User.ROLE_STUDENT
    assert user.check_password(STRONG_PASSWORD)


def test_register_duplicate_username_rejected(api_client, student_user):
    resp = api_client.post(
        "/api/register/",
        {"username": student_user.username, "password": STRONG_PASSWORD},
        format="json",
    )
    assert resp.status_code == 400


def test_list_users_requires_teacher(api_client, student_user):
    client = authenticate(api_client, student_user)
    resp = client.get("/api/users/")
    assert resp.status_code == 403


def test_update_user_requires_teacher(api_client, student_user):
    client = authenticate(api_client, student_user)
    resp = client.put(f"/api/users/{student_user.id}/update/", {"role": "TEACHER"}, format="json")
    assert resp.status_code == 403


def test_teacher_can_promote_student_to_teacher(api_client, teacher_user, student_user):
    client = authenticate(api_client, teacher_user)
    resp = client.put(f"/api/users/{student_user.id}/update/", {"role": "TEACHER"}, format="json")
    assert resp.status_code == 200

    list_resp = client.get("/api/users/")
    assert list_resp.status_code == 200
    promoted = next(u for u in list_resp.data if u["id"] == student_user.id)
    assert promoted["role"] == "TEACHER"

    student_user.refresh_from_db()
    assert student_user.role == User.ROLE_TEACHER
