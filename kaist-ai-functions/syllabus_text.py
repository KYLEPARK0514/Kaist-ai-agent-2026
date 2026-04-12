from __future__ import annotations

import base64
import io
import re
import uuid
from typing import Dict, List, Tuple

from pypdf import PdfReader


def extract_pdf_text(pdf_bytes: bytes) -> str:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    parts: List[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text() or ""
        except Exception:  # pylint: disable=broad-except
            t = ""
        if t.strip():
            parts.append(t)
    return "\n\n".join(parts).strip()


def extract_pdf_text_from_base64(b64: str) -> Tuple[bytes, str]:
    raw = base64.b64decode(b64, validate=False)
    return raw, extract_pdf_text(raw)


def _first_match(patterns: List[re.Pattern[str]], text: str) -> str | None:
    for pat in patterns:
        m = pat.search(text)
        if m and m.group(1).strip():
            return m.group(1).strip()
    return None


def _guess_code(text: str, file_stem: str) -> str:
    m = re.search(r"\b([A-Z]{2,5}\d{3,4})\b", text.upper())
    if m:
        return m.group(1)
    m2 = re.search(r"([A-Z]{2,5}\d{3,4})", file_stem.upper())
    if m2:
        return m2.group(1)
    return "DFMBA000"


def _guess_title(text: str, file_stem: str) -> str:
    title = _first_match(
        [
            re.compile(r"(?:과목명|교과목명|Course\s*Name)\s*[:：]\s*(.+)", re.I),
            re.compile(r"^\s*(.+?)\s*실러버스", re.M | re.I),
        ],
        text,
    )
    if title:
        return title[:120]
    line = next((ln.strip() for ln in text.splitlines() if len(ln.strip()) > 4), "")
    if line:
        return line[:120]
    return file_stem[:120] or "과목명 미상"


def _guess_professor(text: str) -> str:
    prof = _first_match(
        [
            re.compile(r"(?:담당교수|교수|Instructor|Professor)\s*[:：]\s*(.+)", re.I),
        ],
        text,
    )
    return (prof or "미지정")[:80]


def _guess_credits(text: str) -> int:
    m = _first_match(
        [
            re.compile(r"(?:학점|Credit[s]?)\s*[:：]?\s*(\d)\s*학?", re.I),
            re.compile(r"\b(\d)\s*credits?\b", re.I),
        ],
        text,
    )
    if m and m.isdigit():
        return max(1, min(9, int(m)))
    return 3


def _extract_weeks(text: str) -> List[str]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    weeks: List[str] = []
    pat = re.compile(r"(?:제?\s*(\d+)\s*주|Week\s*(\d+)|(\d+)\s*주차)", re.I)
    for ln in lines:
        if pat.search(ln):
            cleaned = re.sub(r"^\s*(?:제?\s*\d+\s*주|Week\s*\d+|\d+\s*주차)\s*[.:)\-–]\s*", "", ln, flags=re.I)
            if cleaned and len(cleaned) > 2:
                weeks.append(cleaned[:200])
    if not weeks:
        for ln in lines:
            if re.search(r"(강의|Lecture|Topic|내용)", ln, re.I) and len(weeks) < 12:
                weeks.append(ln[:200])
    return weeks[:16] if weeks else ["(주차 정보를 자동 추출하지 못했습니다. 원문 RAG 질의를 활용하세요.)"]


def _extract_assessments(text: str) -> List[Dict[str, float | str]]:
    out: List[Dict[str, float | str]] = []
    block = "\n".join(text.splitlines()[:400])
    for name, pat in [
        ("중간고사", r"중간\s*고사.*?(\d{1,3})\s*%"),
        ("기말고사", r"기말\s*고사.*?(\d{1,3})\s*%"),
        ("과제", r"과제.*?(\d{1,3})\s*%"),
        ("출석", r"출석.*?(\d{1,3})\s*%"),
        ("팀프로젝트", r"(?:팀\s*)?프로젝트.*?(\d{1,3})\s*%"),
        ("퀴즈", r"퀴즈.*?(\d{1,3})\s*%"),
    ]:
        m = re.search(pat, block, re.I | re.S)
        if m:
            pct = float(m.group(1))
            if 0 < pct <= 100:
                out.append({"name": name, "pct": pct})
    if not out:
        return [{"name": "평가항목(원문 확인)", "pct": 100.0}]
    total = sum(float(x["pct"]) for x in out)  # type: ignore[arg-type]
    if abs(total - 100) > 8:
        scale = 100.0 / max(total, 1e-6)
        out = [{"name": str(x["name"]), "pct": round(float(x["pct"]) * scale, 1)} for x in out]
    return out


def _extract_prereqs(text: str) -> List[str]:
    m = re.search(r"(?:선수과목|Prerequisite[s]?)\s*[:：]?\s*(.+)", text, re.I | re.S)
    if not m:
        return []
    chunk = m.group(1).splitlines()[0]
    parts = re.split(r"[,，/|]| 및 | 및", chunk)
    return [p.strip() for p in parts if len(p.strip()) > 1][:8]


def _score_from_text(text: str, keyword: str, base: int, span: int) -> int:
    c = len(re.findall(re.escape(keyword), text, flags=re.I))
    return max(1, min(5, base + min(span, c)))


def build_syllabus_record_from_text(*, text: str, file_name: str, source_kind: str) -> Dict:
    stem = re.sub(r"\.[^.]+$", "", file_name or "syllabus")
    code = _guess_code(text, stem)
    title = _guess_title(text, stem)
    prof = _guess_professor(text)
    credits = _guess_credits(text)
    weeks = _extract_weeks(text)
    assessments = _extract_assessments(text)
    prereqs = _extract_prereqs(text)

    difficulty = _score_from_text(text, "심화", 3, 1) if re.search("심화|advanced|proof", text, re.I) else 3
    workload = _score_from_text(text, "과제", 3, 1)
    practice = min(95, 35 + 10 * len(re.findall(r"(실습|코딩|Python|프로젝트|case study)", text, re.I)))
    teamwork = min(95, 30 + 8 * len(re.findall(r"(팀|그룹|group)", text, re.I)))

    summary = (text.replace("\r", "")[:900] + ("…" if len(text) > 900 else "")).strip()
    assess_bits = ", ".join(f"{a['name']} {a['pct']}%" for a in assessments[:4])
    ai_summary = (
        f"자동 추출 요약: {title}({code})는 {credits}학점 과목으로, "
        f"평가는 {assess_bits} 구성으로 보입니다. "
        "문서 기반 질의(RAG)로 세부 조항을 확인하세요."
    )

    course_type = "전공필수" if re.search(r"필수|required", text, re.I) else "전공선택"
    tags = ["DFMBA", "실러버스"]
    if re.search("금융|finance", text, re.I):
        tags.append("Finance")
    if re.search("AI|머신|딥|데이터", text, re.I):
        tags.append("AI/Data")

    career_links: List[str] = []
    if re.search("핀테크|fintech|디지털", text, re.I):
        career_links.append("핀테크/디지털금융")
    if re.search("전략|consulting|컨설팅", text, re.I):
        career_links.append("기업전략/컨설팅")
    if re.search("자산|운용|퀀트|portfolio", text, re.I):
        career_links.append("자산운용/퀀트")

    return {
        "id": str(uuid.uuid4()),
        "code": code,
        "name": title,
        "professor": prof,
        "credits": credits,
        "type": course_type,
        "tags": tags,
        "difficulty": difficulty,
        "workload": workload,
        "practiceRatio": int(practice),
        "teamwork": int(teamwork),
        "rating": 4.0,
        "summary": summary[:260],
        "weeks": weeks,
        "assessments": assessments,
        "prerequisites": prereqs,
        "careerLinks": career_links,
        "aiSummary": ai_summary,
        "sourceFileName": file_name,
        "uploadedAt": "",
        "fullText": text,
        "sourceKind": source_kind,
    }


def chunk_text(text: str, max_chars: int = 1100, overlap: int = 180) -> List[str]:
    cleaned = re.sub(r"[ \t]+", " ", text.replace("\r", "")).strip()
    if not cleaned:
        return []
    chunks: List[str] = []
    start = 0
    n = len(cleaned)
    while start < n:
        end = min(n, start + max_chars)
        piece = cleaned[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks
