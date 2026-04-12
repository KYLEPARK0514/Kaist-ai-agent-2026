import { useMemo, useState } from "react";
import { cn } from "./ui/utils";
import {
  LayoutDashboard,
  CalendarDays,
  GraduationCap,
  BookOpen,
  Briefcase,
  AlertTriangle,
  X,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useUserSession } from "../context/UserSessionContext";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

function initialsFromName(name: string) {
  const t = name.trim();
  if (!t) return "DF";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase() || "DF";
  }
  return t.slice(0, 2).toUpperCase();
}

export function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { session, isLoggedIn, login, logout } = useUserSession();
  const [profileOpen, setProfileOpen] = useState(false);
  const [nameInput, setNameInput] = useState(session?.displayName || "");
  const [programInput, setProgramInput] = useState(session?.programName || "KAIST DFMBA (Digital Finance MBA)");
  const [cohortInput, setCohortInput] = useState(session?.cohortLabel || "");

  const avatarLabel = useMemo(
    () => initialsFromName(session?.displayName || "DFMBA"),
    [session?.displayName]
  );

  const openProfileDialog = () => {
    setNameInput(session?.displayName || "");
    setProgramInput(session?.programName || "KAIST DFMBA (Digital Finance MBA)");
    setCohortInput(session?.cohortLabel || "");
    setProfileOpen(true);
  };

  const handleNavigationClick = (pageId: string) => {
    if (!isExpanded) {
      setIsExpanded(true);
      setTimeout(() => onPageChange(pageId), 150);
    } else {
      onPageChange(pageId);
    }
  };

  const navigationItems = [
    {
      id: "dashboard",
      name: "대시보드",
      icon: LayoutDashboard,
      description: "학업 현황 개요",
    },
    {
      id: "course-planner",
      name: "수강 설계",
      icon: CalendarDays,
      description: "학기별 수강 계획 자동 생성",
    },
    {
      id: "graduation-check",
      name: "졸업요건 검증",
      icon: GraduationCap,
      description: "졸업 가능 여부 자동 확인",
    },
    {
      id: "syllabus-analysis",
      name: "실러버스 분석",
      icon: BookOpen,
      description: "과목 이해 및 AI 비교",
    },
    {
      id: "career-path",
      name: "커리어 연계",
      icon: Briefcase,
      description: "진로 기반 과목 추천",
    },
    {
      id: "risk-alerts",
      name: "리스크 경고",
      icon: AlertTriangle,
      description: "학습 위험 사전 감지",
    },
    {
      id: "admin-syllabus",
      name: "관리자 업로드",
      icon: ShieldCheck,
      description: "실러버스 데이터 관리",
    },
  ];

  return (
    <div className="ml-4 my-4">
      <div
        className={cn(
          "flex flex-col h-[calc(100vh-2rem)] transition-all duration-300 ease-in-out rounded-2xl",
          "bg-gradient-to-b from-sidebar via-sidebar to-sidebar-accent shadow-2xl border border-sidebar-border/20 overflow-hidden",
          isExpanded ? "w-60" : "w-16"
        )}
      >
        {/* Header / Logo */}
        <div className="p-4 flex flex-col items-center relative">
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-3 right-3 w-7 h-7 bg-sidebar-accent/50 hover:bg-sidebar-accent rounded-full flex items-center justify-center transition-all duration-200"
            >
              <X className="w-3.5 h-3.5 text-sidebar-foreground" />
            </button>
          )}

          <div className="w-10 h-10 bg-gradient-to-br from-sidebar-primary to-indigo-400 rounded-xl flex items-center justify-center shadow-lg ai-pulse">
            <Sparkles className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>

          {isExpanded && (
            <div className="mt-3 text-center">
              <h2 className="text-sidebar-foreground font-semibold text-base whitespace-nowrap">
                DFMBA EduPath AI
              </h2>
              <p className="text-sidebar-accent-foreground text-xs whitespace-nowrap mt-0.5">
                KAIST 디지털금융 MBA
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4">
          <div className="space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;

              return (
                <div key={item.id} className="relative group">
                  <button
                    onClick={() => handleNavigationClick(item.id)}
                    className={cn(
                      "transition-all duration-300 flex items-center relative overflow-hidden",
                      "hover:scale-[1.03]",
                      isExpanded
                        ? "w-full px-3 py-2.5 justify-start rounded-xl"
                        : "w-10 h-10 justify-center mx-auto rounded-xl",
                      isActive
                        ? "bg-gradient-to-br from-sidebar-primary to-indigo-400 shadow-lg shadow-sidebar-primary/30"
                        : "bg-sidebar-accent/40 hover:bg-sidebar-primary/20"
                    )}
                  >
                    <Icon
                      className={cn(
                        "transition-colors duration-300 flex-shrink-0 w-4.5 h-4.5",
                        isActive
                          ? "text-sidebar-primary-foreground"
                          : "text-sidebar-accent-foreground group-hover:text-sidebar-primary"
                      )}
                    />

                    {isExpanded && (
                      <div className="ml-3 overflow-hidden text-left">
                        <div
                          className={cn(
                            "text-sm whitespace-nowrap transition-colors duration-300",
                            isActive
                              ? "text-sidebar-primary-foreground font-semibold"
                              : "text-sidebar-foreground/90 group-hover:text-sidebar-primary"
                          )}
                        >
                          {item.name}
                        </div>
                        {isActive && (
                          <div className="text-xs text-sidebar-primary-foreground/70 mt-0.5 whitespace-nowrap">
                            {item.description}
                          </div>
                        )}
                      </div>
                    )}

                    {isActive && !isExpanded && (
                      <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-5 bg-sidebar-primary rounded-l-full" />
                    )}
                  </button>

                  {/* Tooltip */}
                  {!isExpanded && (
                    <div className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-sidebar-border/30 transform translate-x-2 group-hover:translate-x-0">
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-sidebar-accent-foreground mt-0.5">{item.description}</div>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-sidebar rotate-45" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-sidebar-border/30">
          <div className="relative group">
            <button
              type="button"
              onClick={() => {
                if (!isExpanded) {
                  setIsExpanded(true);
                }
                openProfileDialog();
              }}
              className={cn(
                "flex items-center transition-all duration-200 hover:bg-sidebar-accent/50 rounded-xl",
                isExpanded ? "w-full px-3 py-2 gap-3" : "w-10 h-10 justify-center mx-auto"
              )}
            >
              <div className="w-8 h-8 bg-gradient-to-br from-violet-400 to-indigo-500 rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                <span className="text-white text-xs font-semibold">{avatarLabel}</span>
              </div>
              {isExpanded && (
                <div className="text-left overflow-hidden">
                  <div className="text-sidebar-foreground text-sm font-medium whitespace-nowrap">
                    {isLoggedIn ? session?.displayName : "로그인"}
                  </div>
                  <div className="text-sidebar-accent-foreground text-xs whitespace-nowrap">
                    {isLoggedIn ? session?.programName : "이름·과정명 입력"}
                  </div>
                </div>
              )}
            </button>

            {!isExpanded && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-gradient-to-br from-sidebar to-sidebar-accent text-sidebar-foreground rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-sidebar-border/30 transform translate-x-2 group-hover:translate-x-0">
                <div className="text-sm font-medium">{isLoggedIn ? session?.displayName : "DFMBA 로그인"}</div>
                <div className="text-xs text-sidebar-accent-foreground mt-0.5">
                  {isLoggedIn ? session?.programName : "클릭하여 프로필 설정"}
                </div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-sidebar rotate-45" />
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>DFMBA 학습자 프로필</DialogTitle>
            <DialogDescription>
              대시보드 인사말과 사이드바에 표시됩니다. 별도 외부 인증 없이 이 브라우저에만 저장됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dfmba-name">이름</Label>
              <Input
                id="dfmba-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dfmba-program">과정명</Label>
              <Input
                id="dfmba-program"
                value={programInput}
                onChange={(e) => setProgramInput(e.target.value)}
                placeholder="KAIST DFMBA · 2026 입학"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dfmba-cohort">기수/학기 (선택)</Label>
              <Input
                id="dfmba-cohort"
                value={cohortInput}
                onChange={(e) => setCohortInput(e.target.value)}
                placeholder="예: 3학기 · 2026 봄"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {isLoggedIn && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  logout();
                  setProfileOpen(false);
                }}
              >
                로그아웃
              </Button>
            )}
            <Button
              type="button"
              onClick={() => {
                login({
                  displayName: nameInput.trim() || "DFMBA 학습자",
                  programName: programInput.trim() || "KAIST DFMBA",
                  cohortLabel: cohortInput.trim(),
                });
                setProfileOpen(false);
              }}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
