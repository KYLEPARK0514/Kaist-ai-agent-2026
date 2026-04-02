"""PDF text extraction, chunking, and embedding via Google Gemini.

Embedding model : models/text-embedding-004  (768-dimensional vectors)
Task type       : RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY at search time
"""
from __future__ import annotations

import io
import logging
import os
from typing import Optional

from google import genai
from google.genai import types as genai_types
from pypdf import PdfReader

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Module-level Gemini client (lazy singleton)
# ---------------------------------------------------------------------------
_genai_client: Optional[genai.Client] = None


def _get_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        api_key = os.environ["GOOGLE_API_KEY"]
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def extract_text(pdf_bytes: bytes) -> str:
    """Extract all text from a PDF given its raw bytes.

    Args:
        pdf_bytes: Raw binary content of the PDF file.

    Returns:
        Concatenated text from all pages, pages separated by a newline.

    Raises:
        ValueError: If the PDF cannot be read or contains no extractable text.
    """
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text.strip())
    if not pages:
        raise ValueError("No extractable text found in the PDF.")
    return "\n".join(pages)


# ---------------------------------------------------------------------------
# Text chunking
# ---------------------------------------------------------------------------

def chunk_text(
    text: str,
    chunk_size: int = 1000,
    overlap: int = 100,
) -> list[str]:
    """Split text into overlapping character-level chunks.

    Args:
        text: Source text to split.
        chunk_size: Maximum number of characters per chunk.
        overlap: Number of characters to overlap between consecutive chunks.

    Returns:
        Non-empty list of text chunks.
    """
    if not text:
        return []

    # Normalise whitespace
    text = " ".join(text.split())

    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(text):
            break
        start = end - overlap

    return chunks


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

EMBEDDING_MODEL = "models/text-embedding-004"
EMBEDDING_DIMENSIONS = 768


def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
    """Generate a 768-dimensional embedding for a single text string.

    Args:
        text: The text to embed.
        task_type: Gemini task type hint; use RETRIEVAL_DOCUMENT for indexing
                   and RETRIEVAL_QUERY for query-time embeddings.

    Returns:
        List of 768 floats representing the embedding vector.

    Raises:
        RuntimeError: If the API call fails or returns an unexpected shape.
    """
    client = _get_client()
    result = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=genai_types.EmbedContentConfig(task_type=task_type),
    )
    embedding: list[float] = result.embeddings[0].values
    if len(embedding) != EMBEDDING_DIMENSIONS:
        raise RuntimeError(
            f"Expected embedding of length {EMBEDDING_DIMENSIONS}, "
            f"got {len(embedding)}."
        )
    return embedding


def embed_texts(
    texts: list[str],
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> list[list[float]]:
    """Generate embeddings for a list of texts.

    Embeds each text individually to ensure the correct task_type is applied
    and to maintain a simple retry surface.

    Args:
        texts: Collection of strings to embed.
        task_type: Gemini task type hint.

    Returns:
        List of 768-dim float vectors, one per input text.
    """
    return [embed_text(t, task_type) for t in texts]
