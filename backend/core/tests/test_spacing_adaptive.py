import os
import django
import pytest
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard, StudentPerformance
from core.spacing_engine import get_next_cards_for_student, process_student_response, LEARNING_STEPS_MINUTES

pytestmark = pytest.mark.django_db


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="adaptive_pytest_teacher",
        defaults={"email": "adaptive_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    return teacher


@pytest.fixture
def student_user(db):
    student, _ = User.objects.get_or_create(
        username="adaptive_pytest_student",
        defaults={"email": "adaptive_student@test.com", "role": User.ROLE_STUDENT}
    )
    return student


def make_mcq(material, sub_topic, question="Q"):
    return Flashcard.objects.create(
        material=material, card_type=Flashcard.CARD_TYPE_MCQ, question=question,
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice="A", sub_topic=sub_topic,
    )


def test_weak_topic_new_cards_surface_before_strong_topic_new_cards(teacher_user, student_user):
    material = Material.objects.create(title="Adaptive Material", content_text="x", uploaded_by=teacher_user)
    future_due = timezone.now() + timedelta(days=30)

    # Establish topic mastery history (not due, so these don't appear in the queue themselves).
    weak_reviewed = make_mcq(material, "Weak Topic", "already reviewed weak")
    StudentPerformance.objects.create(student=student_user, flashcard=weak_reviewed, mastery_level=0, due_date=future_due)
    strong_reviewed = make_mcq(material, "Strong Topic", "already reviewed strong")
    StudentPerformance.objects.create(student=student_user, flashcard=strong_reviewed, mastery_level=5, due_date=future_due)

    # Never-seen cards in each topic.
    weak_new = make_mcq(material, "Weak Topic", "new weak card")
    strong_new = make_mcq(material, "Strong Topic", "new strong card")

    queue = get_next_cards_for_student(student_user, material=material, limit=10)
    queue_ids = [c.id for c in queue]

    assert weak_new.id in queue_ids and strong_new.id in queue_ids
    assert queue_ids.index(weak_new.id) < queue_ids.index(strong_new.id)


def test_new_card_intake_capped_for_struggling_student(teacher_user, student_user):
    history_material = Material.objects.create(title="History Material", content_text="x", uploaded_by=teacher_user)
    history_card = make_mcq(history_material, "History Topic")
    StudentPerformance.objects.create(
        student=student_user, flashcard=history_card,
        attempts_count=10, correct_attempts_count=2,  # 20% accuracy -> struggling -> cap of 3
        mastery_level=1, due_date=timezone.now() + timedelta(days=30),
    )

    test_material = Material.objects.create(title="Test Material", content_text="x", uploaded_by=teacher_user)
    for i in range(15):
        make_mcq(test_material, "Test Topic", f"new card {i}")

    queue = get_next_cards_for_student(student_user, material=test_material, limit=10)
    assert len(queue) == 3


def test_new_card_intake_not_capped_for_new_student(teacher_user, student_user):
    material = Material.objects.create(title="Fresh Material", content_text="x", uploaded_by=teacher_user)
    for i in range(15):
        make_mcq(material, "Topic", f"card {i}")

    queue = get_next_cards_for_student(student_user, material=material, limit=10)
    assert len(queue) == 10


def test_first_correct_answer_stays_in_learning(teacher_user, student_user):
    material = Material.objects.create(title="Learning Material", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, "Topic")

    perf = process_student_response(student_user, card, selected_choice="A")  # correct

    assert perf.is_learning is True
    assert perf.learning_step == 1
    assert perf.due_date <= timezone.now() + timedelta(minutes=LEARNING_STEPS_MINUTES[1] + 1)
    assert perf.due_date > timezone.now() + timedelta(minutes=LEARNING_STEPS_MINUTES[1] - 1)


def test_card_graduates_after_completing_learning_steps(teacher_user, student_user):
    material = Material.objects.create(title="Learning Material", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, "Topic")

    process_student_response(student_user, card, selected_choice="A")  # 1st correct: step 0 -> 1
    perf = process_student_response(student_user, card, selected_choice="A")  # 2nd correct: graduates

    assert perf.is_learning is False
    assert perf.learning_step == 0
    assert perf.repetitions == 1
    assert perf.interval_days == 1


def test_miss_while_learning_resets_to_first_step(teacher_user, student_user):
    material = Material.objects.create(title="Learning Material", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, "Topic")

    process_student_response(student_user, card, selected_choice="A")  # correct: advances to step 1
    perf = process_student_response(student_user, card, selected_choice="Z")  # wrong: back to step 0

    assert perf.is_learning is True
    assert perf.learning_step == 0
    assert perf.due_date <= timezone.now() + timedelta(minutes=LEARNING_STEPS_MINUTES[0] + 1)


def test_graduated_card_lapse_reenters_learning_instead_of_tomorrow(teacher_user, student_user):
    """The core fix: missing an already-graduated card should resurface in ~1 minute, not ~1 day."""
    material = Material.objects.create(title="Graduated Material", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, "Topic")
    StudentPerformance.objects.create(
        student=student_user, flashcard=card,
        is_learning=False, repetitions=3, interval_days=15, ease_factor=2.5,
        due_date=timezone.now(),
    )

    perf = process_student_response(student_user, card, selected_choice="Z")  # wrong answer

    assert perf.is_learning is True
    assert perf.learning_step == 0
    # Must be minutes away, not ~1 day away like the old behavior.
    assert perf.due_date < timezone.now() + timedelta(minutes=LEARNING_STEPS_MINUTES[0] + 5)


def test_missed_card_reappears_in_queue_once_its_short_due_date_passes(teacher_user, student_user):
    """Integration check: the same-session resurfacing actually works through the real queue function."""
    material = Material.objects.create(title="Session Material", content_text="x", uploaded_by=teacher_user)
    card = make_mcq(material, "Topic")

    perf = process_student_response(student_user, card, selected_choice="Z")  # wrong -> due in ~1 minute
    assert card.id not in [c.id for c in get_next_cards_for_student(student_user, material=material, limit=10)]

    # Simulate "a minute later" within the same session.
    perf.due_date = timezone.now() - timedelta(seconds=1)
    perf.save()

    queue_ids = [c.id for c in get_next_cards_for_student(student_user, material=material, limit=10)]
    assert card.id in queue_ids
