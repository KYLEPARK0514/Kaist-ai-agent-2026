import { useMemo, useState } from "react";
import {
  Search,
  Sparkles,
  BookOpen,
  BarChart3,
  Clock,
  Users,
  ChevronRight,
  X,
  Star,
  GitCompare,
  Brain,
  Code2,
  PenLine,
} from "lucide-react";
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from "recharts";
import { useSyllabusData, type UploadedSyllabus } from "../../context/SyllabusContext";

type Course = UploadedSyllabus;
const gradeOptions = ["", "A+", "A0", "A-", "B+", "B0", "B-", "C+", "C0", "C-", "D", "F", "P", "NP"] as const;

function DifficultyDots({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i < value ? "bg-indigo-500" : "bg-muted"}`}
        />
      ))}
    </div>
  );
}

export function SyllabusAnalysis() {
  const { syllabi, loading, error, progressByCourseId, updateCourseProgress } = useSyllabusData();
  const courses = useMemo(() => syllabi, [syllabi]);
  const usingUploadedSyllabi = syllabi.length > 0;

  const [query, setQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  const [ragQuestion, setRagQuestion] = useState("");
  const [ragScope, setRagScope] = useState<"all" | "one">("all");
  const [ragLoading, setRagLoading] = useState(false);
  const [ragAnswer, setRagAnswer] = useState<string | null>(null);
  const [ragCitations, setRagCitations] = useState<{ syllabus_id: string; chunk_index: number; text: string; score: number }[]>(
    []
  );
  const [ragError, setRagError] = useState<string | null>(null);

  const runRag = async () => {
    const q = ragQuestion.trim();
    if (!q) {
      setRagError("질문을 입력하세요.");
      return;
    }
    setRagLoading(true);
    setRagError(null);
    try {
      const body: { question: string; syllabusId?: string } = { question: q };
      if (ragScope === "one" && selectedCourse) {
        body.syllabusId = selectedCourse.id;
      }
      const res = await fetch("/api/syllabus/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        answer?: string;
        citations?: { syllabus_id: string; chunk_index: number; text: string; score: number }[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || "RAG 질의에 실패했습니다.");
      }
      setRagAnswer(json.answer || "");
      setRagCitations(Array.isArray(json.citations) ? json.citations : []);
    } catch (e) {
      setRagAnswer(null);
      setRagCitations([]);
      setRagError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setRagLoading(false);
    }
  };

  const filtered = courses.filter(
    (c) =>
      c.name.includes(query) ||
      c.code.includes(query) ||
      c.tags.some((t) => t.includes(query))
  );

  const toggleCompare = (id: string) => {
    setCompareList((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const compareData = compareList.length === 2
    ? courses.filter((c) => compareList.includes(c.id))
    : null;

  const getRadarData = (c: Course) => [
    { subject: "난이도", value: c.difficulty * 20 },
    { subject: "실습", value: c.practiceRatio },
    { subject: "팀작업", value: c.teamwork },
    { subject: "취업연계", value: c.careerLinks.length * 25 },
    { subject: "워크로드", value: c.workload * 20 },
  ];

  const progressSummary = useMemo(() => {
    const totalCourses = courses.length;
    const completedCourses = courses.filter((c) => progressByCourseId[c.id]?.completed).length;
    const totalCredits = courses.reduce((acc, c) => acc + (Number.isFinite(c.credits) ? c.credits : 0), 0);
    const completedCredits = courses.reduce(
      (acc, c) => (progressByCourseId[c.id]?.completed ? acc + (Number.isFinite(c.credits) ? c.credits : 0) : acc),
      0
    );
    const coursePct = totalCourses > 0 ? Math.round((completedCourses / totalCourses) * 100) : 0;
    const creditPct = totalCredits > 0 ? Math.round((completedCredits / totalCredits) * 100) : 0;

    return { totalCourses, completedCourses, totalCredits, completedCredits, coursePct, creditPct };
  }, [courses, progressByCourseId]);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground">실러버스 기반 과목 분석</h1>
          <p className="text-muted-foreground text-sm mt-1">
            AI가 실러버스를 분석하여 과목 특성·비교·맞춤 추천을 제공합니다
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCompareMode(!compareMode);
            setCompareList([]);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors border ${
            compareMode
              ? "bg-indigo-600 text-white border-indigo-600"
              : "bg-card text-foreground border-border hover:bg-muted/50"
          }`}
        >
          <GitCompare className="w-4 h-4" />
          과목 비교 {compareMode ? "취소" : ""}
        </button>
      </div>

      <div className="relative rounded-2xl border border-indigo-200/80 min-h-[320px] p-4 space-y-5">
      {loading && <p className="text-xs text-muted-foreground">실러버스 데이터 로딩 중...</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <div className="flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700">
          {usingUploadedSyllabi ? "서버 실러버스 연동" : "데이터 없음"}
        </span>
        {!usingUploadedSyllabi && (
          <span className="text-muted-foreground">
            관리자 메뉴에서 PDF/JSON 실러버스를 업로드하면 목록·RAG·수강풀이 연동이 활성화됩니다.
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-medium text-foreground">내 수강 진행률</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              과목별 수강 여부/성적을 체크하면 이수율이 자동 계산됩니다.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            과목 {progressSummary.completedCourses}/{progressSummary.totalCourses} · 학점 {progressSummary.completedCredits}/
            {progressSummary.totalCredits}
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">과목 기준</span>
              <span className="font-medium text-indigo-700">{progressSummary.coursePct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${progressSummary.coursePct}%` }} />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">학점 기준</span>
              <span className="font-medium text-violet-700">{progressSummary.creditPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-violet-500" style={{ width: `${progressSummary.creditPct}%` }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium text-foreground">문서 기반 질의 (BM25 RAG)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          업로드된 PDF/텍스트에서 추출·청킹된 근거를 검색합니다. 특정 과목만 보고 싶으면 과목을 연 뒤 &quot;선택 과목만&quot;을 고르세요.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name="rag-scope" checked={ragScope === "all"} onChange={() => setRagScope("all")} />
            전체 실러버스
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input
              type="radio"
              name="rag-scope"
              checked={ragScope === "one"}
              onChange={() => setRagScope("one")}
              disabled={!selectedCourse}
            />
            선택 과목만 {selectedCourse ? `(${selectedCourse.code})` : ""}
          </label>
        </div>
        <textarea
          value={ragQuestion}
          onChange={(e) => setRagQuestion(e.target.value)}
          placeholder="예: 중간고사 비중은 어떻게 되나요? / 팀 프로젝트가 있나요? / 결석 시 출석 점수는?"
          className="w-full min-h-[88px] rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void runRag()}
            disabled={ragLoading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {ragLoading ? "검색 중..." : "근거 찾기"}
          </button>
          {ragError && <span className="text-xs text-rose-600">{ragError}</span>}
        </div>
        {ragAnswer && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-indigo-950 whitespace-pre-wrap">
            {ragAnswer}
          </div>
        )}
        {ragCitations.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">상위 근거 청크</div>
            <div className="space-y-2 max-h-56 overflow-auto pr-1">
              {ragCitations.map((c, idx) => (
                <div key={`${c.syllabus_id}-${c.chunk_index}-${idx}`} className="text-xs rounded-lg border border-border bg-muted/20 p-2">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    syllabus {c.syllabus_id.slice(0, 8)}… · chunk {c.chunk_index} · score {c.score.toFixed(3)}
                  </div>
                  <div className="text-muted-foreground leading-relaxed">{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="과목명, 코드, 태그로 검색... (예: DFM503, Finance, DFMBA)"
          className="w-full pl-10 pr-4 py-3 bg-card border border-border rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
        />
      </div>

      {/* Compare mode banner */}
      {compareMode && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-indigo-700">
            <GitCompare className="w-4 h-4" />
            <span>비교할 과목 2개를 선택하세요 ({compareList.length}/2)</span>
          </div>
          {compareList.length === 2 && (
            <button
              onClick={() => setCompareMode(false)}
              className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg hover:bg-indigo-700"
            >
              비교 보기
            </button>
          )}
        </div>
      )}

      {/* Course grid */}
      {!selectedCourse && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          표시할 실러버스가 없습니다. 관리자 페이지에서 PDF 또는 JSON을 업로드해 주세요.
        </div>
      )}

      {!selectedCourse && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((course) => {
            const isComparing = compareList.includes(course.id);
            const progress = progressByCourseId[course.id] || { completed: false, grade: "" };
            return (
              <div
                key={course.id}
                className={`bg-card rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer ${
                  isComparing ? "border-indigo-400 ring-2 ring-indigo-100" : "border-border hover:border-indigo-200"
                }`}
                onClick={() => !compareMode && setSelectedCourse(course)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-indigo-600 font-medium">{course.code}</span>
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">{course.type}</span>
                      </div>
                      <h4 className="text-foreground">{course.name}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">{course.professor} · {course.credits}학점</p>
                    </div>
                    <div className="flex items-center gap-1 text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-500" />
                      <span className="text-xs font-medium">{course.rating}</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">{course.summary}</p>

                  <div className="flex flex-wrap gap-1 mb-3">
                    {course.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">난이도</span>
                      <DifficultyDots value={course.difficulty} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">워크로드</span>
                      <DifficultyDots value={course.workload} />
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <label
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={progress.completed}
                        onChange={(e) => updateCourseProgress(course.id, { completed: e.target.checked })}
                      />
                      수강 완료
                    </label>
                    <select
                      value={progress.grade}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => updateCourseProgress(course.id, { grade: e.target.value as typeof progress.grade })}
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {gradeOptions.map((grade) => (
                        <option key={grade || "none"} value={grade}>
                          {grade || "성적 미입력"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                    {compareMode ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCompare(course.id); }}
                        className={`w-full py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isComparing
                            ? "bg-indigo-600 text-white"
                            : "bg-muted hover:bg-indigo-50 text-muted-foreground hover:text-indigo-600"
                        }`}
                      >
                        {isComparing ? "✓ 선택됨" : "비교 선택"}
                      </button>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Code2 className="w-3 h-3" />
                          실습 {course.practiceRatio}%
                        </div>
                        <button className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                          상세 보기 <ChevronRight className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compare view */}
      {compareMode && !compareMode && compareData && (
        <div className="bg-card rounded-2xl border border-indigo-200 p-5">
          {/* comparison UI */}
        </div>
      )}

      {/* Compare panel when 2 selected */}
      {compareMode && compareList.length === 2 && compareData && (
        <div className="bg-card rounded-2xl border border-indigo-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <GitCompare className="w-4 h-4 text-indigo-500" />
            <h3 className="text-foreground">과목 비교 분석</h3>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {compareData.map((c) => (
              <div key={c.id} className="space-y-3">
                <div className="bg-indigo-50 rounded-xl p-3">
                  <div className="text-sm font-medium text-indigo-700">{c.name}</div>
                  <div className="text-xs text-indigo-500">{c.professor} · {c.credits}학점</div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={getRadarData(c)}>
                    <PolarGrid stroke="#e0deff" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#6b7280" }} />
                    <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="bg-violet-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-xs font-medium text-violet-700">AI 분석</span>
                  </div>
                  <p className="text-xs text-violet-700 leading-relaxed">{c.aiSummary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Course detail */}
      {selectedCourse && (
        <div className="bg-card rounded-2xl border border-border shadow-sm relative z-0">
          {/* Detail header */}
          <div className="p-5 border-b border-border">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm text-indigo-600 font-medium">{selectedCourse.code}</span>
                  <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{selectedCourse.type}</span>
                </div>
                <h2 className="text-foreground">{selectedCourse.name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">{selectedCourse.professor} · {selectedCourse.credits}학점</p>
              </div>
              <button
                onClick={() => setSelectedCourse(null)}
                className="p-2 hover:bg-muted rounded-xl transition-colors text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left: overview */}
            <div className="lg:col-span-2 space-y-4">
              {/* AI Summary */}
              <div className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-700">AI 과목 분석</span>
                </div>
                <p className="text-sm text-indigo-800 leading-relaxed">{selectedCourse.aiSummary}</p>
              </div>

              {/* Weekly syllabus */}
              <div>
                <h4 className="text-foreground mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  주차별 강의 내용
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedCourse.weeks.map((w, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 text-xs">
                      <span className="text-indigo-500 font-medium flex-shrink-0">{i + 1}주</span>
                      <span className="text-muted-foreground">{w}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assessments */}
              <div>
                <h4 className="text-foreground mb-2 flex items-center gap-2">
                  <PenLine className="w-4 h-4 text-indigo-500" />
                  평가 구성
                </h4>
                <div className="space-y-2">
                  {selectedCourse.assessments.map((a, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0">{a.name}</span>
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{ width: `${a.pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-indigo-600 w-8 text-right">{a.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: meta info */}
            <div className="space-y-4">
              {/* Stats */}
              <div className="space-y-3">
                <div className="p-2 rounded-lg bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-2">내 수강 상태</div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={Boolean(progressByCourseId[selectedCourse.id]?.completed)}
                        onChange={(e) => updateCourseProgress(selectedCourse.id, { completed: e.target.checked })}
                      />
                      수강 완료
                    </label>
                    <select
                      value={progressByCourseId[selectedCourse.id]?.grade || ""}
                      onChange={(e) =>
                        updateCourseProgress(selectedCourse.id, { grade: e.target.value as (typeof gradeOptions)[number] })
                      }
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                    >
                      {gradeOptions.map((grade) => (
                        <option key={grade || "none"} value={grade}>
                          {grade || "성적 미입력"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {[
                  { icon: BarChart3, label: "난이도", value: <DifficultyDots value={selectedCourse.difficulty} /> },
                  { icon: Clock, label: "워크로드", value: <DifficultyDots value={selectedCourse.workload} /> },
                  { icon: Code2, label: "실습 비중", value: `${selectedCourse.practiceRatio}%` },
                  { icon: Users, label: "팀 작업", value: `${selectedCourse.teamwork}%` },
                  { icon: Star, label: "수강생 평점", value: `${selectedCourse.rating}/5.0 ⭐` },
                ].map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-xs text-muted-foreground">{stat.label}</span>
                      </div>
                      <div className="text-xs font-medium">{stat.value}</div>
                    </div>
                  );
                })}
              </div>

              {/* Prerequisites */}
              <div>
                <h4 className="text-sm text-foreground mb-2">선수과목</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourse.prerequisites.map((p) => (
                    <span key={p} className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">{p}</span>
                  ))}
                </div>
              </div>

              {/* Career links */}
              <div>
                <h4 className="text-sm text-foreground mb-2">연계 직무</h4>
                <div className="flex flex-wrap gap-1.5">
                  {selectedCourse.careerLinks.map((c) => (
                    <span key={c} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">{c}</span>
                  ))}
                </div>
              </div>

              <button className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl text-sm hover:opacity-90 transition-opacity shadow-md">
                수강 계획에 추가
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
}
