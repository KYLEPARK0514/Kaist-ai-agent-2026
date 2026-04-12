import { useCallback, useEffect, useState } from "react";
import { AgentProfileBar } from "./AgentProfileBar";
import { Sidebar } from "./Sidebar";
import type { AppPageId } from "../lib/appRoutes";
import { hashForPage, pageFromHashOnly } from "../lib/appRoutes";
import { Dashboard } from "./edupath/Dashboard";
import { CoursePlanner } from "./edupath/CoursePlanner";
import { GraduationCheck } from "./edupath/GraduationCheck";
import { SyllabusAnalysis } from "./edupath/SyllabusAnalysis";
import { CareerPath } from "./edupath/CareerPath";
import { RiskAlerts } from "./edupath/RiskAlerts";
import { AdminSyllabusPage } from "./admin/AdminSyllabusPage";

interface LayoutProps {
  initialPage?: AppPageId;
}

export function Layout({ initialPage = "dashboard" }: LayoutProps) {
  const [currentPage, setCurrentPageInternal] = useState<AppPageId>(initialPage);

  const setCurrentPage = useCallback((page: AppPageId) => {
    setCurrentPageInternal(page);
    const nextHash = hashForPage(page);
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

  useEffect(() => {
    const sync = () => setCurrentPageInternal(pageFromHashOnly());
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  useEffect(() => {
    const expected = hashForPage(currentPage);
    if (window.location.hash !== expected) {
      const nextUrl = `${window.location.pathname}${window.location.search}${expected}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, [currentPage]);

  const renderContent = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "course-planner":
        return <CoursePlanner />;
      case "graduation-check":
        return <GraduationCheck />;
      case "syllabus-analysis":
        return <SyllabusAnalysis />;
      case "career-path":
        return <CareerPath />;
      case "risk-alerts":
        return <RiskAlerts />;
      case "admin-syllabus":
        return <AdminSyllabusPage />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <div className="flex-shrink-0">
        <Sidebar currentPage={currentPage} onPageChange={(id) => setCurrentPage(id as AppPageId)} />
      </div>
      <main className="flex-1 overflow-hidden flex flex-col min-h-0">
        <AgentProfileBar />
        <div className="flex-1 overflow-auto min-h-0">{renderContent()}</div>
      </main>
    </div>
  );
}
