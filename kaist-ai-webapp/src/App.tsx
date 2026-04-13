import { Layout } from "./components/Layout";
import { AgentDataProvider } from "./context/AgentDataContext";
import { pageFromHashOnly } from "./lib/appRoutes";

export default function App() {
  const initialPage = pageFromHashOnly();

  return (
    <AgentDataProvider>
      <Layout initialPage={initialPage} />
    </AgentDataProvider>
  );
}
