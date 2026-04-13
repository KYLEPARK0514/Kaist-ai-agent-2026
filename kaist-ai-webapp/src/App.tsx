import { Layout } from "./components/Layout";
import { AgentDataProvider } from "./context/AgentDataContext";
import { UserSessionProvider } from "./context/UserSessionContext";
import { pageFromHashOnly } from "./lib/appRoutes";

export default function App() {
  const initialPage = pageFromHashOnly();

  return (
    <UserSessionProvider>
      <AgentDataProvider>
        <Layout initialPage={initialPage} />
      </AgentDataProvider>
    </UserSessionProvider>
  );
}
