from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    """Custom User model with Teacher/Student roles."""
    ROLE_CHOICES = (
        ('TEACHER', 'Teacher'),
        ('STUDENT', 'Student'),
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='STUDENT')

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Material(models.Model):
    """Stores teacher-uploaded reference materials."""
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    content_text = models.TextField(help_text="Extracted text or presentation text.")
    uploaded_by = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'TEACHER'})
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Flashcard(models.Model):
    """Flashcards generated automatically by Gemini as MCQs."""
    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name='flashcards')
    question = models.TextField()
    choice_a = models.TextField(default="")
    choice_b = models.TextField(default="")
    choice_c = models.TextField(default="")
    choice_d = models.TextField(default="")
    correct_choice = models.CharField(max_length=1, default="A")
    sub_topic = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"MCQ #{self.id} for {self.material.title}"


class StudentPerformance(models.Model):
    """Tracks student performance on flashcards for adaptive learning."""
    student = models.ForeignKey(User, on_delete=models.CASCADE, limit_choices_to={'role': 'STUDENT'}, related_name='performances')
    flashcard = models.ForeignKey(Flashcard, on_delete=models.CASCADE, related_name='student_history')

    # Match field names to views.py
    attempts_count = models.IntegerField(default=0)
    correct_attempts_count = models.IntegerField(default=0)
    mastery_level = models.IntegerField(default=0, help_text="Range 0 (Struggling) to 5 (Mastered)")
    last_reviewed = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'flashcard')

    @property
    def accuracy_percentage(self):
        if self.attempts_count == 0:
            return 0.0
        return round((self.correct_attempts_count / self.attempts_count) * 100, 2)

    def __str__(self):
        return f"{self.student.username} - Card #{self.flashcard.id} (Mastery: {self.mastery_level})"
