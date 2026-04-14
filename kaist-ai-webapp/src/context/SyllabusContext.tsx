import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const ADMIN_TOKEN_KEY = "edupath_admin_token_v1";
const STUDENT_PROGRESS_KEY = "edupath_student_progress_v1";

export type CourseGrade =
  | "A+"
  | "A0"
  | "A-"
  | "B+"
  | "B0"
  | "B-"
  | "C+"
  | "C0"
  | "C-"
  | "D"
  | "F"
  | "P"
  | "NP";

export interface StudentCourseProgress {
  completed: boolean;
  grade: CourseGrade | "";
}

export interface UploadedSyllabus {
  id: string;
  code: string;
  name: string;
  professor: string;
  credits: number;
  type: string;
  tags: string[];
  difficulty: number;
  workload: number;
  practiceRatio: number;
  teamwork: number;
  rating: number;
  summary: string;
  weeks: string[];
  assessments: { name: string; pct: number }[];
  prerequisites: string[];
  careerLinks: string[];
  aiSummary: string;
  sourceFileName: string;
  uploadedAt: string;
  fullText?: string;
}

interface SyllabusContextValue {
  syllabi: UploadedSyllabus[];
  progressByCourseId: Record<string, StudentCourseProgress>;
  loading: boolean;
  error: string | null;
  adminToken: string;
  setAdminToken: (token: string) => void;
  refresh: () => Promise<void>;
  addFiles: (files: FileList | null) => Promise<{ added: number; failed: string[] }>;
  ingestPdfBase64: (fileName: string, pdfBase64: string) => Promise<{ chunks: number }>;
  removeSyllabus: (id: string) => Promise<boolean>;
  clearAll: () => Promise<boolean>;
  updateCourseProgress: (courseId: string, patch: Partial<StudentCourseProgress>) => void;
}

const SyllabusContext = createContext<SyllabusContextValue | null>(null);

function createDefaultFromText(fileName: string, text: string): UploadedSyllabus {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const extractedCode = baseName.match(/[A-Za-z]{2,}\d{2,}/)?.[0] || "NEW000";
  const summary = text.trim().slice(0, 260) || "업로드된 실러버스 요약이 없습니다.";
  const weekLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /(week|주차|강의|lecture)/i.test(line))
    .slice(0, 8);

  return {
    id: crypto.randomUUID(),
    code: extractedCode.toUpperCase(),
    name: baseName,
    professor: "미지정",
    credits: 3,
    type: "전공선택",
    tags: ["업로드", "실러버스"],
    difficulty: 3,
    workload: 3,
    practiceRatio: 50,
    teamwork: 40,
    rating: 4.0,
    summary,
    weeks: weekLines.length > 0 ? weekLines : ["주차 정보 없음 (관리자 페이지에서 JSON 업로드 권장)"],
    assessments: [
      { name: "중간고사", pct: 30 },
      { name: "기말고사", pct: 30 },
      { name: "과제", pct: 40 },
    ],
    prerequisites: [],
    careerLinks: [],
    aiSummary: "업로드된 원문을 기반으로 생성된 기본 분석 결과입니다.",
    sourceFileName: fileName,
    uploadedAt: new Date().toISOString(),
    fullText: text,
  };
}

function normalizeJsonCourse(item: Record<string, unknown>, sourceFileName: string): UploadedSyllabus {
  const fallback = createDefaultFromText(sourceFileName, "");

  return {
    ...fallback,
    id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
    code: typeof item.code === "string" ? item.code : fallback.code,
    name: typeof item.name === "string" ? item.name : fallback.name,
    professor: typeof item.professor === "string" ? item.professor : fallback.professor,
    credits: typeof item.credits === "number" ? item.credits : fallback.credits,
    type: typeof item.type === "string" ? item.type : fallback.type,
    tags: Array.isArray(item.tags) ? item.tags.filter((v): v is string => typeof v === "string") : fallback.tags,
    difficulty: typeof item.difficulty === "number" ? item.difficulty : fallback.difficulty,
    workload: typeof item.workload === "number" ? item.workload : fallback.workload,
    practiceRatio: typeof item.practiceRatio === "number" ? item.practiceRatio : fallback.practiceRatio,
    teamwork: typeof item.teamwork === "number" ? item.teamwork : fallback.teamwork,
    rating: typeof item.rating === "number" ? item.rating : fallback.rating,
    summary: typeof item.summary === "string" ? item.summary : fallback.summary,
    weeks: Array.isArray(item.weeks) ? item.weeks.filter((v): v is string => typeof v === "string") : fallback.weeks,
    assessments: Array.isArray(item.assessments)
      ? item.assessments
          .map((it) => (typeof it === "object" && it ? it : null))
          .filter((it): it is { name?: unknown; pct?: unknown } => !!it)
          .map((it) => ({
            name: typeof it.name === "string" ? it.name : "평가",
            pct: typeof it.pct === "number" ? it.pct : 0,
          }))
      : fallback.assessments,
    prerequisites: Array.isArray(item.prerequisites)
      ? item.prerequisites.filter((v): v is string => typeof v === "string")
      : fallback.prerequisites,
    careerLinks: Array.isArray(item.careerLinks)
      ? item.careerLinks.filter((v): v is string => typeof v === "string")
      : fallback.careerLinks,
    aiSummary: typeof item.aiSummary === "string" ? item.aiSummary : fallback.aiSummary,
    sourceFileName,
    uploadedAt: new Date().toISOString(),
    fullText: typeof item.fullText === "string" ? item.fullText : fallback.fullText,
  };
}

async function parseFile(file: File): Promise<UploadedSyllabus[]> {
  const text = await file.text();
  const isJson = file.name.toLowerCase().endsWith(".json");
  if (!isJson) {
    return [createDefaultFromText(file.name, text)];
  }

  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    return parsed
      .filter((v): v is Record<string, unknown> => typeof v === "object" && v !== null)
      .map((item) => normalizeJsonCourse(item, file.name));
  }
  if (typeof parsed === "object" && parsed !== null) {
    return [normalizeJsonCourse(parsed as Record<string, unknown>, file.name)];
  }
  throw new Error("JSON 구조가 올바르지 않습니다.");
}

export function SyllabusProvider({ children }: { children: ReactNode }) {
  const [syllabi, setSyllabi] = useState<UploadedSyllabus[]>([]);
  const [progressByCourseId, setProgressByCourseId] = useState<Record<string, StudentCourseProgress>>(() => {
    try {
      const raw = localStorage.getItem(STUDENT_PROGRESS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return {};
      return parsed as Record<string, StudentCourseProgress>;
    } catch {
      return {};
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminToken, setAdminTokenState] = useState<string>(() => localStorage.getItem(ADMIN_TOKEN_KEY) || "");

  const setAdminToken = useCallback((token: string) => {
    setAdminTokenState(token);
    if (token) {
      localStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/syllabi");
      const json = (await response.json()) as { items?: UploadedSyllabus[]; error?: string };
      if (!response.ok) {
        throw new Error(json.error || "실러버스 조회에 실패했습니다.");
      }
      setSyllabi(Array.isArray(json.items) ? json.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    localStorage.setItem(STUDENT_PROGRESS_KEY, JSON.stringify(progressByCourseId));
  }, [progressByCourseId]);

  const ingestPdfBase64 = useCallback(
    async (fileName: string, pdfBase64: string) => {
      const response = await fetch("/api/admin/syllabi/ingest-pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({ fileName, pdfBase64 }),
      });
      const json = (await response.json()) as { error?: string; chunks?: number };
      if (!response.ok) {
        throw new Error(json.error || "PDF 업로드에 실패했습니다.");
      }
      await refresh();
      return { chunks: typeof json.chunks === "number" ? json.chunks : 0 };
    },
    [adminToken, refresh]
  );

  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return { added: 0, failed: [] };
    }

    const next: UploadedSyllabus[] = [];
    const failed: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const parsed = await parseFile(file);
        next.push(...parsed);
      } catch {
        failed.push(file.name);
      }
    }

    if (next.length > 0) {
      const response = await fetch("/api/admin/syllabi/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({ items: next }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(json.error || "업로드 저장에 실패했습니다.");
      }
      await refresh();
    }
    return { added: next.length, failed };
  }, [adminToken, refresh]);

  const removeSyllabus = useCallback(
    async (id: string) => {
      const response = await fetch(`/api/admin/syllabi/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "X-Admin-Token": adminToken },
      });
      if (!response.ok) {
        return false;
      }
      await refresh();
      return true;
    },
    [adminToken, refresh]
  );

  const clearAll = useCallback(async () => {
    const response = await fetch("/api/admin/syllabi", {
      method: "DELETE",
      headers: { "X-Admin-Token": adminToken },
    });
    if (!response.ok) {
      return false;
    }
    await refresh();
    return true;
  }, [adminToken, refresh]);

  const updateCourseProgress = useCallback((courseId: string, patch: Partial<StudentCourseProgress>) => {
    setProgressByCourseId((prev) => {
      const current = prev[courseId] || { completed: false, grade: "" };
      return {
        ...prev,
        [courseId]: { ...current, ...patch },
      };
    });
  }, []);

  const value = useMemo(
    () => ({
      syllabi,
      progressByCourseId,
      loading,
      error,
      adminToken,
      setAdminToken,
      refresh,
      addFiles,
      ingestPdfBase64,
      removeSyllabus,
      clearAll,
      updateCourseProgress,
    }),
    [
      syllabi,
      progressByCourseId,
      loading,
      error,
      adminToken,
      setAdminToken,
      refresh,
      addFiles,
      ingestPdfBase64,
      removeSyllabus,
      clearAll,
      updateCourseProgress,
    ]
  );

  return <SyllabusContext.Provider value={value}>{children}</SyllabusContext.Provider>;
}

export function useSyllabusData() {
  const ctx = useContext(SyllabusContext);
  if (!ctx) {
    throw new Error("useSyllabusData must be used within SyllabusProvider");
  }
  return ctx;
}
