from rest_framework import serializers
from .models import Material, Flashcard, StudentPerformance, User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role"]

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ["id", "title", "description", "created_at"]

class MaterialCreateSerializer(serializers.ModelSerializer):
    raw_text = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Material
        fields = ["id", "title", "description", "raw_text"]

    def create(self, validated_data):
        raw_text = validated_data.pop("raw_text", "")
        material = Material.objects.create(**validated_data)
        return material, raw_text

class FlashcardSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flashcard
        fields = [
            "id",
            "material",
            "question",
            "choice_a",
            "choice_b",
            "choice_c",
            "choice_d",
            "correct_choice",   # ✅ Added this field
            "sub_topic",
            "created_at",       # ✅ Added timestamp for clarity
        ]

class PerformanceSummarySerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source="flashcard.question", read_only=True)
    sub_topic = serializers.CharField(source="flashcard.sub_topic", read_only=True)

    class Meta:
        model = StudentPerformance
        fields = [
            "id",
            "flashcard",
            "question_text",
            "sub_topic",
            "mastery_level",
            "attempts_count",
            "correct_attempts_count",
        ]
