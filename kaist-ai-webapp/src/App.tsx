import { Component, type ReactNode } from "react";
import { Layout } from "./components/Layout";
import { AgentDataProvider } from "./context/AgentDataContext";
import { SyllabusProvider } from "./context/SyllabusContext";
import { UserSessionProvider } from "./context/UserSessionContext";
import { pageFromHashOnly } from "./lib/appRoutes";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Unknown runtime error",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground p-6">
          <h1 className="text-lg font-semibold">UI runtime error</h1>
          <p className="mt-2 text-sm text-red-600 break-all">{this.state.message}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Please refresh once. If this persists, share this message.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const initialPage = pageFromHashOnly();

  return (
    <AppErrorBoundary>
      <UserSessionProvider>
        <AgentDataProvider>
          <SyllabusProvider>
            <Layout initialPage={initialPage} />
          </SyllabusProvider>
        </AgentDataProvider>
      </UserSessionProvider>
    </AppErrorBoundary>
  );
}
