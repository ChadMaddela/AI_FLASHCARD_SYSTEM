from django.utils import timezone
from .models import StudentPerformance, Flashcard, User

def process_student_response(student: User, flashcard: Flashcard, selected_choice: str) -> StudentPerformance:
    """
    Evaluates the student's answer, adjusts their mastery metrics,
    and handles the personalized adaptive learning logic.
    """
    # 1. Fetch or initialize the tracking profile for this student/card combination
    performance, created = StudentPerformance.objects.get_or_create(
        student=student,
        flashcard=flashcard,
        defaults={'mastery_level': 0, 'attempts_count': 0, 'correct_attempts_count': 0}
    )

    # 2. Determine if the student selected the correct multiple-choice option
    is_correct = (selected_choice.strip().upper() == flashcard.correct_choice.strip().upper())

    # 3. Update counters
    performance.attempts_count += 1
    if is_correct:
        performance.correct_attempts_count += 1
        # Increase mastery level up to a maximum ceiling of 5
        if performance.mastery_level < 5:
            performance.mastery_level += 1
    else:
        # Penalize mastery level if they fail, forcing it to drop down (minimum floor of 0)
        if performance.mastery_level > 0:
            performance.mastery_level -= 1
        else:
            performance.mastery_level = 0

    # 4. Save updates to DB
    performance.save()
    return performance


def get_next_cards_for_student(student: User, material=None, limit=10):
    """
    The core selection engine. Pulls multiple choice questions prioritizing
    sub-topics where the student's mastery level is low.
    """
    # Fetch cards belonging to the selected material module
    base_cards = Flashcard.objects.all()
    if material:
        base_cards = base_cards.filter(material=material)

    # Get all performances logged by this student
    student_perf = StudentPerformance.objects.filter(student=student)

    # Build a lookup dictionary map of card_id -> mastery_level
    mastery_map = {p.flashcard_id: p.mastery_level for p in student_perf}

    # Sort the available cards manually based on user mastery
    # Cards with lower mastery (e.g., Level 0) or completely unreviewed cards take absolute priority
    def sorting_key(card):
        # If unreviewed, give it a 0 score so it bubbles up to the top immediately
        return mastery_map.get(card.id, 0)

    sorted_cards = sorted(base_cards, key=sorting_key)
    return sorted_cards[:limit]
