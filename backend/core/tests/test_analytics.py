import os
import django
import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, StudentPerformance
from core import analytics

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="analytics_pytest_teacher",
        defaults={"email": "analytics_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="analytics_pytest_student",
        defaults={"email": "analytics_student@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


@pytest.fixture
def other_student_user(db):
    student, _ = User.objects.get_or_create(
        username="analytics_pytest_student_2",
        defaults={"email": "analytics_student2@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


def authenticate(client, user, password="password123"):
    resp = client.post("/api/token/", {"username": user.username, "password": password})
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


def make_mcq(material, sub_topic):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice="A", sub_topic=sub_topic,
    )


def test_compute_student_analytics_math(teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    card1 = make_mcq(material, "Heart")
    card2 = make_mcq(material, "Heart")
    card3 = make_mcq(material, "Lungs")

    StudentPerformance.objects.create(
        student=student_user, flashcard=card1, attempts_count=4, correct_attempts_count=2, mastery_level=2,
        due_date=timezone.now() - timedelta(days=1),
    )
    StudentPerformance.objects.create(
        student=student_user, flashcard=card2, attempts_count=6, correct_attempts_count=6, mastery_level=5,
        due_date=timezone.now() + timedelta(days=5),
    )
    StudentPerformance.objects.create(
        student=student_user, flashcard=card3, attempts_count=0, correct_attempts_count=0, mastery_level=0,
        due_date=timezone.now() - timedelta(hours=1),
    )

    result = analytics.compute_student_analytics(student_user)

    assert result["cards_seen"] == 3
    assert result["cards_mastered"] == 1  # only card2 has mastery_level >= 4
    assert result["cards_due"] == 2  # card1 and card3
    assert result["accuracy_percentage"] == 80.0  # 8 correct / 10 attempts

    heart_row = next(r for r in result["topic_breakdown"] if r["sub_topic"] == "Heart")
    assert heart_row["avg_mastery"] == 3.5  # (2 + 5) / 2

    assert len(result["mastery_distribution"]) == 6  # levels 0-5, all present even if zero


def test_class_analytics_excludes_teachers(teacher_user, student_user):
    material = Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)
    student_card = make_mcq(material, "Topic")
    StudentPerformance.objects.create(
        student=student_user, flashcard=student_card, attempts_count=2, correct_attempts_count=1, mastery_level=1,
    )
    # A teacher account somehow having a StudentPerformance row (edge case) must not pollute class stats.
    StudentPerformance.objects.create(
        student=teacher_user, flashcard=student_card, attempts_count=100, correct_attempts_count=0, mastery_level=0,
    )

    result = analytics.compute_class_analytics()
    assert result["student_count"] == 1
    assert result["class_accuracy_percentage"] == 50.0  # only the student's 1/2, not the teacher's 0/100


def test_summary_includes_student_with_zero_performance(teacher_user, student_user, other_student_user):
    summary = analytics.compute_all_students_summary()
    usernames = {row["username"] for row in summary}
    assert other_student_user.username in usernames
    zero_row = next(r for r in summary if r["username"] == other_student_user.username)
    assert zero_row["cards_seen"] == 0
    assert zero_row["accuracy_percentage"] == 0.0


def test_student_analytics_detail_404s_for_teacher_id(api_client, teacher_user):
    client = authenticate(api_client, teacher_user)
    resp = client.get(f"/api/analytics/students/{teacher_user.id}/")
    assert resp.status_code == 404


def test_analytics_endpoints_require_teacher(api_client, student_user):
    client = authenticate(api_client, student_user)
    assert client.get("/api/analytics/students/").status_code == 403
    assert client.get("/api/analytics/class/").status_code == 403
    assert client.get(f"/api/analytics/students/{student_user.id}/").status_code == 403


def test_my_analytics_works_for_any_authenticated_user(api_client, student_user):
    client = authenticate(api_client, student_user)
    resp = client.get("/api/analytics/me/")
    assert resp.status_code == 200
    assert "accuracy_percentage" in resp.data
