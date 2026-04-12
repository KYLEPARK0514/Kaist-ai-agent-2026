/** SPA 화면 ID ↔ URL 해시 (정적 호스팅·Azure에서도 동작) */

export type AppPageId =
  | "dashboard"
  | "course-planner"
  | "graduation-check"
  | "syllabus-analysis"
  | "career-path"
  | "risk-alerts"
  | "admin-syllabus";

const HASH_TO_PAGE: Record<string, AppPageId> = {
  "": "dashboard",
  user: "dashboard",
  admin: "admin-syllabus",
  "course-planner": "course-planner",
  "graduation-check": "graduation-check",
  "syllabus-analysis": "syllabus-analysis",
  "career-path": "career-path",
  "risk-alerts": "risk-alerts",
  "admin-syllabus": "admin-syllabus",
};

const PAGE_TO_HASH: Record<AppPageId, string> = {
  dashboard: "#/",
  "course-planner": "#/course-planner",
  "graduation-check": "#/graduation-check",
  "syllabus-analysis": "#/syllabus-analysis",
  "career-path": "#/career-path",
  "risk-alerts": "#/risk-alerts",
  "admin-syllabus": "#/admin",
};

function hashSegment(): string {
  const h = window.location.hash.replace(/^#\/?/, "").trim();
  const seg = h.split("/")[0]?.toLowerCase() ?? "";
  return seg;
}

/** 현재 주소(해시 우선, 없으면 pathname)에서 초기 페이지 결정 */
export function getInitialPageFromLocation(): AppPageId {
  if (window.location.hash && window.location.hash.length > 1) {
    const seg = hashSegment();
    return HASH_TO_PAGE[seg] ?? "dashboard";
  }
  const path = window.location.pathname.toLowerCase();
  if (path.startsWith("/admin")) {
    return "admin-syllabus";
  }
  if (path === "/user" || path.startsWith("/user/")) {
    return "dashboard";
  }
  return "dashboard";
}

export function hashForPage(page: AppPageId): string {
  return PAGE_TO_HASH[page] ?? "#/";
}

export function pageFromHashOnly(): AppPageId {
  const seg = hashSegment();
  return HASH_TO_PAGE[seg] ?? "dashboard";
}
