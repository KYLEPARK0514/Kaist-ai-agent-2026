"""Gemini-powered chat service.

Assembles system prompt (with injected PDF context), builds conversation
history, and calls the Gemini generative model to produce an answer.

Uses the google-genai SDK (google.genai) which is already a dependency.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

from google import genai
from google.genai import types as genai_types

from models.conversation import MessageRecord
from services.search_service import ChunkResult

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy Gemini client
# ---------------------------------------------------------------------------

_genai_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    return _genai_client


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system_prompt(search_results: list[ChunkResult]) -> str:
    """Construct the system prompt with injected PDF context chunks."""
    context_blocks: list[str] = []
    for chunk in search_results:
        context_blocks.append(
            f"[Source: {chunk.filename}, chunk {chunk.chunk_index}]\n{chunk.content}"
        )
    context_text = "\n\n".join(context_blocks) if context_blocks else "(No context available)"

    return (
        "You are a helpful AI assistant for KAIST students.\n"
        "Answer the user's question using ONLY the provided context.\n"
        "If the context does not contain enough information, say so clearly.\n"
        "Do not hallucinate or make up information.\n\n"
        "=== KNOWLEDGE BASE CONTEXT ===\n"
        f"{context_text}\n"
        "=== END OF CONTEXT ===\n\n"
        "Answer in the same language the user used to ask the question."
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def generate_response(
    user_query: str,
    search_results: list[ChunkResult],
    history: list[MessageRecord],
) -> str:
    """Generate an AI response using Gemini with hybrid-search context.

    Args:
        user_query: The user's message content.
        search_results: Retrieved PDF chunks to inject as context.
        history: Message history (all messages including the latest user
                 message; the latest message is the one we respond to).

    Returns:
        The assistant's response text.

    Raises:
        RuntimeError: On Gemini API failures.
    """
    client = _get_client()
    model_name = os.environ.get("GEMINI_CHAT_MODEL", "gemini-2.5-pro-preview")
    system_prompt = _build_system_prompt(search_results)

    # Build conversation history for multi-turn context.
    # Exclude the most recent user message: it is sent separately via
    # generate_content's contents list.
    history_turns: list[genai_types.Content] = []
    prior_messages = history[:-1] if history else []
    for msg in prior_messages:
        role = "user" if msg.role == "user" else "model"
        history_turns.append(
            genai_types.Content(
                role=role,
                parts=[genai_types.Part(text=msg.content)],
            )
        )

    # Append the current user message
    all_contents = history_turns + [
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=user_query)],
        )
    ]

    config = genai_types.GenerateContentConfig(
        system_instruction=system_prompt,
    )

    logger.info(
        "Calling Gemini model=%s with %d context chunks and %d history turns",
        model_name,
        len(search_results),
        len(history_turns),
    )

    try:
        response = client.models.generate_content(
            model=model_name,
            contents=all_contents,
            config=config,
        )
        text = response.text
        if not text:
            raise RuntimeError("Gemini returned an empty response.")
        return text
    except Exception as exc:
        logger.error("Gemini API call failed: %s", exc, exc_info=True)
        raise
