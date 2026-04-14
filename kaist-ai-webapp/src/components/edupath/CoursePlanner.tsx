import { useMemo, useState } from "react";
import { useAgentData, type AgentAnalyzeResponse } from "../../context/AgentDataContext";
import { useSyllabusData } from "../../context/SyllabusContext";
import {
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Download,
} from "lucide-react";

interface Course {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: "필수" | "선택" | "연구";
  status: "completed" | "inProgress" | "planned" | "recommended";
  risk?: string;
  careerMatch?: number;
}

interface Semester {
  id: string;
  label: string;
  year: number;
  season: string;
  courses: Course[];
  maxCredits: number;
}

const initialSemesters: Semester[] = [
  {
    id: "sem1",
    label: "1학기",
    year: 2025,
    season: "봄",
    maxCredits: 12,
    courses: [
      { id: "c1", code: "DS401", name: "데이터사이언스 기초", credits: 3, type: "필수", status: "completed" },
      { id: "c2", code: "DS402", name: "통계학 심화", credits: 3, type: "필수", status: "completed" },
      { id: "c3", code: "DS403", name: "파이썬 데이터분석", credits: 3, type: "선택", status: "completed" },
      { id: "c4", code: "DS404", name: "데이터베이스 시스템", credits: 3, type: "선택", status: "completed" },
    ],
  },
  {
    id: "sem2",
    label: "2학기",
    year: 2025,
    season: "가을",
    maxCredits: 12,
    courses: [
      { id: "c5", code: "DS410", name: "머신러닝 개론", credits: 3, type: "필수", status: "completed" },
      { id: "c6", code: "DS411", name: "빅데이터 처리", credits: 3, type: "필수", status: "completed" },
      { id: "c7", code: "DS412", name: "컴퓨터비전 기초", credits: 3, type: "선택", status: "completed" },
      { id: "c8", code: "DS413", name: "연구방법론", credits: 3, type: "연구", status: "completed" },
    ],
  },
  {
    id: "sem3",
    label: "3학기 (현재)",
    year: 2026,
    season: "봄",
    maxCredits: 9,
    courses: [
      { id: "c9", code: "DS501", name: "딥러닝", credits: 3, type: "필수", status: "inProgress" },
      { id: "c10", code: "DS502", name: "강화학습", credits: 3, type: "선택", status: "inProgress" },
      { id: "c11", code: "DS503", name: "데이터 시각화", credits: 3, type: "선택", status: "inProgress" },
    ],
  },
  {
    id: "sem4",
    label: "4학기",
    year: 2026,
    season: "가을",
    maxCredits: 9,
    courses: [
      { id: "c12", code: "DS510", name: "머신러닝 심화", credits: 3, type: "필수", status: "recommended", careerMatch: 98, risk: undefined },
      { id: "c13", code: "DS511", name: "자연어처리", credits: 3, type: "선택", status: "recommended", careerMatch: 95 },
      { id: "c14", code: "DS512", name: "연구윤리", credits: 2, type: "필수", status: "recommended", careerMatch: 100, risk: "필수과목 이수 지연 위험" },
    ],
  },
  {
    id: "sem5",
    label: "5학기",
    year: 2027,
    season: "봄",
    maxCredits: 9,
    courses: [
      { id: "c15", code: "DS600", name: "논문 연구 I", credits: 3, type: "연구", status: "planned" },
      { id: "c16", code: "DS601", name: "고급 딥러닝 응용", credits: 3, type: "선택", status: "planned", careerMatch: 92 },
    ],
  },
];

const availableCourses: Course[] = [
  { id: "av1", code: "DS520", name: "생성형 AI", credits: 3, type: "선택", status: "planned", careerMatch: 97 },
  { id: "av2", code: "DS521", name: "그래프 신경망", credits: 3, type: "선택", status: "planned", careerMatch: 88 },
  { id: "av3", code: "DS522", name: "엣지 AI", credits: 3, type: "선택", status: "planned", careerMatch: 82 },
  { id: "av4", code: "DS530", name: "AI 법률·윤리", credits: 2, type: "선택", status: "planned" },
];

const statusConfig = {
  completed: { label: "이수 완료", color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  inProgress: { label: "수강 중", color: "bg-blue-100 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  planned: { label: "계획", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  recommended: { label: "AI 추천", color: "bg-indigo-100 text-indigo-700 border-indigo-200", dot: "bg-indigo-500" },
};

const typeConfig = {
  "필수": "bg-red-50 text-red-600",
  "선택": "bg-violet-50 text-violet-600",
  "연구": "bg-cyan-50 text-cyan-600",
};

function buildPlannerSemesters(agent: AgentAnalyzeResponse): Semester[] {
  const baseYear = 2026;
  const seasons = ["가을", "봄"];
  const detailed = agent.semester_plan_detailed || [];
  return detailed.map((row, idx) => ({
    id: `agent-sem-${row.semester}`,
    label: `에이전트 ${row.semester}학기`,
    year: baseYear + Math.floor((idx + 1) / 2),
    season: seasons[idx % 2],
    maxCredits: agent.profile.max_credits_per_semester,
    courses: (row.course_details || []).map((c, i) => ({
      id: `agent-${row.semester}-${c.code}-${i}`,
      code: c.code,
      name: c.title,
      credits: c.credits,
      type: (c.category === "core" ? "필수" : "선택") as "필수" | "선택" | "연구",
      status: "recommended" as const,
      careerMatch: 88 + (i % 10),
      risk: undefined,
    })),
  }));
}

export function CoursePlanner() {
  const { data, refresh } = useAgentData();
  const { syllabi } = useSyllabusData();
  const [semesters, setSemesters] = useState(initialSemesters);
  const [expandedSems, setExpandedSems] = useState<Set<string>>(new Set(["sem3", "sem4"]));
  const [showAddCourse, setShowAddCourse] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const toggleSemester = (id: string) => {
    setExpandedSems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addCourse = (semId: string, course: Course) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semId ? { ...s, courses: [...s.courses, { ...course, id: `${course.id}-${semId}` }] } : s
      )
    );
    setShowAddCourse(null);
  };

  const removeCourse = (semId: string, courseId: string) => {
    setSemesters((prev) =>
      prev.map((s) =>
        s.id === semId ? { ...s, courses: s.courses.filter((c) => c.id !== courseId) } : s
      )
    );
  };

  const getTotalCredits = (sem: Semester) => sem.courses.reduce((s, c) => s + c.credits, 0);

  const addablePool = useMemo(() => {
    if (!syllabi.length) {
      return availableCourses;
    }
    return syllabi.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      credits: s.credits,
      type: (s.type.includes("필수") ? "필수" : "선택") as "필수" | "선택" | "연구",
      status: "planned" as const,
      careerMatch: 88 + (s.code.length % 10),
    }));
  }, [syllabi]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    const result = await refresh();
    if (result?.semester_plan_detailed?.length) {
      const planned = buildPlannerSemesters(result);
      setSemesters((prev) => {
        const head = prev.filter((s) => s.id === "sem1" || s.id === "sem2" || s.id === "sem3");
        return [...head, ...planned];
      });
      setExpandedSems(new Set(["sem3", ...planned.map((p) => p.id)]));
    }
    setGenerating(false);
  };

  const summary = data
    ? [
        {
          label: "총 이수 학점",
          value: String(data.completed_credits),
          total: `/ ${data.program_total_credits}`,
          color: "text-indigo-600",
        },
        {
          label: "에이전트 계획 학기",
          value: String(data.semester_plan_detailed?.length ?? 0),
          total: "학기",
          color: "text-emerald-600",
        },
        {
          label: "잔여 학점",
          value: String(data.graduation_check.missing_total_credits),
          total: "학점",
          color: "text-violet-600",
        },
        {
          label: "졸업 검증",
          value: data.graduation_check.is_graduation_ready ? "충족" : "보완 필요",
          total: "",
          color: data.graduation_check.is_graduation_ready ? "text-emerald-600" : "text-amber-600",
        },
      ]
    : [
        { label: "총 이수 학점", value: "24", total: "/ 45", color: "text-indigo-600" },
        { label: "완료 학기", value: "2", total: "/ 5", color: "text-emerald-600" },
        { label: "잔여 학점", value: "21", total: "학점", color: "text-violet-600" },
        { label: "예상 졸업", value: "2027.2", total: "봄학기", color: "text-cyan-600" },
      ];

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground">수강 설계 자동화</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI가 졸업요건과 커리어 목표를 분석하여 최적의 수강 계획을 생성합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-60 shadow-md"
          >
            {generating ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 자동 생성
              </>
            )}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border text-foreground rounded-xl text-sm hover:bg-muted/50 transition-colors">
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="grid grid-cols-4 gap-4 text-center">
          {summary.map((s, i) => (
            <div key={i}>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">
                {s.label} {s.total}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-3">
        {semesters.map((sem) => {
          const total = getTotalCredits(sem);
          const isOver = total > sem.maxCredits;
          const isExpanded = expandedSems.has(sem.id);
          const isCurrent = sem.id === "sem3";

          return (
            <div
              key={sem.id}
              className={`bg-card rounded-2xl border shadow-sm transition-all ${
                isOver ? "border-amber-300" : isCurrent ? "border-indigo-300" : "border-border"
              }`}
            >
              {/* Semester header */}
              <button
                onClick={() => toggleSemester(sem.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/20 rounded-2xl transition-colors"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  sem.id === "sem1" || sem.id === "sem2" ? "bg-emerald-100 text-emerald-700" :
                  isCurrent ? "bg-indigo-100 text-indigo-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {sem.id === "sem1" || sem.id === "sem2" ? <CheckCircle2 className="w-5 h-5" /> : sem.label.charAt(0)}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{sem.year}년 {sem.season}학기 ({sem.label})</span>
                    {isCurrent && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">진행 중</span>
                    )}
                    {isOver && (
                      <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />과부하 위험
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 bg-muted rounded-full h-1.5 max-w-32">
                      <div
                        className={`h-1.5 rounded-full transition-all ${isOver ? "bg-amber-500" : "bg-indigo-500"}`}
                        style={{ width: `${Math.min((total / sem.maxCredits) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs ${isOver ? "text-amber-600" : "text-muted-foreground"}`}>
                      {total}/{sem.maxCredits}학점
                    </span>
                    <span className="text-xs text-muted-foreground">{sem.courses.length}과목</span>
                  </div>
                </div>

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* Course list */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-2">
                  {sem.courses.map((course) => {
                    const cfg = statusConfig[course.status];
                    return (
                      <div
                        key={course.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.color} group`}
                      >
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <div className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${typeConfig[course.type]}`}>
                          {course.type}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm text-foreground font-medium">{course.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{course.code}</span>
                          {course.risk && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              <span className="text-xs text-amber-600">{course.risk}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {course.careerMatch && (
                            <span className="text-xs text-emerald-600 font-medium">{course.careerMatch}% 매칭</span>
                          )}
                          <span className="text-xs text-muted-foreground">{course.credits}학점</span>
                          {course.status !== "completed" && course.status !== "inProgress" && (
                            <button
                              onClick={() => removeCourse(sem.id, course.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Add course button */}
                  {sem.id !== "sem1" && sem.id !== "sem2" && (
                    <div>
                      {showAddCourse === sem.id ? (
                        <div className="bg-muted/30 rounded-xl p-3 border border-border">
                          <p className="text-xs text-muted-foreground mb-2">추가할 과목 선택</p>
                          <div className="space-y-1.5">
                            {addablePool.map((c) => (
                              <button
                                key={c.id}
                                onClick={() => addCourse(sem.id, c)}
                                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 border border-transparent text-left transition-colors"
                              >
                                <div>
                                  <span className="text-sm text-foreground">{c.name}</span>
                                  <span className="text-xs text-muted-foreground ml-2">{c.code}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {c.careerMatch && (
                                    <span className="text-xs text-emerald-600">{c.careerMatch}%</span>
                                  )}
                                  <span className="text-xs text-muted-foreground">{c.credits}학점</span>
                                </div>
                              </button>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowAddCourse(null)}
                            className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowAddCourse(sem.id)}
                          className="w-full flex items-center justify-center gap-2 p-2 rounded-xl border border-dashed border-border text-muted-foreground hover:border-indigo-300 hover:text-indigo-600 transition-colors text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          과목 추가
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {Object.entries(statusConfig).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${val.dot}`} />
            <span>{val.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}