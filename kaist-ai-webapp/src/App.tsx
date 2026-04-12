import { Layout } from "./components/Layout";
import { AgentDataProvider } from "./context/AgentDataContext";
import { SyllabusProvider } from "./context/SyllabusContext";
import { UserSessionProvider } from "./context/UserSessionContext";
import { getInitialPageFromLocation } from "./lib/appRoutes";

export default function App() {
  const initialPage = getInitialPageFromLocation();

  return (
    <UserSessionProvider>
      <AgentDataProvider>
        <SyllabusProvider>
          <Layout initialPage={initialPage} />
        </SyllabusProvider>
      </AgentDataProvider>
    </UserSessionProvider>
  );
}
