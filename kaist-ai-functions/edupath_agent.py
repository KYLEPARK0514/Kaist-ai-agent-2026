from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Dict, List, Optional, Set, Tuple


@dataclass(frozen=True)
class Course:
    code: str
    title: str
    credits: int
    category: str  # core | elective
    track: str
    prerequisites: Tuple[str, ...]
    workload: int  # 1-5
    skills: Tuple[str, ...]
    summary: str


# KAIST DFMBA(디지털금융 MBA) 기본 카탈로그 — 관리자 업로드 실러버스가 같은 코드로 들어오면 덮어씁니다.
CATALOG_BASE: Dict[str, Course] = {
    "DFM501": Course(
        code="DFM501",
        title="디지털 전환과 전략경영",
        credits=3,
        category="core",
        track="Strategy",
        prerequisites=(),
        workload=3,
        skills=("strategy", "digital", "leadership"),
        summary="디지털 전환(DX) 관점에서 경영전략 수립·실행 프레임을 학습합니다.",
    ),
    "DFM502": Course(
        code="DFM502",
        title="금융시장·데이터와 리스크",
        credits=3,
        category="core",
        track="Finance",
        prerequisites=(),
        workload=3,
        skills=("finance", "risk", "data-literacy"),
        summary="자본시장 구조, 금융데이터 해석, 리스크 관리의 기초를 다집니다.",
    ),
    "DFM503": Course(
        code="DFM503",
        title="머신러닝과 금융응용",
        credits=3,
        category="core",
        track="FinTech",
        prerequisites=("DFM502",),
        workload=4,
        skills=("python", "ml-modeling", "finance"),
        summary="금융 도메인 데이터에 대한 ML 모델링과 검증을 실습 중심으로 학습합니다.",
    ),
    "DFM504": Course(
        code="DFM504",
        title="회계·가치평가와 재무분석",
        credits=3,
        category="core",
        track="Finance",
        prerequisites=(),
        workload=3,
        skills=("accounting", "valuation", "excel"),
        summary="재무제표 분석, 기업가치 평가, 투자의사결정에 필요한 재무 프레임을 익힙니다.",
    ),
    "DFM505": Course(
        code="DFM505",
        title="AI 윤리·규제와 거버넌스",
        credits=2,
        category="core",
        track="Common",
        prerequisites=(),
        workload=2,
        skills=("governance", "ethics", "compliance"),
        summary="금융권 AI 도입의 규제·윤리 이슈와 내부통제 관점의 거버넌스를 다룹니다.",
    ),
    "DFM506": Course(
        code="DFM506",
        title="핀테크 스튜디오(프로젝트)",
        credits=3,
        category="elective",
        track="FinTech",
        prerequisites=("DFM503",),
        workload=4,
        skills=("product", "python", "presentation"),
        summary="핀테크 서비스 기획부터 프로토타입까지 팀 기반 프로젝트로 수행합니다.",
    ),
    "DFM507": Course(
        code="DFM507",
        title="기업금융·M&A 실무",
        credits=3,
        category="elective",
        track="Corporate",
        prerequisites=("DFM504",),
        workload=3,
        skills=("corporate-finance", "modeling", "presentation"),
        summary="기업금융 의사결정, 구조화, M&A 프로세스를 사례 중심으로 학습합니다.",
    ),
    "DFM508": Course(
        code="DFM508",
        title="디지털금융 캡스톤",
        credits=3,
        category="elective",
        track="Common",
        prerequisites=("DFM503", "DFM506"),
        workload=5,
        skills=("execution", "teamwork", "presentation"),
        summary="산업 연계형 캡스톤으로 통합 솔루션을 설계·발표합니다.",
    ),
}


CAREER_SKILLS: Dict[str, Set[str]] = {
    "FinTech/AI Product": {"python", "ml-modeling", "product", "data-literacy", "presentation"},
    "Corporate Finance & Strategy": {"corporate-finance", "valuation", "strategy", "excel", "presentation"},
    "Asset Management & Quant": {"finance", "risk", "ml-modeling", "statistics", "data-literacy"},
}


DEFAULT_REQUIREMENTS: Dict[str, object] = {
    "total_credits": 36,
    "core_min_credits": 18,
    "required_courses": {"DFM501", "DFM502"},
}


def _parse_code_list(raw: str | None) -> Set[str]:
    if not raw:
        return set()
    try:
        data = json.loads(raw)
        if isinstance(data, list):
            return {str(x).strip().upper() for x in data if str(x).strip()}
    except json.JSONDecodeError:
        pass
    return {p.strip().upper() for p in raw.split(",") if p.strip()}


def resolve_requirements(program_settings: Optional[Dict[str, str]] = None) -> Dict[str, object]:
    settings = program_settings or {}
    total = int(settings.get("total_credits") or DEFAULT_REQUIREMENTS["total_credits"])
    core_min = int(settings.get("core_min_credits") or DEFAULT_REQUIREMENTS["core_min_credits"])
    req_raw = settings.get("required_course_codes")
    required = _parse_code_list(req_raw) if req_raw else set(DEFAULT_REQUIREMENTS["required_courses"])  # type: ignore[arg-type]
    if not required:
        required = set(DEFAULT_REQUIREMENTS["required_courses"])  # type: ignore[assignment]
    return {"total_credits": total, "core_min_credits": core_min, "required_courses": required}


def _norm_category(type_str: str, _credits: int) -> str:
    t = (type_str or "").lower()
    if "필수" in type_str or "core" in t or "required" in t:
        return "core"
    return "elective"


def _skills_from_tags(tags: List[str]) -> Tuple[str, ...]:
    skills = [t.lower().replace(" ", "-") for t in tags if isinstance(t, str)]
    if not skills:
        return ("finance", "analysis")
    return tuple(skills[:6])


def course_from_syllabus_payload(entry: Dict) -> Optional[Course]:
    code = str(entry.get("code") or "").strip().upper()
    if not code:
        return None
    title = str(entry.get("name") or entry.get("title") or code).strip() or code
    credits = int(entry.get("credits") or 3)
    category = _norm_category(str(entry.get("type") or ""), credits)
    track = "FinTech"
    if isinstance(entry.get("tags"), list):
        tags_lower = " ".join(str(t) for t in entry["tags"]).lower()
        if "strategy" in tags_lower or "전략" in tags_lower:
            track = "Strategy"
        elif "corporate" in tags_lower or "기업" in tags_lower:
            track = "Corporate"
        elif "asset" in tags_lower or "운용" in tags_lower or "퀀트" in tags_lower:
            track = "Quant"
    prereqs = entry.get("prerequisites") or []
    pre_tuple = tuple(str(p).strip().upper() for p in prereqs if str(p).strip()) if isinstance(prereqs, list) else ()
    workload = int(entry.get("workload") or 3)
    skills = _skills_from_tags(entry["tags"]) if isinstance(entry.get("tags"), list) else ("finance",)
    summary = str(entry.get("summary") or entry.get("aiSummary") or "")[:400]
    return Course(
        code=code,
        title=title,
        credits=max(1, min(9, credits)),
        category=category,
        track=track,
        prerequisites=pre_tuple,
        workload=max(1, min(5, workload)),
        skills=skills,
        summary=summary or f"{title} 실러버스 기반 과목입니다.",
    )


def build_merged_catalog(syllabi: Optional[List[Dict]] = None) -> Dict[str, Course]:
    merged: Dict[str, Course] = dict(CATALOG_BASE)
    for entry in syllabi or []:
        if not isinstance(entry, dict):
            continue
        c = course_from_syllabus_payload(entry)
        if c:
            merged[c.code] = c
    return merged


def validate_graduation(
    completed_codes: List[str],
    planned_codes: List[str],
    catalog: Dict[str, Course],
    requirements: Dict[str, object],
) -> Dict:
    finished = set(str(c).strip().upper() for c in completed_codes)
    pipeline = finished.union({str(c).strip().upper() for c in planned_codes})

    total_credits = sum(catalog[c].credits for c in pipeline if c in catalog)
    core_credits = sum(
        catalog[c].credits for c in pipeline if c in catalog and catalog[c].category == "core"
    )
    req_set: Set[str] = requirements["required_courses"]  # type: ignore[assignment]
    missing_required = sorted(list(req_set - pipeline))
    missing_total = max(0, int(requirements["total_credits"]) - total_credits)
    missing_core = max(0, int(requirements["core_min_credits"]) - core_credits)

    return {
        "is_graduation_ready": len(missing_required) == 0 and missing_total == 0 and missing_core == 0,
        "total_credits": total_credits,
        "core_credits": core_credits,
        "missing_required_courses": missing_required,
        "missing_total_credits": missing_total,
        "missing_core_credits": missing_core,
    }


def _score_course_for_career(course: Course, career_goal: str) -> int:
    desired = CAREER_SKILLS.get(career_goal, CAREER_SKILLS["FinTech/AI Product"])
    return len(desired.intersection(set(course.skills)))


def _can_take(course: Course, completed: Set[str], selected_now: Set[str]) -> bool:
    reqs = set(course.prerequisites)
    return reqs.issubset(completed.union(selected_now))


def generate_semester_plan(
    completed_codes: List[str],
    career_goal: str,
    remaining_semesters: int,
    max_credits_per_semester: int,
    catalog: Dict[str, Course],
    requirements: Dict[str, object],
) -> Dict:
    completed = set(str(c).strip().upper() for c in completed_codes)
    candidates = [c for c in catalog.values() if c.code not in completed]
    req_set: Set[str] = requirements["required_courses"]  # type: ignore[assignment]

    ranked = sorted(
        candidates,
        key=lambda c: (
            0 if c.code in req_set else 1,
            -_score_course_for_career(c, career_goal),
            c.workload,
        ),
    )

    plan = []
    enrolled_total: List[str] = []

    for semester in range(1, remaining_semesters + 1):
        semester_courses: List[str] = []
        semester_credits = 0
        taken_this_sem = set()

        for course in ranked:
            if course.code in completed or course.code in enrolled_total:
                continue
            if semester_credits + course.credits > max_credits_per_semester:
                continue
            if not _can_take(course, completed, taken_this_sem):
                continue

            semester_courses.append(course.code)
            taken_this_sem.add(course.code)
            semester_credits += course.credits

        completed.update(taken_this_sem)
        enrolled_total.extend(semester_courses)
        plan.append(
            {
                "semester": semester,
                "courses": semester_courses,
                "credits": semester_credits,
            }
        )

    return {"semesters": plan, "all_planned_courses": enrolled_total}


def enrich_semester_plan(semesters: List[Dict], catalog: Dict[str, Course]) -> List[Dict]:
    out: List[Dict] = []
    for row in semesters:
        details = []
        for code in row.get("courses", []):
            c = catalog.get(code)
            details.append(
                {
                    "code": code,
                    "title": c.title if c else code,
                    "credits": c.credits if c else 0,
                    "category": c.category if c else "unknown",
                }
            )
        out.append({**row, "course_details": details})
    return out


def detect_risks(
    completed_codes: List[str],
    plan_codes: List[str],
    max_credits_per_semester: int,
    catalog: Dict[str, Course],
) -> List[str]:
    completed = set(str(c).strip().upper() for c in completed_codes)
    warnings: List[str] = []

    for code in plan_codes:
        if code not in catalog:
            continue
        course = catalog[code]
        unmet = set(course.prerequisites) - completed
        if unmet:
            warnings.append(
                f"{code} prerequisite risk: missing {', '.join(sorted(unmet))} before enrollment."
            )

    if max_credits_per_semester >= 12:
        warnings.append(
            "Workload risk: high max credits per semester may reduce performance for heavy courses."
        )

    if "DFM508" in plan_codes and "DFM503" not in completed.union(set(plan_codes)):
        warnings.append("Capstone risk: DFM508 is safer after DFM503 for modeling readiness.")

    return warnings


def suggest_career_courses(
    completed_codes: List[str],
    career_goal: str,
    catalog: Dict[str, Course],
) -> List[Dict]:
    completed = set(str(c).strip().upper() for c in completed_codes)
    suggestions = []
    for course in catalog.values():
        if course.code in completed:
            continue
        score = _score_course_for_career(course, career_goal)
        if score == 0:
            continue
        suggestions.append(
            {
                "code": course.code,
                "title": course.title,
                "score": score,
                "reason": f"Builds {', '.join(course.skills[:2])} aligned to {career_goal}.",
            }
        )
    return sorted(suggestions, key=lambda x: x["score"], reverse=True)[:5]


def learning_path_edges(catalog: Dict[str, Course]) -> List[Dict]:
    edges = []
    for course in catalog.values():
        for pre in course.prerequisites:
            edges.append({"from": pre, "to": course.code})
    return edges


def run_agent(
    profile: Dict,
    *,
    syllabi: Optional[List[Dict]] = None,
    program_settings: Optional[Dict[str, str]] = None,
) -> Dict:
    catalog = build_merged_catalog(syllabi)
    requirements = resolve_requirements(program_settings)

    completed_courses = [str(c).strip().upper() for c in profile.get("completed_courses", [])]
    career_goal = str(profile.get("career_goal") or "FinTech/AI Product")
    if career_goal not in CAREER_SKILLS:
        career_goal = "FinTech/AI Product"
    remaining_semesters = int(profile.get("remaining_semesters", 2))
    max_credits = int(profile.get("max_credits_per_semester", 9))

    completed_credits = sum(catalog[c].credits for c in completed_courses if c in catalog)

    plan = generate_semester_plan(
        completed_codes=completed_courses,
        career_goal=career_goal,
        remaining_semesters=remaining_semesters,
        max_credits_per_semester=max_credits,
        catalog=catalog,
        requirements=requirements,
    )

    graduation = validate_graduation(
        completed_courses,
        plan["all_planned_courses"],
        catalog,
        requirements,
    )
    risks = detect_risks(completed_courses, plan["all_planned_courses"], max_credits, catalog)
    recommendations = suggest_career_courses(completed_courses, career_goal, catalog)
    detailed = enrich_semester_plan(plan["semesters"], catalog)

    program_total = graduation["total_credits"] + graduation["missing_total_credits"]

    return {
        "profile": profile,
        "completed_credits": completed_credits,
        "program_total_credits": program_total,
        "graduation_check": graduation,
        "semester_plan": plan["semesters"],
        "semester_plan_detailed": detailed,
        "career_recommendations": recommendations,
        "risk_warnings": risks,
        "learning_path": learning_path_edges(catalog),
        "catalog_codes": sorted(catalog.keys()),
        "requirements_snapshot": {
            "total_credits": requirements["total_credits"],
            "core_min_credits": requirements["core_min_credits"],
            "required_courses": sorted(list(requirements["required_courses"])),  # type: ignore[arg-type]
        },
    }
