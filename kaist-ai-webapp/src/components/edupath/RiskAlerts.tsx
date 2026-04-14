import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useAgentData } from "../../context/AgentDataContext";
import {
  AlertTriangle,
  XCircle,
  Info,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock,
  BookOpen,
  BarChart3,
  Shield,
  BellOff,
} from "lucide-react";

interface RiskAlert {
  id: string;
  level: "critical" | "warning" | "info";
  category: string;
  title: string;
  description: string;
  detail: string;
  affected: string;
  suggestion: string;
  alternativePlan?: string;
  resolved: boolean;
  date: string;
}

const initialAlerts: RiskAlert[] = [
  {
    id: "r1",
    level: "critical",
    category: "필수과목 미이수",
    title: "연구윤리 과목 미이수 (졸업 차단 위험)",
    description: "전공 필수과목 '연구윤리'를 아직 이수하지 않았습니다. 이 과목은 논문 연구 신청 전 반드시 이수해야 합니다.",
    detail: "연구윤리(DS512, 2학점)는 5학기 논문 연구 신청의 선행 조건입니다. 현재 3학기 기준 미이수 상태이며, 4학기 내 이수하지 않으면 졸업이 1학기 지연됩니다.",
    affected: "DS512 연구윤리 · 졸업요건",
    suggestion: "4학기 수강 계획에 '연구윤리' 추가를 즉시 권장합니다.",
    alternativePlan: "4학기: 연구윤리(2학점) + 머신러닝 심화(3학점) + 자연어처리(3학점) → 총 8학점 (권장 범위 내)",
    resolved: false,
    date: "2026-04-07",
  },
  {
    id: "r2",
    level: "warning",
    category: "학기 과부하",
    title: "4학기 수강 학점 초과 위험 (9학점 권장 → 현재 계획 12학점)",
    description: "현재 계획된 4학기 수강 학점이 12학점으로, 대학원 권장 상한(9학점)을 초과합니다.",
    detail: "대학원 과정의 권장 학기당 학점은 9학점입니다. 12학점 수강 시 개별 과목의 학습 완성도가 저하될 수 있으며, 특히 머신러닝 심화와 자연어처리는 모두 고난도·고워크로드 과목입니다. 두 과목 동시 수강 시 성적 저하 가능성이 있습니다.",
    affected: "DS510 머신러닝 심화 · DS511 자연어처리",
    suggestion: "자연어처리(DS511)를 5학기로 이동하거나, 선택과목 1개를 제외하고 9~10학점으로 조정하세요.",
    alternativePlan: "4학기: 연구윤리(2학점) + 머신러닝 심화(3학점) = 5학점 → 5학기: 자연어처리(3학점) + 논문연구I(3학점)",
    resolved: false,
    date: "2026-04-06",
  },
  {
    id: "r3",
    level: "info",
    category: "선수과목",
    title: "생성형 AI 수강 전 딥러닝 이수 강력 권장",
    description: "DS520 생성형 AI는 공식 선수과목이 없으나, 실러버스 분석 결과 딥러닝 기초 이해가 필수적입니다.",
    detail: "실러버스 분석 결과 생성형 AI 과목은 VAE, GAN, Diffusion 등 딥러닝 아키텍처를 전제로 합니다. 현재 딥러닝(DS501)을 수강 중이므로, 3학기 종료 후 4학기 이후 수강이 적절합니다.",
    affected: "DS520 생성형 AI",
    suggestion: "현재 수강 중인 딥러닝 과목 이수 후 다음 학기에 수강하세요.",
    resolved: false,
    date: "2026-04-05",
  },
  {
    id: "r4",
    level: "info",
    category: "졸업 일정",
    title: "현재 진도 기준 최단 졸업: 2027년 봄학기",
    description: "현재 이수 현황과 수강 계획을 기반으로 분석한 최단 졸업 일정은 2027년 봄학기(5학기)입니다.",
    detail: "잔여 학점 21학점 중 수강 중 6학점, 계획된 4~5학기 15학점. 연구윤리 미이수 문제가 해결되고 논문 연구 과목 3과목 이수 시 2027년 2월 졸업 가능합니다.",
    affected: "전체 이수 계획",
    suggestion: "현재 계획을 유지하되 연구윤리 이수 문제를 먼저 해결하세요.",
    resolved: false,
    date: "2026-04-04",
  },
  {
    id: "r5",
    level: "warning",
    category: "과목 조합",
    title: "고난도 과목 3개 동시 수강 학습 효율 저하 가능성",
    description: "3학기 현재 딥러닝, 강화학습, 데이터 시각화 동시 수강 중입니다. 딥러닝+강화학습 동시 수강은 개념 혼동 위험이 있습니다.",
    detail: "딥러닝(DS501)과 강화학습(DS502)은 상호 보완적이나 학습 방향성이 달라 초반 혼동이 발생할 수 있습니다. 실러버스 분석 결과 딥러닝을 먼저 이해한 후 강화학습 수강이 더 효과적입니다. 현재 학기는 이미 진행 중이므로 다음 학기 수강 계획 시 참고하세요.",
    affected: "DS501 딥러닝 · DS502 강화학습",
    suggestion: "이번 학기는 유지하되, 향후 비슷한 조합 수강 시 순차적 수강을 권장합니다.",
    resolved: true,
    date: "2026-03-20",
  },
];

const levelConfig = {
  critical: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    badge: "bg-red-100 text-red-700",
    label: "위험",
    headerBg: "bg-red-100",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    label: "경고",
    headerBg: "bg-amber-100",
  },
  info: {
    icon: Info,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    label: "알림",
    headerBg: "bg-blue-100",
  },
};

const categoryIcons: Record<string, ComponentType<{ className?: string }>> = {
  "필수과목 미이수": BookOpen,
  "학기 과부하": BarChart3,
  "선수과목": Shield,
  "졸업 일정": Clock,
  "과목 조합": AlertTriangle,
};

export function RiskAlerts() {
  const { data, refresh } = useAgentData();

  const mergedAlerts = useMemo(() => {
    const fromApi: RiskAlert[] = (data?.risk_warnings || []).map((w, i) => ({
      id: `api-${i}`,
      level: /prerequisite|Capstone/i.test(w) ? "critical" : /Workload/i.test(w) ? "warning" : "info",
      category: "에이전트 분석",
      title: w.length > 64 ? `${w.slice(0, 62)}…` : w,
      description: w,
      detail: w,
      affected: "현재 프로필 · 수강 계획",
      suggestion: "상단 프로필을 조정한 뒤 재분석을 실행하거나 수강 계획에서 과목 순서를 변경하세요.",
      resolved: false,
      date: new Date().toISOString().slice(0, 10),
    }));
    return [...fromApi, ...initialAlerts];
  }, [data]);

  const [alerts, setAlerts] = useState<RiskAlert[]>(initialAlerts);
  useEffect(() => {
    setAlerts(mergedAlerts);
  }, [mergedAlerts]);

  const [expandedAlerts, setExpandedAlerts] = useState<Set<string>>(new Set(["r1", "r2"]));
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");

  const toggleAlert = (id: string) => {
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resolveAlert = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, resolved: true } : a)));
    setExpandedAlerts((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const filtered = alerts.filter((a) => {
    if (filter === "active") return !a.resolved;
    if (filter === "resolved") return a.resolved;
    return true;
  });

  const criticalCount = alerts.filter((a) => !a.resolved && a.level === "critical").length;
  const warningCount = alerts.filter((a) => !a.resolved && a.level === "warning").length;
  const infoCount = alerts.filter((a) => !a.resolved && a.level === "info").length;

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground">리스크 경고 시스템</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI가 학습 리스크를 사전 감지하고 대안을 제시합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm hover:opacity-90 shadow-md"
        >
          <Sparkles className="w-4 h-4" />
          재분석 실행
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { level: "critical", count: criticalCount, label: "위험", icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
          { level: "warning", count: warningCount, label: "경고", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
          { level: "info", count: infoCount, label: "알림", icon: Info, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.level} className={`${s.bg} rounded-2xl border ${s.border} p-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label} 항목</div>
                </div>
                <Icon className={`w-8 h-8 ${s.color} opacity-30`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["active", "all", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-indigo-200"
            }`}
          >
            {f === "active" ? "활성 경고" : f === "resolved" ? "해결됨" : "전체"}
            {f === "active" && (
              <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                {criticalCount + warningCount + infoCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BellOff className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">표시할 경고가 없습니다</p>
          </div>
        )}

        {filtered.map((alert) => {
          const cfg = levelConfig[alert.level];
          const Icon = cfg.icon;
          const CatIcon = categoryIcons[alert.category] || AlertTriangle;
          const isExpanded = expandedAlerts.has(alert.id);

          return (
            <div
              key={alert.id}
              className={`bg-card rounded-2xl border shadow-sm transition-all ${
                alert.resolved ? "opacity-60 border-border" : cfg.border
              }`}
            >
              {/* Alert header */}
              <button
                onClick={() => toggleAlert(alert.id)}
                className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/20 rounded-2xl transition-colors"
              >
                <div className={`w-9 h-9 ${cfg.bg} rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5`}>
                  <Icon className={`w-4.5 h-4.5 ${cfg.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>{cfg.label}</span>
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CatIcon className="w-2.5 h-2.5" />
                      {alert.category}
                    </span>
                    {alert.resolved && (
                      <span className="text-xs bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        해결됨
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">{alert.date}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground leading-relaxed">{alert.title}</p>
                  {!isExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.description}</p>
                  )}
                </div>

                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Description */}
                  <div className={`${cfg.bg} rounded-xl p-3 border ${cfg.border}`}>
                    <p className="text-sm leading-relaxed text-foreground">{alert.detail}</p>
                  </div>

                  {/* Affected */}
                  <div className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">영향 범위</span>
                    <span className="text-xs text-foreground font-medium">{alert.affected}</span>
                  </div>

                  {/* Suggestion */}
                  <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="text-xs font-medium text-indigo-700">AI 권고사항</span>
                    </div>
                    <p className="text-xs text-indigo-700 leading-relaxed">{alert.suggestion}</p>
                  </div>

                  {/* Alternative plan */}
                  {alert.alternativePlan && (
                    <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-700">대안 수강 계획</span>
                      </div>
                      <p className="text-xs text-emerald-700 leading-relaxed font-mono">{alert.alternativePlan}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  {!alert.resolved && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs hover:bg-emerald-700 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        해결 처리
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl text-xs hover:bg-indigo-700 transition-colors">
                        <BookOpen className="w-3.5 h-3.5" />
                        수강 계획 반영
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-2 bg-card border border-border text-muted-foreground rounded-xl text-xs hover:bg-muted transition-colors">
                        <BellOff className="w-3.5 h-3.5" />
                        무시
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
