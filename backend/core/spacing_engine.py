from datetime import timedelta
from django.db.models import Avg, Sum
from django.utils import timezone
from .models import StudentPerformance, Flashcard, User

MIN_EASE_FACTOR = 1.3
NEW_CARD_BASE_LIMIT = 10
DEFAULT_TOPIC_MASTERY = 2.5  # midpoint of the 0-5 mastery scale
LEARNING_STEPS_MINUTES = [1, 10]  # Anki-style short-term steps before a card graduates to day-based review

# Self-graded recall quality (BASIC cards) mapped onto the classic SM-2 0-5 scale.
GRADE_TO_QUALITY = {
    "again": 0,
    "hard": 3,
    "good": 4,
    "easy": 5,
}
MCQ_CORRECT_QUALITY = 4
MCQ_INCORRECT_QUALITY = 1


def _advance_learning_step(performance: StudentPerformance, quality: int, now) -> None:
    """Mutates a still-learning card's step/due_date. Graduates it into review mode on the last step."""
    if quality < 3:
        performance.learning_step = 0
        performance.due_date = now + timedelta(minutes=LEARNING_STEPS_MINUTES[0])
        return

    next_step = performance.learning_step + 1
    if next_step < len(LEARNING_STEPS_MINUTES):
        performance.learning_step = next_step
        performance.due_date = now + timedelta(minutes=LEARNING_STEPS_MINUTES[next_step])
    else:
        performance.is_learning = False
        performance.learning_step = 0
        performance.repetitions = 1
        performance.interval_days = 1
        performance.due_date = now + timedelta(days=1)


def _sm2_update(performance: StudentPerformance, quality: int) -> None:
    """
    Mutates performance in place. Cards still in short-term learning use a fixed
    sequence of minute-scale steps (so a missed card resurfaces later in the same
    session); graduated cards use the day-based SM-2 algorithm (quality 0-5). Ease
    factor only applies to graduated cards, matching classic SM-2/Anki — learning
    steps ignore it entirely.
    """
    now = timezone.now()

    if performance.is_learning:
        _advance_learning_step(performance, quality, now)
        return

    if quality < 3:
        # A graduated card was missed — drop back into short-term relearning instead
        # of jumping straight to "tomorrow", so it gets same-session re-drill.
        performance.is_learning = True
        performance.repetitions = 0
        _advance_learning_step(performance, quality, now)
    else:
        performance.repetitions += 1
        if performance.repetitions == 1:
            performance.interval_days = 1
        elif performance.repetitions == 2:
            performance.interval_days = 6
        else:
            performance.interval_days = round(performance.interval_days * performance.ease_factor, 2)
        performance.due_date = now + timedelta(days=performance.interval_days)

    new_ease = performance.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    performance.ease_factor = max(MIN_EASE_FACTOR, round(new_ease, 2))


def _update_mastery_display(performance: StudentPerformance, quality: int) -> None:
    """Keeps the 0-5 mastery gauge used for UI display, independent of the SM-2 schedule."""
    if quality >= 3:
        if performance.mastery_level < 5:
            performance.mastery_level += 1
    else:
        if performance.mastery_level > 0:
            performance.mastery_level -= 1


def process_student_response(student: User, flashcard: Flashcard, selected_choice: str = None, grade: str = None) -> StudentPerformance:
    """
    Evaluates the student's response (an MCQ choice or a self-graded recall rating),
    updates the mastery display gauge, and reschedules the card via SM-2.
    """
    performance, _ = StudentPerformance.objects.get_or_create(
        student=student,
        flashcard=flashcard,
        defaults={
            'mastery_level': 0, 'attempts_count': 0, 'correct_attempts_count': 0,
            'ease_factor': 2.5, 'interval_days': 0, 'repetitions': 0,
            'is_learning': True, 'learning_step': 0,
        }
    )

    if flashcard.card_type in (Flashcard.CARD_TYPE_BASIC, Flashcard.CARD_TYPE_CLOZE):
        quality = GRADE_TO_QUALITY.get((grade or "").lower(), 3)
        is_correct = quality >= 3
    else:
        is_correct = bool(selected_choice) and (selected_choice.strip().upper() == flashcard.correct_choice.strip().upper())
        quality = MCQ_CORRECT_QUALITY if is_correct else MCQ_INCORRECT_QUALITY

    performance.attempts_count += 1
    if is_correct:
        performance.correct_attempts_count += 1

    _update_mastery_display(performance, quality)
    _sm2_update(performance, quality)
    performance.save()

    # Transient, not persisted — lets the view report correctness without re-deriving it.
    performance.is_correct = is_correct
    return performance


def _topic_mastery_map(student: User) -> dict:
    """sub_topic -> average mastery_level across cards the student has already reviewed."""
    rows = (
        StudentPerformance.objects.filter(student=student)
        .exclude(flashcard__sub_topic__isnull=True)
        .exclude(flashcard__sub_topic="")
        .values("flashcard__sub_topic")
        .annotate(avg_mastery=Avg("mastery_level"))
    )
    return {row["flashcard__sub_topic"]: row["avg_mastery"] for row in rows}


def _new_card_cap(student: User) -> int:
    """Throttle new-card intake for students who are currently struggling overall."""
    agg = StudentPerformance.objects.filter(student=student).aggregate(
        total_attempts=Sum("attempts_count"), total_correct=Sum("correct_attempts_count")
    )
    total_attempts = agg["total_attempts"] or 0
    if total_attempts == 0:
        return NEW_CARD_BASE_LIMIT  # no history yet — don't throttle a brand new student

    accuracy = (agg["total_correct"] or 0) / total_attempts * 100
    if accuracy < 50:
        return 3
    if accuracy < 75:
        return 6
    return NEW_CARD_BASE_LIMIT


def get_next_cards_for_student(student: User, material=None, sub_topic=None, limit=10):
    """
    The core selection engine. Cards due for review (due_date already passed, earliest first)
    always take priority. Never-seen cards fill any remaining slots, ordered toward the
    student's weakest sub-topics first and capped by their current overall performance —
    students who are struggling get fewer new cards piled on top of their due reviews.
    """
    now = timezone.now()

    base_cards = Flashcard.objects.all()
    if material:
        base_cards = base_cards.filter(material=material)
    if sub_topic:
        base_cards = base_cards.filter(sub_topic=sub_topic)

    perf_map = {
        p.flashcard_id: p
        for p in StudentPerformance.objects.filter(student=student, flashcard__in=base_cards)
    }

    due_cards = []
    new_cards = []
    for card in base_cards:
        perf = perf_map.get(card.id)
        if perf is None:
            new_cards.append(card)
        elif perf.due_date <= now:
            due_cards.append((perf.due_date, card))

    due_cards.sort(key=lambda pair: pair[0])
    ordered_due = [card for _, card in due_cards]

    topic_mastery = _topic_mastery_map(student)
    new_cards.sort(key=lambda c: topic_mastery.get(c.sub_topic, DEFAULT_TOPIC_MASTERY))

    remaining_slots = max(0, limit - len(ordered_due))
    cap = _new_card_cap(student)
    new_cards = new_cards[:min(remaining_slots, cap)]

    ordered = ordered_due + new_cards
    return ordered[:limit]
