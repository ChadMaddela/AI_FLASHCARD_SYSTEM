from rest_framework import serializers
from .models import Material, Flashcard, StudentPerformance, User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role"]


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        # ✅ Confirmed: Explicitly mapping file_url for read operations
        fields = ["id", "title", "description", "file_url", "created_at"]


class MaterialCreateSerializer(serializers.ModelSerializer):
    raw_text = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = Material
        # ✅ FIX: Added 'file_url' here so that when Django returns 
        # the created object response, the URL path isn't dropped!
        fields = ["id", "title", "description", "file_url", "raw_text"]
        read_only_fields = ["file_url"]

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
            "correct_choice",
            "sub_topic",
            "created_at",
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