import logging
import mimetypes
import requests
from celery import shared_task
from .models import Material, Flashcard
from .ai_engine import generate_flashcards_from_text
from .file_extraction import extract_images_from_bytes, downscale_image
from .storage import upload_bytes_and_get_url

logger = logging.getLogger(__name__)

MAX_IMAGES_FOR_GENERATION = 12


def _extract_material_images(material):
    """
    Downloads the original uploaded file (already in Supabase Storage from the synchronous
    upload step) and extracts its embedded images. Returns (raw_images, gemini_images) — same
    ordering, same length. raw_images is full quality (for eventual storage/display);
    gemini_images is downscaled (for a cheaper/faster Gemini request only). Never raises —
    any failure here just means generation proceeds text-only, exactly like materials with
    no file at all.
    """
    if not material.file_url:
        return [], []

    try:
        resp = requests.get(material.file_url, timeout=30)
        resp.raise_for_status()
        filename = material.file_url.split("/")[-1]
        raw_images = extract_images_from_bytes(resp.content, filename, max_images=MAX_IMAGES_FOR_GENERATION)
    except Exception:
        logger.exception("Image extraction failed for material %s; continuing text-only.", material.id)
        return [], []

    gemini_images = [downscale_image(mime, data) for mime, data in raw_images]
    return raw_images, gemini_images


def _upload_matched_images(material_id, generated_cards, raw_images):
    """
    Uploads only the images Gemini actually referenced (not every extracted image) to Supabase
    Storage, using the full-quality original bytes — never the downscaled Gemini-only copy.
    Returns {image_index: url}.
    """
    referenced_indexes = {
        item["image_index"]
        for item in generated_cards
        if isinstance(item.get("image_index"), int) and 0 <= item["image_index"] < len(raw_images)
    }

    index_to_url = {}
    for idx in referenced_indexes:
        mime_type, data = raw_images[idx]
        ext = mimetypes.guess_extension(mime_type) or ".jpg"
        path = f"flashcard_images/material_{material_id}_{idx}{ext}"
        try:
            index_to_url[idx] = upload_bytes_and_get_url("materials", path, data, mime_type)
        except Exception:
            logger.exception("Failed to upload matched image %s for material %s; leaving that card image-less.", idx, material_id)

    return index_to_url


@shared_task
def generate_flashcards_task(material_id, generation_mode):
    """Generates flashcards for a Material via Gemini and records the outcome on the Material row."""
    try:
        material = Material.objects.get(id=material_id)
    except Material.DoesNotExist:
        logger.error("Material %s no longer exists; abandoning flashcard generation.", material_id)
        return

    try:
        raw_images, gemini_images = _extract_material_images(material)

        generated_cards = generate_flashcards_from_text(
            material.content_text, card_type=generation_mode, images=gemini_images
        )
        if not generated_cards:
            raise ValueError("Gemini AI generated an empty response payload.")

        index_to_url = _upload_matched_images(material_id, generated_cards, raw_images) if raw_images else {}

        if generation_mode in (Flashcard.CARD_TYPE_BASIC, Flashcard.CARD_TYPE_CLOZE):
            flashcards = [
                Flashcard(
                    material=material,
                    card_type=generation_mode,
                    question=item["question"],
                    answer=item["answer"],
                    sub_topic=item["sub_topic"],
                    image_url=index_to_url.get(item.get("image_index")),
                    bloom_level=item.get("bloom_level"),
                )
                for item in generated_cards
            ]
        else:
            flashcards = [
                Flashcard(
                    material=material,
                    card_type=Flashcard.CARD_TYPE_MCQ,
                    question=item["question"],
                    choice_a=item["choice_a"],
                    choice_b=item["choice_b"],
                    choice_c=item["choice_c"],
                    choice_d=item["choice_d"],
                    correct_choice=item["correct_choice"].upper().strip(),
                    sub_topic=item["sub_topic"],
                    image_url=index_to_url.get(item.get("image_index")),
                    bloom_level=item.get("bloom_level"),
                )
                for item in generated_cards
            ]

        Flashcard.objects.bulk_create(flashcards)
        material.generation_status = Material.STATUS_DONE
        material.generation_error = None
        material.save(update_fields=["generation_status", "generation_error"])

    except Exception as exc:
        logger.exception("Flashcard generation failed for material %s", material_id)
        material.generation_status = Material.STATUS_FAILED
        material.generation_error = str(exc)[:2000]
        material.save(update_fields=["generation_status", "generation_error"])
