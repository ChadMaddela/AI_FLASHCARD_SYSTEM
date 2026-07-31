"""
Philippine-education-standard assessment reports (Table of Specifications,
Item Analysis, Competency Mastery) computed on-demand from a QuizSession's
completed attempts/answers. Nothing here is persisted — these are pure
read-time computations, mirroring the style of analytics.py.
"""
from .models import Flashcard

UNCATEGORIZED = "Uncategorized"

BLOOM_LEVELS = [
    Flashcard.BLOOM_REMEMBERING,
    Flashcard.BLOOM_UNDERSTANDING,
    Flashcard.BLOOM_APPLYING,
    Flashcard.BLOOM_ANALYZING,
    Flashcard.BLOOM_EVALUATING,
    Flashcard.BLOOM_CREATING,
]

UPPER_LOWER_GROUP_FRACTION = 0.27


def _difficulty_label(p):
    if p >= 0.76:
        return "Easy"
    if p >= 0.26:
        return "Average"
    return "Difficult"


def _discrimination_label(d):
    if d >= 0.40:
        return "Excellent"
    if d >= 0.30:
        return "Good"
    if d >= 0.20:
        return "Marginal"
    return "Poor"


def _mps_mastery_label(pct):
    """DepEd Mean Percentage Score (MPS) mastery descriptor scale."""
    if pct >= 96:
        return "Mastered"
    if pct >= 86:
        return "Closely Approximating Mastery"
    if pct >= 66:
        return "Moving Towards Mastery"
    if pct >= 35:
        return "Average"
    if pct >= 15:
        return "Low"
    if pct >= 5:
        return "Very Low"
    return "Absolutely No Mastery"


BELOW_MASTERY_LABELS = {"Moving Towards Mastery", "Average", "Low", "Very Low", "Absolutely No Mastery"}


def compute_item_analysis(quiz_session):
    """
    Difficulty index, discrimination index (upper/lower 27%), and per-choice
    distractor breakdown for every MCQ item in the quiz, from completed
    attempts only.
    """
    attempts = list(quiz_session.attempts.filter(completed_at__isnull=False))
    n = len(attempts)

    attempts_sorted = sorted(attempts, key=lambda a: a.score_percentage, reverse=True)
    group_size = max(1, round(n * UPPER_LOWER_GROUP_FRACTION)) if n else 0
    upper_ids = {a.id for a in attempts_sorted[:group_size]}
    lower_ids = {a.id for a in attempts_sorted[-group_size:]} if group_size else set()
    insufficient_data = n < 2

    flashcards = list(quiz_session.flashcards.all().order_by("id"))
    items = []
    for card in flashcards:
        answers = list(card.quiz_answers.filter(quiz_attempt_id__in=[a.id for a in attempts]))
        total = len(answers)
        correct = sum(1 for ans in answers if ans.is_correct)
        difficulty_index = round(correct / total, 2) if total else 0.0

        if insufficient_data or not total:
            discrimination_index = None
        else:
            correct_upper = sum(1 for ans in answers if ans.quiz_attempt_id in upper_ids and ans.is_correct)
            correct_lower = sum(1 for ans in answers if ans.quiz_attempt_id in lower_ids and ans.is_correct)
            discrimination_index = round((correct_upper - correct_lower) / group_size, 2)

        distractors = []
        for letter, choice_field in (("A", card.choice_a), ("B", card.choice_b), ("C", card.choice_c), ("D", card.choice_d)):
            is_correct_choice = letter == card.correct_choice.strip().upper()
            picked = [ans for ans in answers if ans.selected_choice == letter]
            picked_count = len(picked)
            distractors.append({
                "choice": letter,
                "text": choice_field,
                "is_correct": is_correct_choice,
                "count": picked_count,
                "percentage": round((picked_count / total) * 100, 1) if total else 0.0,
                "upper_count": sum(1 for ans in picked if ans.quiz_attempt_id in upper_ids),
                "lower_count": sum(1 for ans in picked if ans.quiz_attempt_id in lower_ids),
                "flagged_non_functional": (not is_correct_choice) and total > 0 and picked_count == 0,
            })

        items.append({
            "flashcard_id": card.id,
            "question": card.question,
            "sub_topic": card.sub_topic or UNCATEGORIZED,
            "bloom_level": card.bloom_level,
            "total_attempts": total,
            "difficulty_index": difficulty_index,
            "difficulty_label": _difficulty_label(difficulty_index),
            "discrimination_index": discrimination_index,
            "discrimination_label": _discrimination_label(discrimination_index) if discrimination_index is not None else None,
            "distractors": distractors,
        })

    return {
        "quiz_id": quiz_session.id,
        "quiz_title": quiz_session.title,
        "completed_attempts": n,
        "insufficient_data_for_discrimination": insufficient_data,
        "items": items,
    }


def compute_competency_mastery(quiz_session):
    """Per sub-topic average mastery (DepEd MPS scale) across completed attempts of this quiz."""
    attempts = list(quiz_session.attempts.filter(completed_at__isnull=False))
    flashcards = list(quiz_session.flashcards.all())

    cards_by_topic = {}
    for card in flashcards:
        cards_by_topic.setdefault(card.sub_topic or UNCATEGORIZED, []).append(card)

    topics = []
    for sub_topic, cards in cards_by_topic.items():
        card_ids = {c.id for c in cards}
        item_count = len(cards)

        per_student = []
        for attempt in attempts:
            answers = attempt.answers.filter(flashcard_id__in=card_ids)
            correct = sum(1 for a in answers if a.is_correct)
            score_percentage = round((correct / item_count) * 100, 2) if item_count else 0.0
            per_student.append({
                "student_id": attempt.student_id,
                "username": attempt.student.username,
                "score_percentage": score_percentage,
            })

        avg_score = round(sum(s["score_percentage"] for s in per_student) / len(per_student), 2) if per_student else 0.0
        below_mastery = sorted(
            [s for s in per_student if _mps_mastery_label(s["score_percentage"]) in BELOW_MASTERY_LABELS],
            key=lambda s: s["score_percentage"],
        )

        topics.append({
            "sub_topic": sub_topic,
            "item_count": item_count,
            "students_assessed": len(per_student),
            "avg_score_percentage": avg_score,
            "mastery_level": _mps_mastery_label(avg_score),
            "students_below_mastery": [{"student_id": s["student_id"], "username": s["username"], "score_percentage": s["score_percentage"]} for s in below_mastery],
        })

    topics.sort(key=lambda t: t["avg_score_percentage"])

    return {
        "quiz_id": quiz_session.id,
        "quiz_title": quiz_session.title,
        "completed_attempts": len(attempts),
        "topics": topics,
    }


def compute_tos(quiz_session, hours_by_sub_topic):
    """
    Table of Specifications: hours-weighted ideal item distribution vs. the
    quiz's actual item distribution, per topic and per Bloom's level.
    hours_by_sub_topic must contain at least one positive value.
    """
    cleaned_hours = {}
    for sub_topic, hours in (hours_by_sub_topic or {}).items():
        try:
            hours_value = float(hours)
        except (TypeError, ValueError):
            raise ValueError(f"Invalid hours value for '{sub_topic}'.")
        if hours_value < 0:
            raise ValueError(f"Hours for '{sub_topic}' cannot be negative.")
        cleaned_hours[sub_topic or UNCATEGORIZED] = hours_value

    total_hours = sum(cleaned_hours.values())
    if total_hours <= 0:
        raise ValueError("Provide at least one topic with hours greater than zero.")

    flashcards = list(quiz_session.flashcards.all())
    total_items = len(flashcards)

    cards_by_topic = {}
    for card in flashcards:
        cards_by_topic.setdefault(card.sub_topic or UNCATEGORIZED, []).append(card)

    all_topic_names = set(cleaned_hours) | set(cards_by_topic)

    topics = []
    for sub_topic in all_topic_names:
        hours = cleaned_hours.get(sub_topic, 0.0)
        percentage_weight = round((hours / total_hours) * 100, 2) if total_hours else 0.0
        ideal_item_count = round((percentage_weight / 100) * total_items) if total_items else 0

        cards = cards_by_topic.get(sub_topic, [])
        bloom_breakdown = {level: 0 for level in BLOOM_LEVELS}
        for card in cards:
            if card.bloom_level in bloom_breakdown:
                bloom_breakdown[card.bloom_level] += 1

        topics.append({
            "sub_topic": sub_topic,
            "hours": hours,
            "percentage_weight": percentage_weight,
            "ideal_item_count": ideal_item_count,
            "actual_item_count": len(cards),
            "bloom_breakdown": bloom_breakdown,
        })

    topics.sort(key=lambda t: t["sub_topic"])

    return {
        "quiz_id": quiz_session.id,
        "quiz_title": quiz_session.title,
        "total_items": total_items,
        "total_hours": total_hours,
        "topics": topics,
    }
