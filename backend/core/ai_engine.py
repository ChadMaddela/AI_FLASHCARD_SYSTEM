# core/ai_engine.py
import json
from google import genai
from google.genai import types
from config import settings

_IMAGE_INDEX_FIELD = {"image_index": types.Schema(type=types.Type.INTEGER, nullable=True)}

BLOOM_LEVELS = ["REMEMBERING", "UNDERSTANDING", "APPLYING", "ANALYZING", "EVALUATING", "CREATING"]
_BLOOM_LEVEL_FIELD = {"bloom_level": types.Schema(type=types.Type.STRING, enum=BLOOM_LEVELS)}

MCQ_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "question": types.Schema(type=types.Type.STRING),
            "choice_a": types.Schema(type=types.Type.STRING),
            "choice_b": types.Schema(type=types.Type.STRING),
            "choice_c": types.Schema(type=types.Type.STRING),
            "choice_d": types.Schema(type=types.Type.STRING),
            "correct_choice": types.Schema(type=types.Type.STRING),
            "sub_topic": types.Schema(type=types.Type.STRING),
            **_IMAGE_INDEX_FIELD,
            **_BLOOM_LEVEL_FIELD,
        },
        required=["question", "choice_a", "choice_b", "choice_c", "choice_d", "correct_choice", "sub_topic"],
    ),
)

BASIC_RESPONSE_SCHEMA = types.Schema(
    type=types.Type.ARRAY,
    items=types.Schema(
        type=types.Type.OBJECT,
        properties={
            "question": types.Schema(type=types.Type.STRING),
            "answer": types.Schema(type=types.Type.STRING),
            "sub_topic": types.Schema(type=types.Type.STRING),
            **_IMAGE_INDEX_FIELD,
            **_BLOOM_LEVEL_FIELD,
        },
        required=["question", "answer", "sub_topic"],
    ),
)

BLOOM_TAXONOMY_INSTRUCTIONS = """

        For each item, also classify it with a 'bloom_level' from Bloom's Revised Taxonomy — the
        single best-fit cognitive level the question actually requires of the student:
        REMEMBERING (recalling a fact/definition), UNDERSTANDING (explaining an idea/concept in their
        own words), APPLYING (using information in a new, concrete situation), ANALYZING (drawing
        connections between ideas or breaking a concept into its parts), EVALUATING (justifying a
        stance, decision, or judgment), or CREATING (producing new or original work). Most factual
        recall questions are REMEMBERING or UNDERSTANDING — only use the higher levels when the
        question genuinely demands that kind of reasoning.
        """

IMAGE_MATCHING_INSTRUCTIONS = """

        You are also given {count} image(s) extracted from this same material, indexed 0 to {last}
        in the order provided. For each flashcard, if one of these images would genuinely help
        illustrate the concept (e.g. a labeled diagram the question refers to), set 'image_index'
        to that image's number; otherwise set it to null. Only reference an image when it is truly
        relevant to that specific flashcard — do not force an association just because images exist.
        """


def generate_flashcards_from_text(material_text: str, card_type: str = "MCQ", images: list = None):
    """
    Generates flashcards from source text via Gemini, as MCQs, classic front/back recall cards, or
    cloze deletion (fill-in-the-blank) sentences. If `images` (a list of (mime_type, bytes) tuples)
    is provided and non-empty, Gemini also receives them and may set an 'image_index' per flashcard
    indicating which image (if any) best illustrates it — the caller is responsible for mapping that
    index back to a stored image URL.
    """
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    card_type = (card_type or "MCQ").upper()
    images = images or []

    if card_type == "BASIC":
        prompt = f"""
        You are an expert educational assistant creating classic front/back recall flashcards, in the
        style of Anki. Analyze the following source text provided by a teacher and extract core concepts
        into concise question/answer pairs.

        For each item, create:
        1. A concise, clear 'question' (the front of the card).
        2. A complete, self-contained 'answer' (the back of the card) that fully answers the question
           without requiring the reader to see the source text.
        3. A 'sub_topic' categorizing the exact concept.

        Source Text:
        {material_text}
        """
        response_schema = BASIC_RESPONSE_SCHEMA
    elif card_type == "CLOZE":
        prompt = f"""
        You are an expert educational assistant creating cloze deletion flashcards (fill-in-the-blank
        sentences), in the style of Anki. Analyze the following source text and extract core concepts
        into single-blank sentences.

        For each item, create:
        1. A 'question': a complete, grammatically correct sentence from/inspired by the source
           material with exactly one key term replaced by the literal text '_____' (five underscores).
           The blank should be a specific, testable term (e.g. an anatomical structure, a process name),
           not a trivial word.
        2. An 'answer': the exact word or short phrase that was removed (what belongs in the blank).
        3. A 'sub_topic' categorizing the exact concept.

        Source Text:
        {material_text}
        """
        response_schema = BASIC_RESPONSE_SCHEMA
    else:
        prompt = f"""
        You are an expert educational assistant specializing in creating multiple choice assessment questions.
        Analyze the following source text provided by a teacher and extract core concepts into clear,
        effective multiple choice flashcards.

        For each item, create:
        1. A concise, clear 'question'.
        2. Four distinct choices ('choice_a', 'choice_b', 'choice_c', 'choice_d'). The choices must be highly plausible but factually incorrect except for the right one.
        3. The 'correct_choice' indicated strictly by a capital letter ('A', 'B', 'C', or 'D').
        4. A 'sub_topic' categorizing the exact concept.

        Source Text:
        {material_text}
        """
        response_schema = MCQ_RESPONSE_SCHEMA

    prompt += BLOOM_TAXONOMY_INSTRUCTIONS

    if images:
        prompt += IMAGE_MATCHING_INSTRUCTIONS.format(count=len(images), last=len(images) - 1)
        contents = [prompt] + [types.Part.from_bytes(data=data, mime_type=mime_type) for mime_type, data in images]
    else:
        contents = prompt

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.3 if card_type in ("BASIC", "CLOZE") else 0.2,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error during Gemini flashcard generation ({card_type}): {e}")
        return []
