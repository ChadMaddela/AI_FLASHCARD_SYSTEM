# core/ai_engine.py
import json
import os
from google import genai
from google.genai import types

def generate_flashcards_from_text(material_text: str):
    client = genai.Client()

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

    # Enforcing strict JSON schema matching our new model architecture
    response_schema = types.Schema(
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
            },
            required=["question", "choice_a", "choice_b", "choice_c", "choice_d", "correct_choice", "sub_topic"],
        ),
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=response_schema,
                temperature=0.3,
            ),
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error during Gemini flashcard generation: {e}")
        return []