import { useState, type ComponentType } from "react";
import { useAgentData } from "../../context/AgentDataContext";
import {
  Sparkles,
  CheckCircle2,
  ChevronRight,
  TrendingUp,
  Code2,
  BarChart3,
  Brain,
  Target,
  ArrowRight,
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";

interface CareerGoal {
  id: string;
  title: string;
  titleEn: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  borderColor: string;
  desc: string;
  demand: string;
  skills: { name: string; level: number; current: number }[];
  recommendedCourses: {
    code: string;
    name: string;
    match: number;
    reason: string;
    status: "completed" | "inProgress" | "planned" | "recommended";
  }[];
  radarData: { subject: string; required: number; current: number }[];
}

const careerGoals: CareerGoal[] = [
  {
    id: "nlp",
    title: "NLP 엔지니어",
    titleEn: "NLP Engineer",
    icon: Brain,
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-300",
    desc: "자연어 처리 모델 개발 및 LLM 기반 서비스를 구축합니다",
    demand: "수요 매우 높음",
    skills: [
      { name: "딥러닝", level: 90, current: 65 },
      { name: "자연어처리", level: 95, current: 20 },
      { name: "Python/PyTorch", level: 85, current: 70 },
      { name: "LLM Fine-tuning", level: 80, current: 10 },
      { name: "데이터 처리", level: 70, current: 75 },
    ],
    recommendedCourses: [
      { code: "DS511", name: "자연어처리", match: 99, reason: "핵심 직무 역량 과목", status: "recommended" },
      { code: "DS510", name: "머신러닝 심화", match: 95, reason: "이론적 기반 강화", status: "recommended" },
      { code: "DS520", name: "생성형 AI", match: 92, reason: "LLM 실습 경험", status: "recommended" },
      { code: "DS501", name: "딥러닝", match: 88, reason: "선수 이론 보완", status: "inProgress" },
      { code: "DS403", name: "파이썬 데이터분석", match: 75, reason: "기초 역량", status: "completed" },
    ],
    radarData: [
      { subject: "ML 이론", required: 80, current: 65 },
      { subject: "NLP 기술", required: 95, current: 20 },
      { subject: "딥러닝", required: 90, current: 60 },
      { subject: "데이터 처리", required: 70, current: 75 },
      { subject: "실무 경험", required: 75, current: 40 },
    ],
  },
  {
    id: "ds",
    title: "데이터 사이언티스트",
    titleEn: "Data Scientist",
    icon: BarChart3,
    color: "text-violet-600",
    bgColor: "bg-violet-50",
    borderColor: "border-violet-300",
    desc: "데이터 분석과 예측 모델링으로 비즈니스 인사이트를 도출합니다",
    demand: "수요 높음",
    skills: [
      { name: "통계학", level: 85, current: 75 },
      { name: "머신러닝", level: 80, current: 70 },
      { name: "데이터 시각화", level: 75, current: 65 },
      { name: "SQL/데이터베이스", level: 70, current: 80 },
      { name: "비즈니스 분석", level: 70, current: 30 },
    ],
    recommendedCourses: [
      { code: "DS503", name: "데이터 시각화", match: 95, reason: "핵심 시각화 역량", status: "inProgress" },
      { code: "DS402", name: "통계학 심화", match: 90, reason: "분석 기반 강화", status: "completed" },
      { code: "DS510", name: "머신러닝 심화", match: 88, reason: "예측 모델 고도화", status: "recommended" },
      { code: "DS404", name: "데이터베이스 시스템", match: 80, reason: "데이터 처리 능력", status: "completed" },
    ],
    radarData: [
      { subject: "통계 분석", required: 85, current: 75 },
      { subject: "ML 모델링", required: 80, current: 70 },
      { subject: "시각화", required: 75, current: 65 },
      { subject: "SQL/DB", required: 70, current: 80 },
      { subject: "비즈니스 이해", required: 70, current: 30 },
    ],
  },
  {
    id: "ml",
    title: "ML 엔지니어",
    titleEn: "ML Engineer",
    icon: Code2,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-300",
    desc: "ML 모델을 프로덕션 환경에 배포하고 MLOps 파이프라인을 관리합니다",
    demand: "수요 매우 높음",
    skills: [
      { name: "MLOps", level: 85, current: 15 },
      { name: "딥러닝 프레임워크", level: 90, current: 60 },
      { name: "시스템 설계", level: 80, current: 40 },
      { name: "빅데이터 처리", level: 75, current: 70 },
      { name: "클라우드 인프라", level: 70, current: 20 },
    ],
    recommendedCourses: [
      { code: "DS411", name: "빅데이터 처리", match: 92, reason: "데이터 파이프라인 역량", status: "completed" },
      { code: "DS510", name: "머신러닝 심화", match: 90, reason: "모델 최적화 기반", status: "recommended" },
      { code: "DS501", name: "딥러닝", match: 88, reason: "프레임워크 심화 학습", status: "inProgress" },
      { code: "DS520", name: "생성형 AI", match: 78, reason: "최신 모델 이해", status: "recommended" },
    ],
    radarData: [
      { subject: "MLOps", required: 85, current: 15 },
      { subject: "딥러닝", required: 90, current: 60 },
      { subject: "시스템 설계", required: 80, current: 40 },
      { subject: "빅데이터", required: 75, current: 70 },
      { subject: "클라우드", required: 70, current: 20 },
    ],
  },
  {
    id: "researcher",
    title: "AI 연구원",
    titleEn: "AI Researcher",
    icon: Target,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-300",
    desc: "학술 연구와 논문 발표를 통해 AI 기술의 최전선에서 활동합니다",
    demand: "수요 보통",
    skills: [
      { name: "수학/통계 이론", level: 95, current: 70 },
      { name: "논문 작성", level: 85, current: 30 },
      { name: "실험 설계", level: 80, current: 40 },
      { name: "최신 AI 동향", level: 90, current: 55 },
      { name: "영어 학술 역량", level: 75, current: 50 },
    ],
    recommendedCourses: [
      { code: "DS413", name: "연구방법론", match: 98, reason: "연구 기반 필수", status: "completed" },
      { code: "DS510", name: "머신러닝 심화", match: 95, reason: "이론적 깊이", status: "recommended" },
      { code: "DS520", name: "생성형 AI", match: 88, reason: "최신 연구 트렌드", status: "recommended" },
      { code: "DS600", name: "논문 연구 I", match: 99, reason: "연구 활동 직결", status: "planned" },
    ],
    radarData: [
      { subject: "수학 이론", required: 95, current: 70 },
      { subject: "논문 역량", required: 85, current: 30 },
      { subject: "실험 설계", required: 80, current: 40 },
      { subject: "AI 동향", required: 90, current: 55 },
      { subject: "학술 영어", required: 75, current: 50 },
    ],
  },
];

const statusConfig = {
  completed: { label: "이수 완료", color: "text-emerald-600", bg: "bg-emerald-50" },
  inProgress: { label: "수강 중", color: "text-blue-600", bg: "bg-blue-50" },
  planned: { label: "계획", color: "text-gray-500", bg: "bg-gray-50" },
  recommended: { label: "AI 추천", color: "text-indigo-600", bg: "bg-indigo-50" },
};

export function CareerPath() {
  const { data } = useAgentData();
  const [selectedCareer, setSelectedCareer] = useState<CareerGoal>(careerGoals[0]);
  const CareerIcon = selectedCareer.icon;

  const overallMatch = Math.round(
    (selectedCareer.skills.reduce((s, skill) => s + (skill.current / skill.level) * 100, 0) /
      selectedCareer.skills.length)
  );

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-foreground">커리어 연계 추천</h1>
        <p className="text-muted-foreground text-sm mt-1">
          목표 직무에 맞는 과목을 스킬 매핑 기반으로 추천합니다
        </p>
      </div>

      {/* Career selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {careerGoals.map((goal) => {
          const Icon = goal.icon;
          const isSelected = selectedCareer.id === goal.id;
          return (
            <button
              key={goal.id}
              onClick={() => setSelectedCareer(goal)}
              className={`p-4 rounded-2xl border text-left transition-all hover:shadow-md ${
                isSelected
                  ? `${goal.bgColor} ${goal.borderColor} shadow-md`
                  : "bg-card border-border hover:border-indigo-200"
              }`}
            >
              <div className={`w-9 h-9 ${isSelected ? "bg-white/60" : goal.bgColor} rounded-xl flex items-center justify-center mb-2`}>
                <Icon className={`w-4.5 h-4.5 ${goal.color}`} />
              </div>
              <div className={`text-sm font-medium ${isSelected ? goal.color : "text-foreground"}`}>
                {goal.title}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{goal.titleEn}</div>
              {isSelected && (
                <div className={`mt-1.5 text-xs ${goal.color} font-medium`}>현재 선택</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Career overview + skill gap */}
        <div className="space-y-4">
          {/* Career card */}
          <div className={`${selectedCareer.bgColor} rounded-2xl p-4 border ${selectedCareer.borderColor}`}>
            <div className="flex items-center gap-2 mb-2">
              <CareerIcon className={`w-4 h-4 ${selectedCareer.color}`} />
              <h3 className={selectedCareer.color}>{selectedCareer.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{selectedCareer.desc}</p>
            <div className="mt-3 flex items-center gap-2">
              <TrendingUp className={`w-3.5 h-3.5 ${selectedCareer.color}`} />
              <span className={`text-xs font-medium ${selectedCareer.color}`}>{selectedCareer.demand}</span>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">현재 역량 매칭도</span>
                <span className={`text-sm font-bold ${selectedCareer.color}`}>{overallMatch}%</span>
              </div>
              <div className="bg-white/50 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-current transition-all duration-700"
                  style={{ width: `${overallMatch}%`, color: selectedCareer.color.replace("text-", "bg-") }}
                />
              </div>
            </div>
          </div>

          {/* Skill gap */}
          <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <h4 className="text-foreground mb-3">스킬 갭 분석</h4>
            <div className="space-y-3">
              {selectedCareer.skills.map((skill, i) => {
                const gapPct = Math.round((skill.current / skill.level) * 100);
                const isGood = gapPct >= 80;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-foreground">{skill.name}</span>
                      <span className={`text-xs font-medium ${isGood ? "text-emerald-600" : "text-amber-600"}`}>
                        {gapPct}%
                      </span>
                    </div>
                    <div className="relative">
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all duration-700 ${isGood ? "bg-emerald-500" : "bg-amber-500"}`}
                          style={{ width: `${gapPct}%` }}
                        />
                      </div>
                      <div
                        className="absolute top-0 w-0.5 h-1.5 bg-indigo-400"
                        style={{ left: `${skill.level}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">세로 선 = 목표 수준</p>
          </div>
        </div>

        {/* Center: Radar chart */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <h4 className="text-foreground mb-3">역량 레이더 분석</h4>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={selectedCareer.radarData}>
              <PolarGrid stroke="#e0deff" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid #e0deff",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              <Radar name="필요 수준" dataKey="required" stroke="#e0deff" fill="#e0deff" fillOpacity={0.4} />
              <Radar name="현재 수준" dataKey="current" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-5 text-xs mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-indigo-400 rounded" />
              <span className="text-muted-foreground">현재 수준</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-muted-foreground rounded" />
              <span className="text-muted-foreground">필요 수준</span>
            </div>
          </div>

          {/* AI message */}
          <div className="mt-4 bg-indigo-50 rounded-xl p-3 border border-indigo-100">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-xs font-medium text-indigo-700">AI 진단</span>
            </div>
            <p className="text-xs text-indigo-700 leading-relaxed">
              {selectedCareer.id === "nlp"
                ? "자연어처리·LLM 관련 역량이 부족합니다. 'NLP' 과목 수강이 가장 급선무입니다."
                : selectedCareer.id === "ds"
                ? "전반적으로 균형 잡힌 역량을 갖추고 있습니다. 비즈니스 이해 강화가 차별화 포인트입니다."
                : selectedCareer.id === "ml"
                ? "MLOps 역량이 크게 부족합니다. 시스템 설계 관련 과목 수강을 우선 추천합니다."
                : "수학적 기반은 충분하나 논문 작성·연구 설계 경험이 부족합니다. 논문 연구 과목 신청을 권장합니다."}
            </p>
          </div>
        </div>

        {/* Right: Recommended courses */}
        <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
          <h4 className="text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            맞춤 과목 추천
          </h4>
          {data && data.career_recommendations.length > 0 && (
            <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3">
              <p className="text-xs font-medium text-indigo-700 mb-2">
                에이전트 추천 (프로필: {data.profile.career_goal})
              </p>
              <div className="space-y-2">
                {data.career_recommendations.map((c) => (
                  <div key={c.code} className="flex items-start justify-between gap-2 text-xs">
                    <div>
                      <span className="font-medium text-foreground">{c.title}</span>
                      <span className="text-muted-foreground ml-1">{c.code}</span>
                      <p className="text-muted-foreground mt-0.5">{c.reason}</p>
                    </div>
                    <span className="text-indigo-600 font-bold flex-shrink-0">{c.score}pt</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2.5">
            {selectedCareer.recommendedCourses.map((course, i) => {
              const cfg = statusConfig[course.status];
              return (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                >
                  <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center text-xs font-bold text-indigo-700">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground truncate">{course.name}</span>
                      {course.status === "completed" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{course.reason}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-sm font-bold ${selectedCareer.color}`}>{course.match}%</div>
                    <div className="text-xs text-muted-foreground">매칭</div>
                  </div>
                </div>
              );
            })}
          </div>

          <button className="mt-4 w-full py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-1.5">
            <ArrowRight className="w-4 h-4" />
            이 경로로 수강계획 생성
          </button>
        </div>
      </div>
    </div>
  );
}
