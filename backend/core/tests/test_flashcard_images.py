import os
import django
import pytest
from io import BytesIO
from unittest.mock import patch
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import User, Material, Flashcard

pytestmark = pytest.mark.django_db

FAKE_IMAGE_URL = "https://fake.supabase.co/storage/v1/object/public/materials/flashcard_images/fake.png"
EXISTING_IMAGE_URL = "https://fake.supabase.co/storage/v1/object/public/materials/flashcard_images/old.png"


@pytest.fixture
def api_client(db):
    return APIClient()


@pytest.fixture
def teacher_user(db):
    teacher, _ = User.objects.get_or_create(
        username="image_pytest_teacher",
        defaults={"email": "image_teacher@test.com", "role": User.ROLE_TEACHER}
    )
    teacher.set_password("password123")
    teacher.save()
    return teacher


@pytest.fixture
def material(db, teacher_user):
    return Material.objects.create(title="M", content_text="x", uploaded_by=teacher_user)


def authenticate(client, user, password="password123"):
    resp = client.post("/api/token/", {"username": user.username, "password": password})
    assert resp.status_code == 200
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {resp.data['access']}")
    return client


def make_image_file(name="test.png"):
    buf = BytesIO()
    Image.new("RGB", (10, 10), color=(255, 0, 0)).save(buf, format="PNG")
    return SimpleUploadedFile(name, buf.getvalue(), content_type="image/png")


def make_card_with_image(material):
    return Flashcard.objects.create(
        material=material, card_type="MCQ", question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice="A", sub_topic="T", image_url=EXISTING_IMAGE_URL,
    )


@patch("core.views.upload_bytes_and_get_url", return_value=FAKE_IMAGE_URL)
def test_create_flashcard_with_image_sets_image_url(mock_upload, api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {
            "card_type": "MCQ", "question": "Q", "choice_a": "a", "choice_b": "b",
            "choice_c": "c", "choice_d": "d", "correct_choice": "A", "sub_topic": "T",
            "image": make_image_file(),
        },
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.data["image_url"] == FAKE_IMAGE_URL
    mock_upload.assert_called_once()


@patch("core.views.upload_bytes_and_get_url", return_value=None)
def test_create_flashcard_without_image_leaves_it_null(mock_upload, api_client, teacher_user, material):
    client = authenticate(api_client, teacher_user)
    resp = client.post(
        f"/api/materials/{material.id}/flashcards/create/",
        {
            "card_type": "MCQ", "question": "Q", "choice_a": "a", "choice_b": "b",
            "choice_c": "c", "choice_d": "d", "correct_choice": "A", "sub_topic": "T",
        },
        format="multipart",
    )
    assert resp.status_code == 201
    assert resp.data["image_url"] is None
    mock_upload.assert_not_called()


@patch("core.views.delete_object")
@patch("core.views.upload_bytes_and_get_url", return_value="https://fake.supabase.co/new.png")
def test_update_flashcard_replaces_image_and_cleans_up_old_one(mock_upload, mock_delete, api_client, teacher_user, material):
    card = make_card_with_image(material)
    client = authenticate(api_client, teacher_user)
    resp = client.put(
        f"/api/flashcards/{card.id}/update/",
        {"card_type": "MCQ", "question": "Q", "image": make_image_file("new.png")},
        format="multipart",
    )
    assert resp.status_code == 200
    assert resp.data["image_url"] == "https://fake.supabase.co/new.png"
    mock_delete.assert_called_once()


@patch("core.views.delete_object")
def test_update_flashcard_remove_image_clears_it(mock_delete, api_client, teacher_user, material):
    card = make_card_with_image(material)
    client = authenticate(api_client, teacher_user)
    resp = client.put(
        f"/api/flashcards/{card.id}/update/",
        {"card_type": "MCQ", "question": "Q", "remove_image": "true"},
        format="multipart",
    )
    assert resp.status_code == 200
    assert resp.data["image_url"] is None
    mock_delete.assert_called_once()


def test_update_flashcard_without_image_changes_leaves_existing_image(api_client, teacher_user, material):
    card = make_card_with_image(material)
    client = authenticate(api_client, teacher_user)
    resp = client.put(
        f"/api/flashcards/{card.id}/update/",
        {"card_type": "MCQ", "question": "Updated question text"},
        format="multipart",
    )
    assert resp.status_code == 200
    assert resp.data["image_url"] == EXISTING_IMAGE_URL


@patch("core.views.delete_object")
def test_delete_flashcard_with_image_attempts_cleanup(mock_delete, api_client, teacher_user, material):
    card = make_card_with_image(material)
    client = authenticate(api_client, teacher_user)
    resp = client.delete(f"/api/flashcards/{card.id}/delete/")
    assert resp.status_code == 204
    mock_delete.assert_called_once()
    assert not Flashcard.objects.filter(id=card.id).exists()


def test_delete_flashcard_without_image_skips_cleanup(api_client, teacher_user, material):
    card = Flashcard.objects.create(
        material=material, card_type="MCQ", question="Q",
        choice_a="a", choice_b="b", choice_c="c", choice_d="d",
        correct_choice="A", sub_topic="T",
    )
    with patch("core.views.delete_object") as mock_delete:
        client = authenticate(api_client, teacher_user)
        resp = client.delete(f"/api/flashcards/{card.id}/delete/")
        assert resp.status_code == 204
        mock_delete.assert_not_called()
