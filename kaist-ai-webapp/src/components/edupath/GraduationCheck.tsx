import { useMemo, useState } from "react";
import { useAgentData } from "../../context/AgentDataContext";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Info,
  Sparkles,
} from "lucide-react";

interface RequirementItem {
  code: string;
  name: string;
  credits: number;
  status: "completed" | "inProgress" | "missing" | "planned";
  note?: string;
  grade?: string;
}

interface RequirementGroup {
  id: string;
  name: string;
  required: number;
  completed: number;
  color: string;
  bgColor: string;
  items: RequirementItem[];
  rule?: string;
}

const requirements: RequirementGroup[] = [
  {
    id: "req1",
    name: "전공 필수 과목",
    required: 18,
    completed: 15,
    color: "text-indigo-600",
    bgColor: "bg-indigo-500",
    rule: "지정된 필수 과목 18학점 이수 필요",
    items: [
      { code: "DS401", name: "데이터사이언스 기초", credits: 3, status: "completed", grade: "A+" },
      { code: "DS402", name: "통계학 심화", credits: 3, status: "completed", grade: "A0" },
      { code: "DS410", name: "머신러닝 개론", credits: 3, status: "completed", grade: "A+" },
      { code: "DS411", name: "빅데이터 처리", credits: 3, status: "completed", grade: "B+" },
      { code: "DS501", name: "딥러닝", credits: 3, status: "inProgress" },
      { code: "DS512", name: "연구윤리", credits: 2, status: "missing", note: "⚠ 필수과목 미이수" },
      { code: "DS510", name: "머신러닝 심화", credits: 3, status: "planned" },
    ],
  },
  {
    id: "req2",
    name: "전공 선택 과목",
    required: 15,
    completed: 12,
    color: "text-violet-600",
    bgColor: "bg-violet-500",
    rule: "선택과목 중 15학점 이수 필요 (단일 과목 중복 불가)",
    items: [
      { code: "DS403", name: "파이썬 데이터분석", credits: 3, status: "completed", grade: "A+" },
      { code: "DS404", name: "데이터베이스 시스템", credits: 3, status: "completed", grade: "A0" },
      { code: "DS412", name: "컴퓨터비전 기초", credits: 3, status: "completed", grade: "B+" },
      { code: "DS413", name: "강화학습", credits: 3, status: "inProgress" },
      { code: "DS503", name: "데이터 시각화", credits: 3, status: "inProgress" },
      { code: "DS511", name: "자연어처리", credits: 3, status: "planned" },
    ],
  },
  {
    id: "req3",
    name: "연구방법론",
    required: 3,
    completed: 3,
    color: "text-cyan-600",
    bgColor: "bg-cyan-500",
    rule: "연구방법론 3학점 이수 (학기 내 이수 필수)",
    items: [
      { code: "DS413", name: "연구방법론", credits: 3, status: "completed", grade: "A0" },
    ],
  },
  {
    id: "req4",
    name: "논문 / 졸업 연구",
    required: 9,
    completed: 0,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
    rule: "졸업 논문 또는 프로젝트 9학점 (5학기 이후 신청 가능)",
    items: [
      { code: "DS600", name: "논문 연구 I", credits: 3, status: "planned" },
      { code: "DS601", name: "논문 연구 II", credits: 3, status: "planned" },
      { code: "DS602", name: "논문 연구 III", credits: 3, status: "planned" },
    ],
  },
];

const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
    label: "이수 완료",
    border: "border-emerald-100",
  },
  inProgress: {
    icon: AlertTriangle,
    color: "text-blue-500",
    bg: "bg-blue-50",
    label: "수강 중",
    border: "border-blue-100",
  },
  missing: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-50",
    label: "미이수",
    border: "border-red-200",
  },
  planned: {
    icon: Info,
    color: "text-gray-400",
    bg: "bg-gray-50",
    label: "계획",
    border: "border-gray-100",
  },
};

export function GraduationCheck() {
  const { data, refresh } = useAgentData();
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["req1", "req2"]));

  const agentSummary = useMemo(() => {
    if (!data) return null;
    const gc = data.graduation_check;
    const target = Math.max(data.program_total_credits, 1);
    const pct = Math.min(100, Math.round((gc.total_credits / target) * 100));
    return { gc, pct, target };
  }, [data]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalRequired = requirements.reduce((s, r) => s + r.required, 0);
  const totalCompleted = requirements.reduce((s, r) => s + r.completed, 0);
  const overallPct = Math.round((totalCompleted / totalRequired) * 100);

  const missingItems = requirements.flatMap((r) =>
    r.items.filter((i) => i.status === "missing").map((i) => ({ ...i, group: r.name }))
  );

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground">졸업요건 자동 검증</h1>
          <p className="text-muted-foreground text-sm mt-1">
            DFMBA 에이전트가 SQLite에 저장된 실러버스·프로그램 설정과 함께 졸업요건을 계산합니다. 상세 그룹은 예시 UI이며, 상단 배지는 서버 분석 결과입니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm hover:opacity-90 shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          재검증 실행
        </button>
      </div>

      {/* Overall summary */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 relative flex-shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="#e0deff" strokeWidth="8" />
              <circle
                cx="40"
                cy="40"
                r="32"
                fill="none"
                stroke="#6366f1"
                strokeWidth="8"
                strokeDasharray={`${((agentSummary?.pct ?? overallPct) / 100) * 201} 201`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-indigo-600">{agentSummary?.pct ?? overallPct}%</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap className="w-5 h-5 text-indigo-500" />
              <h3 className="text-foreground">졸업 가능 여부 분석</h3>
              {agentSummary ? (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    agentSummary.gc.is_graduation_ready
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {agentSummary.gc.is_graduation_ready ? "에이전트: 충족" : "에이전트: 보완 필요"}
                </span>
              ) : (
                <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full">조건부 충족</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {agentSummary ? (
                <>
                  Rule Engine 기준 총{" "}
                  <span className="text-indigo-600 font-medium">{agentSummary.gc.total_credits}학점</span>이 계획에 반영되었고,
                  목표 <span className="font-medium">{agentSummary.target}학점</span> 대비{" "}
                  {agentSummary.gc.missing_total_credits > 0 ? (
                    <span className="text-amber-600 font-medium">
                      {agentSummary.gc.missing_total_credits}학점이 추가로 필요
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-medium">총 학점 요건 충족</span>
                  )}
                  .
                  {agentSummary.gc.missing_required_courses.length > 0 && (
                    <>
                      {" "}
                      <span className="text-red-600 font-medium">
                        필수 과목 누락: {agentSummary.gc.missing_required_courses.join(", ")}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  전체 {totalRequired}학점 중 <span className="text-indigo-600 font-medium">{totalCompleted}학점</span> 이수
                  완료 또는 진행 중.{" "}
                  <span className="text-red-600 font-medium">'연구윤리' 미이수</span> 등 {missingItems.length}건의 필수 조건
                  미충족.
                </>
              )}
            </p>
            <div className="mt-3 grid grid-cols-4 gap-3">
              {requirements.map((r) => {
                const pct = Math.min(Math.round((r.completed / r.required) * 100), 100);
                const done = r.completed >= r.required;
                return (
                  <div key={r.id} className="text-center">
                    <div className={`text-sm font-bold ${done ? "text-emerald-600" : r.color}`}>
                      {r.completed}/{r.required}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.name.substring(0, 6)}</div>
                    <div className="mt-1 bg-muted rounded-full h-1">
                      <div
                        className={`h-1 rounded-full ${done ? "bg-emerald-500" : r.bgColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Missing items alert */}
      {missingItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">미충족 필수 조건 {missingItems.length}건</span>
          </div>
          <div className="space-y-1">
            {missingItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-red-600">{item.name} ({item.group})</span>
                <span className="text-red-500 text-xs">{item.credits}학점 미이수</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Requirement groups */}
      <div className="space-y-3">
        {requirements.map((req) => {
          const isExpanded = expanded.has(req.id);
          const pct = Math.min(Math.round((req.completed / req.required) * 100), 100);
          const done = req.completed >= req.required;
          const hasMissing = req.items.some((i) => i.status === "missing");

          return (
            <div
              key={req.id}
              className={`bg-card rounded-2xl border shadow-sm ${
                hasMissing ? "border-red-200" : done ? "border-emerald-200" : "border-border"
              }`}
            >
              <button
                onClick={() => toggle(req.id)}
                className="w-full flex items-center gap-4 p-4 hover:bg-muted/20 rounded-2xl transition-colors text-left"
              >
                <div className="flex-shrink-0">
                  {done ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  ) : hasMissing ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{req.name}</span>
                    {done && (
                      <span className="text-xs bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">완료</span>
                    )}
                    {hasMissing && (
                      <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">미이수 존재</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-1.5 max-w-48">
                      <div
                        className={`h-1.5 rounded-full ${done ? "bg-emerald-500" : req.bgColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-xs ${req.color}`}>
                      {req.completed}/{req.required}학점 ({pct}%)
                    </span>
                  </div>
                  {req.rule && (
                    <p className="text-xs text-muted-foreground mt-0.5">{req.rule}</p>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <div className="space-y-2">
                    {req.items.map((item) => {
                      const cfg = statusConfig[item.status];
                      const Icon = cfg.icon;
                      return (
                        <div
                          key={item.code}
                          className={`flex items-center gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border}`}
                        >
                          <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-foreground">{item.name}</span>
                              <span className="text-xs text-muted-foreground">{item.code}</span>
                            </div>
                            {item.note && (
                              <p className="text-xs text-red-600 mt-0.5">{item.note}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            {item.grade && (
                              <span className="text-xs font-bold text-indigo-600">{item.grade}</span>
                            )}
                            {!item.grade && (
                              <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
                            )}
                            <div className="text-xs text-muted-foreground">{item.credits}학점</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
