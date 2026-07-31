from django.db.models import Sum, Avg, Count, Q
from django.db.models.functions import Coalesce
from django.utils import timezone
from .models import StudentPerformance, User, ConfidenceRating

MASTERY_THRESHOLD = 4  # mastery_level >= 4 counts as "mastered" for stat purposes
MASTERY_LEVELS = range(6)  # 0-5


def _topic_breakdown(perfs_queryset):
    """sub_topic -> {sub_topic, avg_mastery, accuracy_percentage}, weakest average mastery first."""
    rows = (
        perfs_queryset
        .exclude(flashcard__sub_topic__isnull=True)
        .exclude(flashcard__sub_topic="")
        .values("flashcard__sub_topic")
        .annotate(
            avg_mastery=Avg("mastery_level"),
            attempts=Sum("attempts_count"),
            correct=Sum("correct_attempts_count"),
        )
        .order_by("avg_mastery")
    )
    return [
        {
            "sub_topic": row["flashcard__sub_topic"],
            "avg_mastery": round(row["avg_mastery"], 2) if row["avg_mastery"] is not None else 0.0,
            "accuracy_percentage": round((row["correct"] / row["attempts"]) * 100, 1) if row["attempts"] else 0.0,
        }
        for row in rows
    ]


def _confidence_breakdown(ratings_queryset):
    """confidence level -> {confidence, total, accuracy_percentage} — a metacognitive calibration check."""
    rows = ratings_queryset.values("confidence").annotate(
        total=Count("id"), correct=Count("id", filter=Q(is_correct=True))
    )
    return [
        {
            "confidence": row["confidence"],
            "total": row["total"],
            "accuracy_percentage": round((row["correct"] / row["total"]) * 100, 1) if row["total"] else 0.0,
        }
        for row in rows
    ]


def compute_student_analytics(student):
    """Cards seen/mastered/due, overall accuracy, mastery distribution, and per-topic breakdown for one student."""
    perfs = StudentPerformance.objects.filter(student=student)
    now = timezone.now()

    totals = perfs.aggregate(
        total_attempts=Sum("attempts_count"),
        total_correct=Sum("correct_attempts_count"),
        cards_seen=Count("id"),
        cards_mastered=Count("id", filter=Q(mastery_level__gte=MASTERY_THRESHOLD)),
        cards_due=Count("id", filter=Q(due_date__lte=now)),
    )
    total_attempts = totals["total_attempts"] or 0
    total_correct = totals["total_correct"] or 0
    accuracy = round((total_correct / total_attempts) * 100, 1) if total_attempts else 0.0

    distribution_rows = {
        row["mastery_level"]: row["count"]
        for row in perfs.values("mastery_level").annotate(count=Count("id"))
    }
    mastery_distribution = [
        {"mastery_level": level, "count": distribution_rows.get(level, 0)} for level in MASTERY_LEVELS
    ]

    return {
        "cards_seen": totals["cards_seen"] or 0,
        "cards_mastered": totals["cards_mastered"] or 0,
        "cards_due": totals["cards_due"] or 0,
        "accuracy_percentage": accuracy,
        "mastery_distribution": mastery_distribution,
        "topic_breakdown": _topic_breakdown(perfs),
        "confidence_breakdown": _confidence_breakdown(ConfidenceRating.objects.filter(student=student)),
    }


def compute_all_students_summary():
    """One row per STUDENT-role user, including those with zero performance rows, for the teacher's picker list."""
    students = (
        User.objects.filter(role=User.ROLE_STUDENT)
        .annotate(
            total_attempts=Coalesce(Sum("performances__attempts_count"), 0),
            total_correct=Coalesce(Sum("performances__correct_attempts_count"), 0),
            cards_seen=Count("performances", distinct=True),
            cards_mastered=Count(
                "performances", filter=Q(performances__mastery_level__gte=MASTERY_THRESHOLD), distinct=True
            ),
        )
        .order_by("username")
    )
    return [
        {
            "student_id": s.id,
            "username": s.username,
            "accuracy_percentage": round((s.total_correct / s.total_attempts) * 100, 1) if s.total_attempts else 0.0,
            "cards_seen": s.cards_seen,
            "cards_mastered": s.cards_mastered,
        }
        for s in students
    ]


def compute_class_analytics():
    """Aggregate stats across all students: student_count, class_accuracy_percentage, topic_breakdown."""
    perfs = StudentPerformance.objects.filter(student__role=User.ROLE_STUDENT)
    totals = perfs.aggregate(
        total_attempts=Sum("attempts_count"),
        total_correct=Sum("correct_attempts_count"),
    )
    total_attempts = totals["total_attempts"] or 0
    total_correct = totals["total_correct"] or 0
    class_accuracy = round((total_correct / total_attempts) * 100, 1) if total_attempts else 0.0

    return {
        "student_count": User.objects.filter(role=User.ROLE_STUDENT).count(),
        "class_accuracy_percentage": class_accuracy,
        "topic_breakdown": _topic_breakdown(perfs),
        "confidence_breakdown": _confidence_breakdown(
            ConfidenceRating.objects.filter(student__role=User.ROLE_STUDENT)
        ),
    }
