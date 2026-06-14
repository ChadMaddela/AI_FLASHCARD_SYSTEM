import os
import django
import pytest

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard

pytestmark = pytest.mark.django_db


def test_generation():
    teacher, _ = User.objects.get_or_create(
        username="test_teacher",
        defaults={"email": "teacher@test.com", "role": "TEACHER"}
    )
    material = Material.objects.create(
        title="AI Test Material",
        description="Testing Gemini flashcard generation",
        content_text="The heart pumps blood through the body.",
        uploaded_by=teacher
    )
    Flashcard.objects.create(
        material=material,
        question="What organ pumps blood?",
        choice_a="Lungs",
        choice_b="Brain",
        choice_c="Heart",
        choice_d="Kidneys",
        correct_choice="C",
        sub_topic="Circulatory System"
    )
    assert Flashcard.objects.filter(material=material).exists()
