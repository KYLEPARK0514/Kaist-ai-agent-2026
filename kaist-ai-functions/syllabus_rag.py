from __future__ import annotations

import math
import os
import re
from collections import Counter
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

from pydantic import BaseModel, Field

try:
    from google import genai
    from google.genai import types as genai_types
except Exception:  # pragma: no cover - optional runtime dependency in local dev
    genai = None
    genai_types = None


_TOKEN_RE = re.compile(r"[\w가-힣]+", re.UNICODE)
_EVAL_KEYWORDS = (
    "중간",
    "기말",
    "출석",
    "과제",
    "프로젝트",
    "퀴즈",
    "평가",
    "비중",
    "배점",
)

_EVAL_NAME_MAP: Dict[str, Tuple[str, ...]] = {
    "중간고사": ("중간", "midterm"),
    "기말고사": ("기말", "final"),
    "과제": ("과제", "assignment", "homework"),
    "출석": ("출석", "attendance"),
    "팀프로젝트": ("팀", "프로젝트", "project"),
    "퀴즈": ("퀴즈", "quiz"),
}

_GENAI_CLIENT: Optional["genai.Client"] = None


class StructuredRagAnswer(BaseModel):
    answer: str = Field(..., description="한국어 최종 답변")
    grounded_points: List[str] = Field(default_factory=list, description="근거 요약 포인트")
    insufficient: bool = Field(default=False, description="근거 부족 여부")


def tokenize(text: str) -> List[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


def _get_genai_client() -> Optional["genai.Client"]:
    global _GENAI_CLIENT
    if genai is None:
        return None
    if _GENAI_CLIENT is not None:
        return _GENAI_CLIENT
    api_key = os.environ.get("GOOGLE_API_KEY", "").strip()
    if not api_key:
        return None
    _GENAI_CLIENT = genai.Client(api_key=api_key)
    return _GENAI_CLIENT


def _extract_numeric_pct(value: object) -> Optional[float]:
    if isinstance(value, (int, float)):
        v = float(value)
        return v if 0 <= v <= 100 else None
    if isinstance(value, str):
        m = re.search(r"(\d+(?:\.\d+)?)", value)
        if not m:
            return None
        v = float(m.group(1))
        return v if 0 <= v <= 100 else None
    return None


def _question_target_assessment(question: str) -> Optional[str]:
    q = question.lower()
    for canonical, aliases in _EVAL_NAME_MAP.items():
        if any(alias in q for alias in aliases):
            return canonical
    return None


def try_answer_from_structured_syllabi(
    question: str,
    syllabi: Sequence[Dict],
    syllabus_id: str | None = None,
) -> Optional[str]:
    q = question.strip()
    if not q:
        return None
    q_l = q.lower()
    if not any(k in q for k in _EVAL_KEYWORDS):
        return None

    target_assessment = _question_target_assessment(q)
    if not target_assessment:
        return None

    rows: List[Tuple[str, str, float]] = []
    for item in syllabi:
        if not isinstance(item, dict):
            continue
        sid = str(item.get("id") or "")
        if syllabus_id and sid != syllabus_id:
            continue
        assessments = item.get("assessments")
        if not isinstance(assessments, list):
            continue
        for entry in assessments:
            if not isinstance(entry, dict):
                continue
            name = str(entry.get("name") or "").strip()
            pct = _extract_numeric_pct(entry.get("pct"))
            if not name or pct is None:
                continue
            name_l = name.lower()
            aliases = _EVAL_NAME_MAP.get(target_assessment, ())
            if not any(alias in name_l for alias in aliases):
                continue
            course_name = str(item.get("name") or item.get("code") or sid).strip() or sid
            course_code = str(item.get("code") or "").strip()
            rows.append((course_name, course_code, pct))

    if not rows:
        return None

    ask_lowest = any(word in q_l for word in ("가장 낮", "최저", "least", "lowest", "minimum", "작은"))
    ask_highest = any(word in q_l for word in ("가장 높", "최고", "most", "highest", "maximum", "큰"))
    if ask_lowest:
        winner = min(rows, key=lambda x: x[2])
        ordered = sorted(rows, key=lambda x: x[2])
        table = "\n".join(f"- {n}({c}) {p:g}%" if c else f"- {n} {p:g}%" for n, c, p in ordered[:5])
        return (
            f"{target_assessment} 비중이 가장 낮은 과목은 "
            f"{winner[0]}{f'({winner[1]})' if winner[1] else ''}로 {winner[2]:g}%입니다.\n\n"
            f"확인된 상위 과목:\n{table}"
        )
    if ask_highest:
        winner = max(rows, key=lambda x: x[2])
        ordered = sorted(rows, key=lambda x: x[2], reverse=True)
        table = "\n".join(f"- {n}({c}) {p:g}%" if c else f"- {n} {p:g}%" for n, c, p in ordered[:5])
        return (
            f"{target_assessment} 비중이 가장 높은 과목은 "
            f"{winner[0]}{f'({winner[1]})' if winner[1] else ''}로 {winner[2]:g}%입니다.\n\n"
            f"확인된 상위 과목:\n{table}"
        )

    ordered = sorted(rows, key=lambda x: x[2], reverse=True)
    table = "\n".join(f"- {n}({c}) {p:g}%" if c else f"- {n} {p:g}%" for n, c, p in ordered[:7])
    return f"{target_assessment} 비중 정보입니다.\n{table}"


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
    client = _get_genai_client()
    if client and genai_types is not None:
        context_blocks = []
        for i, hit in enumerate(hits_list[:6], start=1):
            context_blocks.append(
                f"[근거 {i}] syllabus_id={hit.get('syllabus_id')} chunk={hit.get('chunk_index')} score={hit.get('score', 0):.4f}\n"
                f"{str(hit.get('text') or '')[:1200]}"
            )
        prompt = (
            "너는 대학 실러버스 질의응답 도우미다. 질문에 대해 주어진 근거 텍스트만 사용해 한국어로 답해라.\n"
            "- 근거가 부족하면 추측하지 말고 부족하다고 명시.\n"
            "- 숫자/비율 질문은 가능한 한 값과 과목명을 함께 제시.\n"
            "- 답변은 짧고 명확하게 작성.\n\n"
            f"질문:\n{question}\n\n"
            "근거:\n" + "\n\n".join(context_blocks)
        )
        try:
            result = client.models.generate_content(
                model=os.environ.get("GEMINI_STRUCTURED_MODEL", "gemini-2.0-flash"),
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=StructuredRagAnswer,
                    temperature=0.1,
                ),
            )
            parsed = result.parsed or StructuredRagAnswer.model_validate_json(result.text or "{}")
            answer = parsed.answer.strip()
            if parsed.grounded_points:
                answer = answer + "\n\n근거 요약:\n" + "\n".join(f"- {p}" for p in parsed.grounded_points[:4])
            return answer
        except Exception:
            pass

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
