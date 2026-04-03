from __future__ import annotations

import io
import os

import google.generativeai as genai
from pypdf import PdfReader

_CHUNK_SIZE = 1000
_CHUNK_OVERLAP = 200
_EMBEDDING_MODEL = "models/text-embedding-004"
_EMBEDDING_DIMENSIONS = 768


class PdfService:
    def __init__(self) -> None:
        api_key = os.environ["GOOGLE_API_KEY"]
        genai.configure(api_key=api_key)

    # ------------------------------------------------------------------
    # Text extraction
    # ------------------------------------------------------------------

    def extract_text(self, pdf_bytes: bytes) -> str:
        """Return all text extracted from a PDF given as raw bytes."""
        reader = PdfReader(io.BytesIO(pdf_bytes))
        parts: list[str] = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                parts.append(text)
        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def chunk_text(self, text: str) -> list[str]:
        """Split *text* into overlapping chunks of ~1 000 characters."""
        chunks: list[str] = []
        start = 0
        length = len(text)
        while start < length:
            end = min(start + _CHUNK_SIZE, length)
            chunks.append(text[start:end])
            if end == length:
                break
            start += _CHUNK_SIZE - _CHUNK_OVERLAP
        return chunks

    # ------------------------------------------------------------------
    # Embedding
    # ------------------------------------------------------------------

    def embed_chunks(self, chunks: list[str]) -> list[list[float]]:
        """Return a 768-dimensional embedding vector for each chunk."""
        embeddings: list[list[float]] = []
        for chunk in chunks:
            result = genai.embed_content(
                model=_EMBEDDING_MODEL,
                content=chunk,
                task_type="retrieval_document",
                output_dimensionality=_EMBEDDING_DIMENSIONS,
            )
            vector: list[float] = result["embedding"]
            assert len(vector) == _EMBEDDING_DIMENSIONS, (
                f"Expected {_EMBEDDING_DIMENSIONS} dimensions, got {len(vector)}"
            )
            embeddings.append(vector)
        return embeddings
