from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from .models import Material, Flashcard, StudentPerformance, User, QuizSession, QuizAttempt

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "role"]


class RegisterSerializer(serializers.ModelSerializer):
    """Public self-registration. Role is never accepted from the client — always STUDENT."""
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]

    def validate(self, data):
        temp_user = User(username=data.get("username", ""), email=data.get("email", ""))
        try:
            validate_password(data["password"], user=temp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": list(exc.messages)})
        return data

    def create(self, validated_data):
        user = User(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            role=User.ROLE_STUDENT,
        )
        user.set_password(validated_data["password"])
        user.save()
        return user


class AdminUserSerializer(serializers.ModelSerializer):
    """Teacher-facing user list/edit — supports role changes and optional password resets."""
    new_password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "date_joined", "new_password"]
        read_only_fields = ["date_joined"]

    def validate_new_password(self, value):
        if value:
            try:
                validate_password(value, user=self.instance)
            except DjangoValidationError as exc:
                raise serializers.ValidationError(list(exc.messages))
        return value

    def update(self, instance, validated_data):
        new_password = validated_data.pop("new_password", None)
        instance = super().update(instance, validated_data)
        if new_password:
            instance.set_password(new_password)
            instance.save(update_fields=["password"])
        return instance


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        # ✅ Confirmed: Explicitly mapping file_url for read operations
        fields = ["id", "title", "description", "file_url", "created_at", "generation_status", "generation_error"]


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
            "card_type",
            "question",
            "choice_a",
            "choice_b",
            "choice_c",
            "choice_d",
            "correct_choice",
            "answer",
            "sub_topic",
            "image_url",
            "bloom_level",
            "created_at",
        ]

    def validate(self, data):
        card_type = data.get("card_type", getattr(self.instance, "card_type", Flashcard.CARD_TYPE_MCQ))

        if card_type == Flashcard.CARD_TYPE_MCQ:
            for field_name in ("choice_a", "choice_b", "choice_c", "choice_d"):
                value = data.get(field_name, getattr(self.instance, field_name, None))
                if not value:
                    raise serializers.ValidationError({field_name: "This field is required for MCQ cards."})
            correct_choice = data.get("correct_choice", getattr(self.instance, "correct_choice", "")).upper()
            if correct_choice not in ("A", "B", "C", "D"):
                raise serializers.ValidationError(
                    {"correct_choice": "Must be one of A, B, C, or D for MCQ cards."}
                )
        elif card_type in (Flashcard.CARD_TYPE_BASIC, Flashcard.CARD_TYPE_CLOZE):
            answer = data.get("answer", getattr(self.instance, "answer", None))
            if not answer:
                raise serializers.ValidationError({"answer": "This field is required for BASIC/CLOZE cards."})

        return data


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


class QuizSessionSerializer(serializers.ModelSerializer):
    """Teacher-facing: create/list quiz sessions. flashcard_ids is write-only and MCQ-only."""
    question_count = serializers.SerializerMethodField()
    flashcard_ids = serializers.PrimaryKeyRelatedField(
        source="flashcards", many=True, write_only=True,
        queryset=Flashcard.objects.filter(card_type=Flashcard.CARD_TYPE_MCQ),
    )

    class Meta:
        model = QuizSession
        fields = ["id", "material", "title", "quiz_type", "is_active", "created_at", "question_count", "flashcard_ids"]

    def get_question_count(self, obj):
        return obj.flashcards.count()

    def validate_flashcard_ids(self, flashcards):
        if not flashcards:
            raise serializers.ValidationError("Select at least one MCQ flashcard for this quiz.")
        return flashcards


class QuizAttemptSerializer(serializers.ModelSerializer):
    student_username = serializers.CharField(source="student.username", read_only=True)

    class Meta:
        model = QuizAttempt
        fields = [
            "id", "quiz_session", "student", "student_username",
            "score", "total_questions", "score_percentage", "started_at", "completed_at",
        ]