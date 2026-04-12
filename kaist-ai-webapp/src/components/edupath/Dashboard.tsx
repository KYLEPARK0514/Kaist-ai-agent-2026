import { useMemo, useState } from "react";
import {
  GraduationCap,
  AlertTriangle,
  BookOpen,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  ChevronRight,
  Brain,
  Target,
  Zap,
  XCircle,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAgentData } from "../../context/AgentDataContext";
import { useUserSession } from "../../context/UserSessionContext";

const graduationData = [
  { name: "필수과목", completed: 12, total: 18, color: "#6366f1" },
  { name: "선택과목", completed: 9, total: 15, color: "#8b5cf6" },
  { name: "연구방법론", completed: 3, total: 3, color: "#06b6d4" },
  { name: "논문/졸업연구", completed: 0, total: 9, color: "#10b981" },
];

const fallbackPie = [
  { name: "이수 완료", value: 24, color: "#6366f1" },
  { name: "수강 중", value: 6, color: "#8b5cf6" },
  { name: "잔여", value: 15, color: "#e0deff" },
];

const fallbackNext = [
  {
    code: "DS501",
    name: "머신러닝 심화",
    credits: 3,
    match: 98,
    type: "필수" as const,
    note: "AI 트랙 핵심 과목",
    risk: null as string | null,
  },
  {
    code: "DS502",
    name: "자연어처리",
    credits: 3,
    match: 95,
    type: "선택" as const,
    note: "졸업요건 선택 1과목",
    risk: null as string | null,
  },
  {
    code: "DS503",
    name: "연구윤리",
    credits: 2,
    match: 100,
    type: "필수" as const,
    note: "⚠ 이수 지연 위험",
    risk: "high" as const,
  },
];

const fallbackAlerts = [
  {
    level: "high" as const,
    title: "연구윤리 미이수",
    desc: "필수과목 '연구윤리'를 아직 이수하지 않았습니다. 다음 학기 내 반드시 수강 필요.",
    action: "수강 계획 추가",
  },
  {
    level: "medium" as const,
    title: "다음 학기 과부하 위험",
    desc: "현재 계획된 다음 학기 수강 학점(12학점)이 권장 상한(9학점)을 초과합니다.",
    action: "학기 조정",
  },
];

const fallbackInsights = [
  { icon: Brain, text: "NLP 분야 진출 목표와 연계하여 '자연어처리' 과목 우선 수강을 추천합니다." },
  { icon: Target, text: "현재 이수율 기준 최단 졸업 경로: 2026년 8월 (2학기 추가)" },
  { icon: Zap, text: "선수과목 기준 'Deep Learning' 수강 가능 상태 도달. 다음 학기 수강 추천." },
];

export function Dashboard() {
  const { data, loading, programSettings } = useAgentData();
  const { session, isLoggedIn } = useUserSession();
  const [activeInsight, setActiveInsight] = useState(0);

  const programTitle = programSettings.program_name?.trim() || "KAIST DFMBA (Digital Finance MBA)";
  const displayName = isLoggedIn ? session!.displayName : "DFMBA 학습자";
  const cohortLine = isLoggedIn && session?.cohortLabel ? ` · ${session.cohortLabel}` : "";

  const display = useMemo(() => {
    if (!data) {
      return {
        stats: [
          { label: "이수 학점", value: "24", sub: "/ 45학점", color: "text-indigo-600", bg: "bg-indigo-50", icon: BookOpen },
          { label: "현재 GPA", value: "3.8", sub: "/ 4.5", color: "text-violet-600", bg: "bg-violet-50", icon: TrendingUp },
          { label: "졸업까지", value: "21", sub: "학점 남음", color: "text-cyan-600", bg: "bg-cyan-50", icon: GraduationCap },
          { label: "리스크 경고", value: "2", sub: "건 활성", color: "text-amber-600", bg: "bg-amber-50", icon: AlertTriangle },
        ],
        pieData: fallbackPie,
        centerCredits: 24,
        centerTotal: 45,
        nextSemesterCourses: fallbackNext,
        recentAlerts: fallbackAlerts,
        aiInsights: fallbackInsights,
        progressPercent: Math.round((24 / 45) * 100),
        riskCount: 2,
        semesterLabel: "2026년 가을학기",
        subtitle: `${programTitle}${cohortLine}`,
      };
    }

    const gc = data.graduation_check;
    const programTotal = Math.max(data.program_total_credits, 1);
    const completed = data.completed_credits;
    const plannedPortion = Math.max(0, gc.total_credits - completed);
    const remaining = Math.max(0, gc.missing_total_credits);

    const pieData = [
      { name: "이수 완료", value: Math.max(completed, 0.001), color: "#6366f1" },
      { name: "계획 반영", value: Math.max(plannedPortion, 0.001), color: "#8b5cf6" },
      { name: "잔여", value: Math.max(remaining, 0.001), color: "#e0deff" },
    ];

    const first = data.semester_plan_detailed?.[0];
    const nextSemesterCourses =
      first?.course_details?.length && first.course_details.length > 0
        ? first.course_details.map((c, i) => ({
            code: c.code,
            name: c.title,
            credits: c.credits,
            match: Math.min(99, 85 + (c.code.length % 10) + i),
            type: (c.category === "core" ? "필수" : "선택") as "필수" | "선택",
            note: `${data.profile.career_goal} 목표와 정렬된 추천`,
            risk: null as string | null,
          }))
        : fallbackNext;

    const recentAlerts =
      data.risk_warnings.length > 0
        ? data.risk_warnings.slice(0, 4).map((w, i) => ({
            level:
              /prerequisite|Capstone|risk|missing/i.test(w) && i === 0
                ? ("high" as const)
                : ("medium" as const),
            title: w.length > 42 ? `${w.slice(0, 40)}…` : w,
            desc: w,
            action: "수강 계획 조정",
          }))
        : fallbackAlerts;

    const aiInsights =
      data.career_recommendations.length > 0
        ? [
            ...data.career_recommendations.slice(0, 2).map((r) => ({
              icon: Brain,
              text: `${r.title} (${r.code}) — ${r.reason}`,
            })),
            {
              icon: Zap,
              text:
                data.learning_path.length > 0
                  ? `학습 선후관계 그래프: ${data.learning_path.length}개의 선수·후속 엣지가 식별되었습니다.`
                  : "커리어 기반 과목 매칭을 계속 업데이트합니다.",
            },
          ]
        : fallbackInsights;

    const progressPercent = Math.min(100, Math.round((gc.total_credits / programTotal) * 100));

    return {
      stats: [
        {
          label: "이수 학점",
          value: String(completed),
          sub: `/ ${programTotal}학점`,
          color: "text-indigo-600",
          bg: "bg-indigo-50",
          icon: BookOpen,
        },
        { label: "현재 GPA", value: "3.8", sub: "/ 4.5", color: "text-violet-600", bg: "bg-violet-50", icon: TrendingUp },
        {
          label: "졸업까지",
          value: String(remaining),
          sub: "학점 남음",
          color: "text-cyan-600",
          bg: "bg-cyan-50",
          icon: GraduationCap,
        },
        {
          label: "리스크 경고",
          value: String(data.risk_warnings.length),
          sub: "건 활성",
          color: "text-amber-600",
          bg: "bg-amber-50",
          icon: AlertTriangle,
        },
      ],
      pieData,
      centerCredits: gc.total_credits,
      centerTotal: programTotal,
      nextSemesterCourses,
      recentAlerts,
      aiInsights,
      progressPercent,
      riskCount: data.risk_warnings.length,
      semesterLabel: `에이전트 계획 · ${data.profile.remaining_semesters}학기 시뮬레이션`,
      subtitle: `${programTitle}${cohortLine} · 커리어: ${data.profile.career_goal} · 학기당 최대 ${data.profile.max_credits_per_semester}학점`,
    };
  }, [cohortLine, data, programTitle]);

  const stats = display.stats;
  const pieData = display.pieData;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <span className="text-sm text-indigo-600 font-medium">AI 학사 비서</span>
            {loading && <span className="text-xs text-muted-foreground">(동기화 중)</span>}
          </div>
          <h1 className="text-foreground">안녕하세요, {displayName}님 👋</h1>
          <p className="text-muted-foreground text-sm mt-1">{display.subtitle}</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <span className="text-sm text-amber-700 font-medium">활성 리스크 {display.riskCount}건</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 ${stat.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${stat.color}`} />
                </div>
              </div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-muted-foreground text-xs mt-0.5">{stat.label}</div>
              <div className="text-muted-foreground/70 text-xs">{stat.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground">졸업요건 이수 현황</h3>
            <span className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full font-medium">
              {display.progressPercent}% 완료
            </span>
          </div>

          <div className="flex gap-6">
            <div className="flex-shrink-0">
              <ResponsiveContainer width={120} height={120}>
                <PieChart>
                  <Pie data={pieData} cx={55} cy={55} innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center -mt-2">
                <div className="text-xl font-bold text-indigo-600">{display.centerCredits}</div>
                <div className="text-xs text-muted-foreground">/ {display.centerTotal}학점</div>
              </div>
            </div>

            <div className="flex-1 space-y-3">
              {graduationData.map((item, i) => {
                const pct = Math.round((item.completed / item.total) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-foreground">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {item.completed}/{item.total}학점
                        {item.completed === item.total && (
                          <CheckCircle2 className="inline w-3 h-3 text-emerald-500 ml-1" />
                        )}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex gap-3 text-xs flex-wrap">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-muted-foreground">
                  {d.name} ({typeof d.value === "number" ? d.value.toFixed(1).replace(/\.0$/, "") : d.value}학점)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <h3 className="text-white text-sm font-semibold">AI 인사이트</h3>
          </div>
          <div className="space-y-3">
            {display.aiInsights.map((insight, i) => {
              const Icon = insight.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveInsight(i)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 ${
                    activeInsight === i
                      ? "bg-white/20 border border-white/30"
                      : "bg-white/10 hover:bg-white/15 border border-transparent"
                  }`}
                >
                  <div className="flex gap-2.5">
                    <Icon className="w-4 h-4 text-indigo-200 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-indigo-100 leading-relaxed">{insight.text}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="mt-4 w-full text-xs text-indigo-200 hover:text-white transition-colors flex items-center justify-center gap-1"
          >
            전체 AI 분석 보기 <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground">다음 학기 추천 수강</h3>
            <span className="text-xs text-muted-foreground">{display.semesterLabel}</span>
          </div>
          <div className="space-y-3">
            {display.nextSemesterCourses.map((course, i) => (
              <div
                key={`${course.code}-${i}`}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm ${
                  course.risk === "high"
                    ? "bg-amber-50 border-amber-200"
                    : "bg-muted/30 border-border hover:border-indigo-200"
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    course.type === "필수" ? "bg-indigo-100 text-indigo-700" : "bg-violet-100 text-violet-700"
                  }`}
                >
                  {course.credits}학
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{course.name}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        course.type === "필수" ? "bg-indigo-100 text-indigo-600" : "bg-violet-100 text-violet-600"
                      }`}
                    >
                      {course.type}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{course.note}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div
                    className={`text-sm font-bold ${
                      course.match >= 95 ? "text-emerald-600" : "text-indigo-600"
                    }`}
                  >
                    {course.match}%
                  </div>
                  <div className="text-xs text-muted-foreground">매칭</div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-4 w-full py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 수강계획 자동 생성
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-foreground">활성 리스크 경고</h3>
            <span className="text-xs bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full">
              {display.recentAlerts.length}건
            </span>
          </div>
          <div className="space-y-3">
            {display.recentAlerts.map((alert, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border ${
                  alert.level === "high" ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {alert.level === "high" ? (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium mb-1 ${
                        alert.level === "high" ? "text-red-700" : "text-amber-700"
                      }`}
                    >
                      {alert.title}
                    </div>
                    <p
                      className={`text-xs leading-relaxed ${
                        alert.level === "high" ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {alert.desc}
                    </p>
                    <button
                      type="button"
                      className={`mt-2 text-xs font-medium flex items-center gap-1 ${
                        alert.level === "high"
                          ? "text-red-600 hover:text-red-700"
                          : "text-amber-600 hover:text-amber-700"
                      }`}
                    >
                      {alert.action} <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-3 w-full py-2 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground text-sm transition-colors"
          >
            전체 리스크 보기
          </button>
        </div>
      </div>
    </div>
  );
}
