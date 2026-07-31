from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):
    """Custom User model with Teacher/Student roles."""
    ROLE_STUDENT = "STUDENT"
    ROLE_TEACHER = "TEACHER"
    ROLE_CHOICES = (
        (ROLE_TEACHER, 'Teacher'),
        (ROLE_STUDENT, 'Student'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default=ROLE_STUDENT)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Material(models.Model):
    """Stores teacher-uploaded reference materials."""
    STATUS_PENDING = "PENDING"
    STATUS_PROCESSING = "PROCESSING"
    STATUS_DONE = "DONE"
    STATUS_FAILED = "FAILED"
    GENERATION_STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_PROCESSING, "Processing"),
        (STATUS_DONE, "Done"),
        (STATUS_FAILED, "Failed"),
    )

    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    content_text = models.TextField(help_text="Extracted text or presentation text.")
    file_url = models.URLField(max_length=500, blank=True, null=True)  # ✅ Supabase public link
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'TEACHER'})
    created_at = models.DateTimeField(auto_now_add=True)

    # Async flashcard generation status (Celery task tracks this).
    generation_status = models.CharField(max_length=12, choices=GENERATION_STATUS_CHOICES, default=STATUS_DONE)
    generation_error = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.title


class Flashcard(models.Model):
    """Flashcards generated automatically by Gemini: MCQs, front/back recall cards, or cloze deletions."""
    CARD_TYPE_MCQ = "MCQ"
    CARD_TYPE_BASIC = "BASIC"
    CARD_TYPE_CLOZE = "CLOZE"
    CARD_TYPE_CHOICES = (
        (CARD_TYPE_MCQ, "Multiple Choice"),
        (CARD_TYPE_BASIC, "Basic Front/Back"),
        (CARD_TYPE_CLOZE, "Cloze Deletion"),
    )

    BLOOM_REMEMBERING = "REMEMBERING"
    BLOOM_UNDERSTANDING = "UNDERSTANDING"
    BLOOM_APPLYING = "APPLYING"
    BLOOM_ANALYZING = "ANALYZING"
    BLOOM_EVALUATING = "EVALUATING"
    BLOOM_CREATING = "CREATING"
    BLOOM_LEVEL_CHOICES = (
        (BLOOM_REMEMBERING, "Remembering"),
        (BLOOM_UNDERSTANDING, "Understanding"),
        (BLOOM_APPLYING, "Applying"),
        (BLOOM_ANALYZING, "Analyzing"),
        (BLOOM_EVALUATING, "Evaluating"),
        (BLOOM_CREATING, "Creating"),
    )

    card_type = models.CharField(max_length=10, choices=CARD_TYPE_CHOICES, default=CARD_TYPE_MCQ)
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='flashcards')
    question = models.TextField(help_text="Front of the card / MCQ question stem.")
    answer = models.TextField(blank=True, null=True, help_text="Back of the card. Only used by BASIC cards.")
    choice_a = models.TextField(blank=True, default="")
    choice_b = models.TextField(blank=True, default="")
    choice_c = models.TextField(blank=True, default="")
    choice_d = models.TextField(blank=True, default="")
    correct_choice = models.CharField(max_length=1, blank=True, default="A")
    sub_topic = models.CharField(max_length=100, blank=True, null=True)
    image_url = models.URLField(max_length=500, blank=True, null=True, help_text="Optional illustrative image (manually attached or auto-matched from the source material).")
    bloom_level = models.CharField(max_length=15, choices=BLOOM_LEVEL_CHOICES, blank=True, null=True, help_text="Bloom's Revised Taxonomy cognitive level. Teacher-facing only, never exposed to students.")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.card_type} #{self.id} for {self.material.title}"


class StudentPerformance(models.Model):
    """Tracks student performance on flashcards for adaptive learning."""
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'STUDENT'}, related_name='performances')
    flashcard = models.ForeignKey(Flashcard, on_delete=models.CASCADE, related_name='student_history')

    attempts_count = models.IntegerField(default=0)
    correct_attempts_count = models.IntegerField(default=0)
    mastery_level = models.IntegerField(default=0, help_text="Range 0 (Struggling) to 5 (Mastered)")
    last_reviewed = models.DateTimeField(auto_now=True)

    # Spaced-repetition scheduling (SM-2 algorithm)
    due_date = models.DateTimeField(default=timezone.now, help_text="When this card is next due for review.")
    ease_factor = models.FloatField(default=2.5)
    interval_days = models.FloatField(default=0)
    repetitions = models.IntegerField(default=0)
    is_learning = models.BooleanField(default=True, help_text="Still in short-term learning steps, not yet graduated to day-based review.")
    learning_step = models.IntegerField(default=0, help_text="Index into the learning-steps list while is_learning is True.")

    class Meta:
        unique_together = ('student', 'flashcard')

    @property
    def accuracy_percentage(self):
        if self.attempts_count == 0:
            return 0.0
        return round((self.correct_attempts_count / self.attempts_count) * 100, 2)

    def __str__(self):
        return f"{self.student.username} - Card #{self.flashcard.id} (Mastery: {self.mastery_level})"


class ConfidenceRating(models.Model):
    """Logs a student's self-rated confidence on a card, checked against actual correctness."""
    CONFIDENCE_GUESSING = "GUESSING"
    CONFIDENCE_UNSURE = "UNSURE"
    CONFIDENCE_CONFIDENT = "CONFIDENT"
    CONFIDENCE_CHOICES = (
        (CONFIDENCE_GUESSING, "Guessing"),
        (CONFIDENCE_UNSURE, "Unsure"),
        (CONFIDENCE_CONFIDENT, "Confident"),
    )

    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name="confidence_ratings")
    flashcard = models.ForeignKey(Flashcard, on_delete=models.CASCADE, related_name="confidence_ratings")
    confidence = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES)
    is_correct = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student.username} - Card #{self.flashcard.id}: {self.confidence} ({'correct' if self.is_correct else 'incorrect'})"


class QuizSession(models.Model):
    """A bounded, one-time MCQ assessment (pretest/posttest/quiz) distinct from ongoing spaced-repetition practice."""
    TYPE_PRETEST = "PRETEST"
    TYPE_POSTTEST = "POSTTEST"
    TYPE_QUIZ = "QUIZ"
    TYPE_CHOICES = (
        (TYPE_PRETEST, "Pretest"),
        (TYPE_POSTTEST, "Posttest"),
        (TYPE_QUIZ, "Quiz"),
    )

    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="quiz_sessions")
    title = models.CharField(max_length=255)
    quiz_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_QUIZ)
    flashcards = models.ManyToManyField(Flashcard, related_name="quiz_sessions")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "TEACHER"})
    is_active = models.BooleanField(default=True, help_text="Whether students can currently take this quiz.")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.get_quiz_type_display()}) - {self.material.title}"


class QuizAttempt(models.Model):
    """One student's single official attempt at a QuizSession."""
    quiz_session = models.ForeignKey(QuizSession, on_delete=models.CASCADE, related_name="attempts")
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={"role": "STUDENT"}, related_name="quiz_attempts")
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    score = models.IntegerField(default=0)
    total_questions = models.IntegerField(default=0)

    class Meta:
        unique_together = ("quiz_session", "student")

    @property
    def score_percentage(self):
        if self.total_questions == 0:
            return 0.0
        return round((self.score / self.total_questions) * 100, 2)

    def __str__(self):
        return f"{self.student.username} - {self.quiz_session.title}: {self.score}/{self.total_questions}"


class QuizAnswer(models.Model):
    """One question's answer within a QuizAttempt — the per-attempt selected-choice log."""
    quiz_attempt = models.ForeignKey(QuizAttempt, on_delete=models.CASCADE, related_name="answers")
    flashcard = models.ForeignKey(Flashcard, on_delete=models.CASCADE, related_name="quiz_answers")
    selected_choice = models.CharField(max_length=1)
    is_correct = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("quiz_attempt", "flashcard")

    def __str__(self):
        return f"{self.quiz_attempt} - Card #{self.flashcard.id}: {self.selected_choice}"
