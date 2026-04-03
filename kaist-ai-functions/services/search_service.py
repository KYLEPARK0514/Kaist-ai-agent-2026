"""Hybrid search service against the CosmosDB 'knowledge' container.

Combines BM25 full-text scoring (FullTextScore) with cosine vector distance
(VectorDistance) using Reciprocal Rank Fusion (RRF) to retrieve the most
relevant PDF chunks for a given user query.

Prerequisites
-------------
The 'knowledge' container must have:
  - A full-text index on /content  (for FullTextScore)
  - A vector index on /embedding   (quantizedFlat or diskANN, 768-dim, cosine)
  - fullTextPolicy with /content path enabled
Both policies are provisioned in kaist-ai-infra/modules/cosmos.bicep.
"""
from __future__ import annotations

import logging
import os
import re
import string
from dataclasses import dataclass
from typing import Optional

from azure.cosmos import CosmosClient

from services.pdf_service import embed_text

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stop-word list for keyword extraction
# ---------------------------------------------------------------------------

_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "of", "in", "on",
    "at", "to", "for", "with", "what", "how", "why", "where", "when",
    "be", "been", "being", "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "may", "might", "can", "shall",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "it",
    "they", "them", "this", "that", "these", "those", "and", "but",
    "or", "not", "no", "so", "if", "then", "than", "as", "by", "up",
}


def _extract_keywords(text: str) -> list[str]:
    """Lower-case, strip punctuation, remove stop-words.

    Returns a list of meaningful tokens to pass as FullTextScore keywords.
    Falls back to all non-stop tokens if result would be empty.
    """
    tokens = re.sub(r"[^\w\s]", "", text.lower()).split()
    filtered = [t for t in tokens if t not in _STOP_WORDS and len(t) > 1]
    # If every token was a stop word, fall back to all tokens
    return filtered if filtered else [t for t in tokens if len(t) > 1]


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class ChunkResult:
    document_id: str
    filename: str
    chunk_index: int
    content: str
    score: float


# ---------------------------------------------------------------------------
# Lazy container client
# ---------------------------------------------------------------------------

_cosmos_client: Optional[CosmosClient] = None
_knowledge_container = None


def _get_knowledge_container():
    global _cosmos_client, _knowledge_container
    if _knowledge_container is None:
        _cosmos_client = CosmosClient(
            os.environ["AZURE_COSMOS_ENDPOINT"],
            credential=os.environ["AZURE_COSMOS_KEY"],
        )
        database_name = os.environ.get("AZURE_COSMOS_DATABASE_NAME", "kaistdb")
        container_name = os.environ.get("AZURE_COSMOS_CONTAINER_NAME", "knowledge")
        db = _cosmos_client.get_database_client(database_name)
        _knowledge_container = db.get_container_client(container_name)
    return _knowledge_container


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def hybrid_search(query: str, top_k: int = 8) -> list[ChunkResult]:
    """Run hybrid (BM25 + vector) search against the knowledge container.

    Steps
    -----
    1. Generate a 768-dim query embedding via text-embedding-004.
    2. Extract BM25 keywords from the query.
    3. Execute a RANK RRF query (FullTextScore + VectorDistance) in CosmosDB.
    4. Return up to top_k ChunkResult objects.

    Args:
        query: Natural-language user question.
        top_k: Maximum number of chunks to return.

    Returns:
        List of ChunkResult ordered by combined relevance score descending.
    """
    if not query.strip():
        return []

    # 1. Generate query embedding (RETRIEVAL_QUERY task type for search)
    query_vector = embed_text(query, task_type="RETRIEVAL_QUERY")

    # 2. Extract keywords
    keywords = _extract_keywords(query)
    if not keywords:
        keywords = [query.lower().strip()]

    logger.info(
        "hybrid_search: top_k=%d, keywords=%s", top_k, keywords[:10]
    )

    # 3. Hybrid search query using RANK RRF
    # Note: SELECT TOP must use a literal integer (CosmosDB NoSQL limitation)
    sql = f"""
        SELECT TOP {int(top_k)}
            c.content,
            c.documentId,
            c.filename,
            c.chunkIndex,
            RANK RRF(
                FullTextScore(c, @keywords),
                VectorDistance(c.embedding, @queryVector)
            ) AS searchScore
        FROM c
        WHERE c.type = 'chunk'
        ORDER BY RANK RRF(
            FullTextScore(c, @keywords),
            VectorDistance(c.embedding, @queryVector)
        )
    """
    params = [
        {"name": "@keywords", "value": keywords},
        {"name": "@queryVector", "value": query_vector},
    ]

    container = _get_knowledge_container()
    try:
        items = list(
            container.query_items(
                query=sql,
                parameters=params,
                enable_cross_partition_query=True,
            )
        )
    except Exception as exc:
        logger.error("hybrid_search query failed: %s", exc, exc_info=True)
        raise

    results = [
        ChunkResult(
            document_id=item.get("documentId", ""),
            filename=item.get("filename", ""),
            chunk_index=item.get("chunkIndex", 0),
            content=item.get("content", ""),
            score=float(item.get("searchScore", 0.0)),
        )
        for item in items
    ]
    logger.info("hybrid_search returned %d chunks", len(results))
    return results
