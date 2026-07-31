import os
import django
import pytest
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, QuizSession, QuizAttempt

pytestmark = pytest.mark.django_db


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="quiz_pytest_teacher",
        defaults={"email": "quiz_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def other_teacher(db):
    teacher, _ = User.objects.get_or_create(
        username="quiz_pytest_other_teacher",
        defaults={"email": "other_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="quiz_pytest_student",
        defaults={"email": "quiz_student@test.com", "role": User.ROLE_STUDENT}
    )
    student.set_password("password123")
    student.save()
    return student


@pytest.fixture
def other_student(db):
    student, _ = User.objects.get_or_create(
        username="quiz_pytest_student_2",
        defaults={"email": "quiz_student2@test.com", "role": User.ROLE_STUDENT}
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


def make_mcq(material, correct="A", sub_topic="T"):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice=correct, sub_topic=sub_topic,
    )


def make_basic(material):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_BASIC,
        question="Front", answer="Back", sub_topic="T",
    )


def test_create_quiz_session_with_mcq_cards(api_client, teacher_user, material):
    card1 = make_mcq(material)
    card2 = make_mcq(material)
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        "/api/quizzes/create/",
        {"material": material.id, "title": "Pretest", "quiz_type": "PRETEST", "flashcard_ids": [card1.id, card2.id]},
        format="json",
    )
    assert resp.status_code == 201
    assert resp.data["question_count"] == 2
    assert resp.data["quiz_type"] == "PRETEST"


def test_create_quiz_session_rejects_non_mcq_card(api_client, teacher_user, material):
    basic_card = make_basic(material)
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        "/api/quizzes/create/",
        {"material": material.id, "title": "Quiz", "quiz_type": "QUIZ", "flashcard_ids": [basic_card.id]},
        format="json",
    )
    assert resp.status_code == 400


def test_create_quiz_session_requires_teacher(api_client, student_user, material):
    client = authenticate(api_client, student_user)
    resp = client.post(
        "/api/quizzes/create/",
        {"material": material.id, "title": "Quiz", "quiz_type": "QUIZ", "flashcard_ids": []},
        format="json",
    )
    assert resp.status_code == 403


def test_start_quiz_does_not_leak_correct_choice(api_client, teacher_user, student_user, material):
    card = make_mcq(material)
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, student_user)
    resp = client.post(f"/api/quizzes/{quiz.id}/start/")
    assert resp.status_code == 200
    question = resp.data["questions"][0]
    assert "correct_choice" not in question
    assert question["choices"] == {"A": "a", "B": "b", "C": "c", "D": "d"}


def test_submit_quiz_computes_score(api_client, teacher_user, student_user, material):
    correct_card = make_mcq(material, correct="B")
    wrong_card = make_mcq(material, correct="C")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(correct_card, wrong_card)

    client = authenticate(api_client, student_user)
    client.post(f"/api/quizzes/{quiz.id}/start/")
    resp = client.post(
        f"/api/quizzes/{quiz.id}/submit/",
        {"answers": [
            {"flashcard_id": correct_card.id, "selected_choice": "B"},
            {"flashcard_id": wrong_card.id, "selected_choice": "A"},
        ]},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["score"] == 1
    assert resp.data["total_questions"] == 2
    assert resp.data["score_percentage"] == 50.0


def test_submit_quiz_twice_rejected(api_client, teacher_user, student_user, material):
    card = make_mcq(material, correct="A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, student_user)
    client.post(f"/api/quizzes/{quiz.id}/start/")
    client.post(f"/api/quizzes/{quiz.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "A"}]}, format="json")

    resp = client.post(f"/api/quizzes/{quiz.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "A"}]}, format="json")
    assert resp.status_code == 400


def test_quiz_results_requires_teacher_ownership(api_client, teacher_user, other_teacher, material):
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    client = authenticate(api_client, other_teacher)
    resp = client.get(f"/api/quizzes/{quiz.id}/results/")
    assert resp.status_code == 404  # not this teacher's quiz


def test_improvement_pairs_pretest_and_posttest(api_client, teacher_user, student_user, other_student, material):
    card = make_mcq(material, correct="A")

    pretest = QuizSession.objects.create(material=material, title="Pretest", quiz_type="PRETEST", created_by=teacher_user)
    pretest.flashcards.add(card)
    posttest = QuizSession.objects.create(material=material, title="Posttest", quiz_type="POSTTEST", created_by=teacher_user)
    posttest.flashcards.add(card)

    client = authenticate(api_client, student_user)
    client.post(f"/api/quizzes/{pretest.id}/start/")
    client.post(f"/api/quizzes/{pretest.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "Z"}]}, format="json")  # wrong: 0%
    client.post(f"/api/quizzes/{posttest.id}/start/")
    client.post(f"/api/quizzes/{posttest.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "A"}]}, format="json")  # correct: 100%

    # other_student only takes the pretest — should be excluded from the paired improvement list.
    other_client = authenticate(APIClient(), other_student)
    other_client.post(f"/api/quizzes/{pretest.id}/start/")
    other_client.post(f"/api/quizzes/{pretest.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "A"}]}, format="json")

    teacher_client = authenticate(api_client, teacher_user)
    resp = teacher_client.get(f"/api/materials/{material.id}/quiz-improvement/")
    assert resp.status_code == 200
    assert len(resp.data["students"]) == 1
    row = resp.data["students"][0]
    assert row["username"] == student_user.username
    assert row["pretest_percentage"] == 0.0
    assert row["posttest_percentage"] == 100.0
    assert row["improvement"] == 100.0


def test_available_quiz_sessions_shows_completion_state(api_client, teacher_user, student_user, material):
    card = make_mcq(material, correct="A")
    quiz = QuizSession.objects.create(material=material, title="Quiz", quiz_type="QUIZ", created_by=teacher_user)
    quiz.flashcards.add(card)

    client = authenticate(api_client, student_user)
    resp = client.get("/api/quizzes/available/")
    assert resp.status_code == 200
    entry = next(q for q in resp.data if q["id"] == quiz.id)
    assert entry["completed"] is False
    assert entry["score"] is None

    client.post(f"/api/quizzes/{quiz.id}/start/")
    client.post(f"/api/quizzes/{quiz.id}/submit/", {"answers": [{"flashcard_id": card.id, "selected_choice": "A"}]}, format="json")

    resp2 = client.get("/api/quizzes/available/")
    entry2 = next(q for q in resp2.data if q["id"] == quiz.id)
    assert entry2["completed"] is True
    assert entry2["score"] == 1
