from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Set, Tuple


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


CATALOG: Dict[str, Course] = {
    "AI101": Course(
        code="AI101",
        title="Foundations of AI",
        credits=3,
        category="core",
        track="AI",
        prerequisites=(),
        workload=3,
        skills=("python", "math", "ml-basics"),
        summary="Covers machine learning fundamentals and practical Python workflows.",
    ),
    "DS201": Course(
        code="DS201",
        title="Data Engineering",
        credits=3,
        category="core",
        track="AI",
        prerequisites=("AI101",),
        workload=4,
        skills=("python", "data-pipeline", "sql"),
        summary="Builds reliable data pipelines for analytics and model training.",
    ),
    "ML301": Course(
        code="ML301",
        title="Applied Machine Learning",
        credits=3,
        category="core",
        track="AI",
        prerequisites=("AI101",),
        workload=4,
        skills=("ml-modeling", "python", "experimentation"),
        summary="Hands-on model development, validation, and deployment patterns.",
    ),
    "FIN220": Course(
        code="FIN220",
        title="Finance Analytics",
        credits=3,
        category="elective",
        track="Finance",
        prerequisites=(),
        workload=3,
        skills=("finance", "analytics", "excel"),
        summary="Applies analytics frameworks to valuation and investment decisions.",
    ),
    "STR210": Course(
        code="STR210",
        title="Strategic Problem Solving",
        credits=3,
        category="elective",
        track="Consulting",
        prerequisites=(),
        workload=2,
        skills=("problem-solving", "presentation", "business"),
        summary="Framework-driven problem decomposition and executive communication.",
    ),
    "STAT110": Course(
        code="STAT110",
        title="Statistics for Decision Making",
        credits=3,
        category="core",
        track="Common",
        prerequisites=(),
        workload=3,
        skills=("statistics", "math", "analysis"),
        summary="Probability, inference, and data-driven decision reasoning.",
    ),
    "CAP400": Course(
        code="CAP400",
        title="Industry Capstone",
        credits=3,
        category="elective",
        track="Common",
        prerequisites=("ML301", "STR210"),
        workload=5,
        skills=("teamwork", "presentation", "execution"),
        summary="Cross-functional capstone project with industry-style deliverables.",
    ),
}


CAREER_SKILLS: Dict[str, Set[str]] = {
    "AI Engineer": {"python", "ml-modeling", "data-pipeline", "statistics"},
    "Consultant": {"problem-solving", "presentation", "business", "analysis"},
    "Finance Analyst": {"finance", "analytics", "statistics", "excel"},
}


REQUIREMENTS = {
    "total_credits": 18,
    "core_min_credits": 9,
    "required_courses": {"AI101", "STAT110"},
}


def _score_course_for_career(course: Course, career_goal: str) -> int:
    desired = CAREER_SKILLS.get(career_goal, set())
    return len(desired.intersection(set(course.skills)))


def validate_graduation(completed_codes: List[str], planned_codes: List[str]) -> Dict:
    finished = set(completed_codes)
    pipeline = finished.union(set(planned_codes))

    total_credits = sum(CATALOG[c].credits for c in pipeline if c in CATALOG)
    core_credits = sum(
        CATALOG[c].credits for c in pipeline if c in CATALOG and CATALOG[c].category == "core"
    )
    missing_required = sorted(list(REQUIREMENTS["required_courses"] - pipeline))
    missing_total = max(0, REQUIREMENTS["total_credits"] - total_credits)
    missing_core = max(0, REQUIREMENTS["core_min_credits"] - core_credits)

    return {
        "is_graduation_ready": len(missing_required) == 0 and missing_total == 0 and missing_core == 0,
        "total_credits": total_credits,
        "core_credits": core_credits,
        "missing_required_courses": missing_required,
        "missing_total_credits": missing_total,
        "missing_core_credits": missing_core,
    }


def _can_take(course: Course, completed: Set[str], selected_now: Set[str]) -> bool:
    reqs = set(course.prerequisites)
    return reqs.issubset(completed.union(selected_now))


def generate_semester_plan(
    completed_codes: List[str],
    career_goal: str,
    remaining_semesters: int,
    max_credits_per_semester: int,
) -> Dict:
    completed = set(completed_codes)
    candidates = [c for c in CATALOG.values() if c.code not in completed]

    ranked = sorted(
        candidates,
        key=lambda c: (
            0 if c.code in REQUIREMENTS["required_courses"] else 1,
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


def enrich_semester_plan(semesters: List[Dict]) -> List[Dict]:
    out: List[Dict] = []
    for row in semesters:
        details = []
        for code in row.get("courses", []):
            c = CATALOG.get(code)
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


def detect_risks(completed_codes: List[str], plan_codes: List[str], max_credits_per_semester: int) -> List[str]:
    completed = set(completed_codes)
    warnings: List[str] = []

    for code in plan_codes:
        if code not in CATALOG:
            continue
        course = CATALOG[code]
        unmet = set(course.prerequisites) - completed
        if unmet:
            warnings.append(
                f"{code} prerequisite risk: missing {', '.join(sorted(unmet))} before enrollment."
            )

    if max_credits_per_semester >= 12:
        warnings.append(
            "Workload risk: high max credits per semester may reduce performance for heavy courses."
        )

    if "CAP400" in plan_codes and "ML301" not in completed.union(set(plan_codes)):
        warnings.append("Capstone risk: CAP400 recommended after ML301 for project readiness.")

    return warnings


def suggest_career_courses(completed_codes: List[str], career_goal: str) -> List[Dict]:
    completed = set(completed_codes)
    suggestions = []
    for course in CATALOG.values():
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


def learning_path_edges() -> List[Dict]:
    edges = []
    for course in CATALOG.values():
        for pre in course.prerequisites:
            edges.append({"from": pre, "to": course.code})
    return edges


def run_agent(profile: Dict) -> Dict:
    completed_courses = profile.get("completed_courses", [])
    career_goal = profile.get("career_goal", "AI Engineer")
    remaining_semesters = int(profile.get("remaining_semesters", 2))
    max_credits = int(profile.get("max_credits_per_semester", 9))

    completed_credits = sum(CATALOG[c].credits for c in completed_courses if c in CATALOG)

    plan = generate_semester_plan(
        completed_codes=completed_courses,
        career_goal=career_goal,
        remaining_semesters=remaining_semesters,
        max_credits_per_semester=max_credits,
    )

    graduation = validate_graduation(completed_courses, plan["all_planned_courses"])
    risks = detect_risks(completed_courses, plan["all_planned_courses"], max_credits)
    recommendations = suggest_career_courses(completed_courses, career_goal)
    detailed = enrich_semester_plan(plan["semesters"])

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
        "learning_path": learning_path_edges(),
    }
