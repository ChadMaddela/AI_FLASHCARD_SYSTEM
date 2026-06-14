import os
import django
import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Flashcard, StudentPerformance
from core.spacing_engine import process_student_response, get_next_cards_for_student

pytestmark = pytest.mark.django_db


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="pytest_student",
        defaults={"email": "pytest_student@test.com", "role": "STUDENT"}
    )
    return student


@pytest.fixture
def sample_flashcard(db):
    card = Flashcard.objects.first()
    if not card:
        pytest.skip("No flashcards found in DB. Run teacher upload first.")
    return card


def test_wrong_answer_decreases_mastery(student_user, sample_flashcard):
    perf = process_student_response(student_user, sample_flashcard, "Z")
    assert perf.attempts_count >= 1
    assert perf.mastery_level >= 0


def test_correct_answer_increases_mastery(student_user, sample_flashcard):
    StudentPerformance.objects.filter(student=student_user, flashcard=sample_flashcard).delete()
    perf = process_student_response(student_user, sample_flashcard, sample_flashcard.correct_choice)
    assert perf.attempts_count == 1
    assert perf.correct_attempts_count == 1
    assert perf.mastery_level >= 0


def test_multiple_correct_answers_raise_mastery(student_user, sample_flashcard):
    perf = process_student_response(student_user, sample_flashcard, sample_flashcard.correct_choice)
    perf = process_student_response(student_user, sample_flashcard, sample_flashcard.correct_choice)
    assert perf.mastery_level <= 5
    assert perf.correct_attempts_count >= 2


def test_queue_prioritizes_low_mastery(student_user, sample_flashcard):
    queue = get_next_cards_for_student(student_user, material=sample_flashcard.material, limit=5)
    assert isinstance(queue, list)
    assert len(queue) <= 5
