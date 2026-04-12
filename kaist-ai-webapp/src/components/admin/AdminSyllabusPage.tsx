import { useEffect, useState, type ChangeEvent } from "react";
import { Upload, Trash2, FileText, Database, KeyRound } from "lucide-react";
import { useAgentData } from "../../context/AgentDataContext";
import { useSyllabusData } from "../../context/SyllabusContext";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AdminSyllabusPage() {
  const {
    syllabi,
    loading,
    error,
    adminToken,
    setAdminToken,
    addFiles,
    ingestPdfBase64,
    removeSyllabus,
    clearAll,
  } = useSyllabusData();
  const { programSettings, reloadProgramSettings } = useAgentData();

  const [resultMessage, setResultMessage] = useState<string>("");
  const [tokenInput, setTokenInput] = useState(adminToken);

  const [programName, setProgramName] = useState("");
  const [totalCredits, setTotalCredits] = useState("36");
  const [coreMinCredits, setCoreMinCredits] = useState("18");
  const [requiredCodes, setRequiredCodes] = useState("DFM501, DFM502");
  const [careerOptionsJson, setCareerOptionsJson] = useState(
    '["FinTech/AI Product","Corporate Finance & Strategy","Asset Management & Quant"]'
  );

  useEffect(() => {
    setProgramName(programSettings.program_name || "");
    setTotalCredits(programSettings.total_credits || "36");
    setCoreMinCredits(programSettings.core_min_credits || "18");
    setRequiredCodes(programSettings.required_course_codes || "DFM501, DFM502");
    setCareerOptionsJson(
      programSettings.career_options ||
        '["FinTech/AI Product","Corporate Finance & Strategy","Asset Management & Quant"]'
    );
  }, [programSettings]);

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    try {
      const files = event.target.files;
      const result = await addFiles(files);
      if (result.failed.length > 0) {
        setResultMessage(
          `${result.added}개 추가됨 / 실패: ${result.failed.join(", ")} (JSON·TXT·MD·CSV 또는 PDF)`
        );
      } else {
        setResultMessage(`${result.added}개 실러버스를 추가했습니다.`);
      }
    } catch (e) {
      setResultMessage(e instanceof Error ? e.message : "업로드 중 오류가 발생했습니다.");
    }
    event.target.value = "";
  };

  const handlePdfUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const b64 = dataUrl.split(",")[1] || "";
      if (!b64) {
        setResultMessage("PDF Base64 변환에 실패했습니다.");
        return;
      }
      const { chunks } = await ingestPdfBase64(file.name, b64);
      setResultMessage(`PDF 업로드 완료: ${file.name} (청크 ${chunks}개 색인)`);
    } catch (e) {
      setResultMessage(e instanceof Error ? e.message : "PDF 업로드 중 오류가 발생했습니다.");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await removeSyllabus(id);
    setResultMessage(ok ? "실러버스를 삭제했습니다." : "삭제 권한이 없거나 실패했습니다.");
  };

  const handleClear = async () => {
    const ok = await clearAll();
    setResultMessage(ok ? "전체 삭제가 완료되었습니다." : "전체 삭제 권한이 없거나 실패했습니다.");
  };

  const handleTokenSave = () => {
    setAdminToken(tokenInput.trim());
    setResultMessage("관리자 토큰을 저장했습니다.");
  };

  const handleSaveProgram = async () => {
    try {
      JSON.parse(careerOptionsJson);
    } catch {
      setResultMessage("커리어 옵션은 JSON 배열 형식이어야 합니다.");
      return;
    }
    try {
      const res = await fetch("/api/admin/program/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Token": adminToken,
        },
        body: JSON.stringify({
          settings: {
            program_name: programName.trim(),
            total_credits: totalCredits.trim(),
            core_min_credits: coreMinCredits.trim(),
            required_course_codes: requiredCodes.trim(),
            career_options: careerOptionsJson.trim(),
          },
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "프로그램 설정 저장에 실패했습니다.");
      }
      await reloadProgramSettings();
      setResultMessage("프로그램 설정을 저장했습니다. 에이전트 졸업요건에 반영됩니다.");
    } catch (e) {
      setResultMessage(e instanceof Error ? e.message : "프로그램 설정 저장 중 오류");
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground">관리자 · DFMBA 실러버스 / 프로그램</h1>
          <p className="text-sm text-muted-foreground mt-1">
            PDF는 서버에서 텍스트 추출·구조화·청킹 후 BM25 RAG 색인에 사용됩니다. 프로그램 설정은 에이전트 졸업요건 계산에 직접 반영됩니다.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm cursor-pointer hover:bg-indigo-700">
            <Upload className="w-4 h-4" />
            PDF 업로드
            <input type="file" accept="application/pdf" onChange={(e) => void handlePdfUpload(e)} className="hidden" />
          </label>
          <label className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-sm cursor-pointer hover:bg-muted/50">
            <Upload className="w-4 h-4" />
            JSON/TXT 업로드
            <input
              type="file"
              multiple
              accept=".json,.txt,.md,.csv"
              onChange={handleUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <KeyRound className="w-3.5 h-3.5" />
            관리자 토큰
          </div>
          <Input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="서버 ADMIN_TOKEN 입력"
            className="md:flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleTokenSave}>
            토큰 저장
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="program-name">프로그램 표시명</Label>
            <Input
              id="program-name"
              value={programName}
              onChange={(e) => setProgramName(e.target.value)}
              placeholder="KAIST DFMBA (Digital Finance MBA)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="total-credits">졸업 총 학점</Label>
            <Input
              id="total-credits"
              value={totalCredits}
              onChange={(e) => setTotalCredits(e.target.value)}
              placeholder="36"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="core-min">필수(코어) 최소 학점</Label>
            <Input
              id="core-min"
              value={coreMinCredits}
              onChange={(e) => setCoreMinCredits(e.target.value)}
              placeholder="18"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="required-codes">지정 필수 과목 코드 (쉼표)</Label>
            <Input
              id="required-codes"
              value={requiredCodes}
              onChange={(e) => setRequiredCodes(e.target.value)}
              placeholder="DFM501, DFM502"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="career-json">커리어 옵션 (JSON 배열)</Label>
            <textarea
              id="career-json"
              value={careerOptionsJson}
              onChange={(e) => setCareerOptionsJson(e.target.value)}
              className="w-full min-h-[90px] rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
            />
          </div>
        </div>
        <Button type="button" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => void handleSaveProgram()}>
          프로그램 설정 저장
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="w-4 h-4" />
            현재 저장된 실러버스: <span className="text-foreground font-medium">{syllabi.length}개</span>
          </div>
          <button
            type="button"
            onClick={() => void handleClear()}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted"
          >
            <Trash2 className="w-3.5 h-3.5" />
            전체 삭제
          </button>
        </div>
        {loading && <p className="mt-3 text-xs text-muted-foreground">서버 데이터 로딩 중...</p>}
        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
        {resultMessage && <p className="mt-3 text-xs text-indigo-600">{resultMessage}</p>}
      </div>

      <div className="space-y-3">
        {syllabi.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">아직 업로드된 실러버스가 없습니다.</p>
          </div>
        )}

        {syllabi.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <p className="text-sm text-foreground font-medium truncate">
                {item.code} · {item.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                출처 파일: {item.sourceFileName} / 교수: {item.professor}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete(item.id)}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border hover:bg-muted"
            >
              <Trash2 className="w-3.5 h-3.5" />
              삭제
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
