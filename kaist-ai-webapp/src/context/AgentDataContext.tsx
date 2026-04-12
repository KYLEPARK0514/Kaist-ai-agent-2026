import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface AgentProfile {
  completed_courses: string[];
  career_goal: string;
  remaining_semesters: number;
  max_credits_per_semester: number;
}

export interface GraduationCheckPayload {
  is_graduation_ready: boolean;
  total_credits: number;
  core_credits: number;
  missing_required_courses: string[];
  missing_total_credits: number;
  missing_core_credits: number;
}

export interface CourseDetail {
  code: string;
  title: string;
  credits: number;
  category: string;
}

export interface SemesterPlanRow {
  semester: number;
  courses: string[];
  credits: number;
  course_details?: CourseDetail[];
}

export interface AgentAnalyzeResponse {
  profile: AgentProfile;
  completed_credits: number;
  program_total_credits: number;
  graduation_check: GraduationCheckPayload;
  semester_plan: SemesterPlanRow[];
  semester_plan_detailed: SemesterPlanRow[];
  career_recommendations: { code: string; title: string; score: number; reason: string }[];
  risk_warnings: string[];
  learning_path: { from: string; to: string }[];
  catalog_codes?: string[];
  requirements_snapshot?: {
    total_credits: number;
    core_min_credits: number;
    required_courses: string[];
  };
}

export const DEFAULT_DFMBA_CAREERS = [
  "FinTech/AI Product",
  "Corporate Finance & Strategy",
  "Asset Management & Quant",
] as const;

const defaultProfile: AgentProfile = {
  completed_courses: ["DFM501", "DFM502"],
  career_goal: DEFAULT_DFMBA_CAREERS[0],
  remaining_semesters: 2,
  max_credits_per_semester: 9,
};

interface AgentDataContextValue {
  profile: AgentProfile;
  setProfile: React.Dispatch<React.SetStateAction<AgentProfile>>;
  data: AgentAnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<AgentAnalyzeResponse | null>;
  programSettings: Record<string, string>;
  programSettingsLoading: boolean;
  reloadProgramSettings: () => Promise<void>;
}

const AgentDataContext = createContext<AgentDataContextValue | null>(null);

export function AgentDataProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AgentProfile>(defaultProfile);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const [data, setData] = useState<AgentAnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [programSettings, setProgramSettings] = useState<Record<string, string>>({});
  const [programSettingsLoading, setProgramSettingsLoading] = useState(true);

  const refresh = useCallback(async (): Promise<AgentAnalyzeResponse | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profileRef.current }),
      });
      const json = (await res.json()) as AgentAnalyzeResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "분석 요청에 실패했습니다.");
      }
      setData(json);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reloadProgramSettings = useCallback(async () => {
    setProgramSettingsLoading(true);
    try {
      const res = await fetch("/api/program/settings");
      const json = (await res.json()) as { settings?: Record<string, string> };
      setProgramSettings(json.settings && typeof json.settings === "object" ? json.settings : {});
    } catch {
      setProgramSettings({});
    } finally {
      setProgramSettingsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadProgramSettings();
  }, [reloadProgramSettings]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      data,
      loading,
      error,
      refresh,
      programSettings,
      programSettingsLoading,
      reloadProgramSettings,
    }),
    [profile, data, loading, error, refresh, programSettings, programSettingsLoading, reloadProgramSettings]
  );

  return <AgentDataContext.Provider value={value}>{children}</AgentDataContext.Provider>;
}

export function useAgentData() {
  const ctx = useContext(AgentDataContext);
  if (!ctx) {
    throw new Error("useAgentData must be used within AgentDataProvider");
  }
  return ctx;
}
