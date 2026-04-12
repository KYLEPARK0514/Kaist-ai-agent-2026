from __future__ import annotations

import math
import re
from collections import Counter
from typing import Dict, Iterable, List, Sequence, Tuple


_TOKEN_RE = re.compile(r"[\w가-힣]+", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


class BM25:
    def __init__(self, corpus_tokens: Sequence[Sequence[str]], k1: float = 1.2, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.corpus_tokens = [list(doc) for doc in corpus_tokens]
        self.N = len(self.corpus_tokens)
        self.doc_lens = [len(d) for d in self.corpus_tokens]
        self.avgdl = sum(self.doc_lens) / self.N if self.N else 0.0
        self.df: Dict[str, int] = {}
        for doc in self.corpus_tokens:
            for term in set(doc):
                self.df[term] = self.df.get(term, 0) + 1

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        return math.log(1.0 + (self.N - df + 0.5) / (df + 0.5)) if self.N else 0.0

    def score(self, query_tokens: Sequence[str], doc_index: int) -> float:
        doc = self.corpus_tokens[doc_index]
        if not doc:
            return 0.0
        dl = self.doc_lens[doc_index]
        freq = Counter(doc)
        score = 0.0
        for term in query_tokens:
            f = freq.get(term, 0)
            if f == 0:
                continue
            idf = self.idf(term)
            denom = f + self.k1 * (1 - self.b + self.b * dl / (self.avgdl or 1e-6))
            score += idf * (f * (self.k1 + 1)) / denom
        return score


def retrieve_best_chunks(
    chunks: List[Tuple[str, int, str]],
    question: str,
    top_k: int = 6,
    syllabus_id: str | None = None,
) -> List[Dict]:
    filtered = [(sid, idx, text) for sid, idx, text in chunks if not syllabus_id or sid == syllabus_id]
    if not filtered:
        return []

    tokenized_docs = [tokenize(text) for _, _, text in filtered]
    if not any(tokenized_docs):
        return [{"syllabus_id": sid, "chunk_index": idx, "text": text, "score": 0.0} for sid, idx, text in filtered[:top_k]]

    bm25 = BM25(tokenized_docs)
    q = tokenize(question)
    if not q:
        return [{"syllabus_id": sid, "chunk_index": idx, "text": text, "score": 0.0} for sid, idx, text in filtered[:top_k]]

    scores = [(i, bm25.score(q, i)) for i in range(len(filtered))]
    scores.sort(key=lambda x: x[1], reverse=True)
    out: List[Dict] = []
    for i, sc in scores[:top_k]:
        sid, idx, text = filtered[i]
        out.append({"syllabus_id": sid, "chunk_index": idx, "text": text, "score": float(sc)})
    return out


def synthesize_answer(question: str, hits: Iterable[Dict]) -> str:
    hits_list = list(hits)
    if not hits_list:
        return "관련 문서 청크를 찾지 못했습니다. 질문을 더 구체적으로 바꾸거나 실러버스를 업로드해 주세요."

    sentences: List[str] = []
    q_terms = set(tokenize(question))
    for h in hits_list[:4]:
        text = h.get("text", "")
        for raw in re.split(r"(?<=[.!?。])\s+|\n+", text):
            s = raw.strip()
            if len(s) < 20:
                continue
            stoks = set(tokenize(s))
            if q_terms and not stoks.intersection(q_terms) and len(q_terms) > 1:
                continue
            sentences.append(s[:420])
            if len(sentences) >= 5:
                break
        if len(sentences) >= 5:
            break

    if not sentences:
        snippet = hits_list[0]["text"][:800].strip()
        return "문서에서 직접 매칭되는 문장은 적지만, 가장 유사한 구간은 다음과 같습니다.\n\n" + snippet

    bullets = "\n".join(f"- {s}" for s in sentences[:5])
    return f"질문: {question}\n\n문서 근거 요약:\n{bullets}"
