import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { DEFAULT_DFMBA_CAREERS, useAgentData } from "../context/AgentDataContext";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";

function parseCareerGoals(settings: Record<string, string>): string[] {
  const raw = settings.career_options || settings.careerGoals;
  if (!raw) {
    return [...DEFAULT_DFMBA_CAREERS];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      const cleaned = parsed.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
      return cleaned.length > 0 ? cleaned : [...DEFAULT_DFMBA_CAREERS];
    }
  } catch {
    /* ignore */
  }
  return [...DEFAULT_DFMBA_CAREERS];
}

export function AgentProfileBar() {
  const { profile, setProfile, loading, error, refresh, programSettings } = useAgentData();
  const [open, setOpen] = useState(false);

  const careers = useMemo(() => parseCareerGoals(programSettings), [programSettings]);

  useEffect(() => {
    if (!careers.includes(profile.career_goal)) {
      setProfile((p) => ({ ...p, career_goal: careers[0] }));
    }
  }, [careers, profile.career_goal, setProfile]);

  return (
    <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          DFMBA 학습 프로필
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white"
          disabled={loading}
          onClick={() => void refresh()}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          에이전트 분석 실행
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
        {loading && !error && <span className="text-xs text-muted-foreground">분석 중…</span>}
      </div>
      {open && (
        <div className="max-w-7xl mx-auto px-6 pb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label htmlFor="completed">이수 완료 과목 코드 (쉼표)</Label>
            <Input
              id="completed"
              value={profile.completed_courses.join(", ")}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  completed_courses: e.target.value
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean),
                }))
              }
              placeholder="DFM501, DFM502"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="career">커리어 트랙</Label>
            <select
              id="career"
              className="w-full h-9 rounded-md border border-border bg-input-background px-3 text-sm"
              value={profile.career_goal}
              onChange={(e) => setProfile((p) => ({ ...p, career_goal: e.target.value }))}
            >
              {careers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sem">남은 학기 수</Label>
            <Input
              id="sem"
              type="number"
              min={1}
              max={8}
              value={profile.remaining_semesters}
              onChange={(e) =>
                setProfile((p) => ({ ...p, remaining_semesters: Number(e.target.value) || 1 }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxc">학기당 최대 학점</Label>
            <Input
              id="maxc"
              type="number"
              min={3}
              max={18}
              value={profile.max_credits_per_semester}
              onChange={(e) =>
                setProfile((p) => ({
                  ...p,
                  max_credits_per_semester: Number(e.target.value) || 9,
                }))
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
