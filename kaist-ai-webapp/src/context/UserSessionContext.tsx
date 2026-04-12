import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "dfmba_user_session_v1";

export interface UserSession {
  displayName: string;
  programName: string;
  cohortLabel: string;
}

interface UserSessionContextValue {
  session: UserSession | null;
  isLoggedIn: boolean;
  login: (payload: UserSession) => void;
  logout: () => void;
}

const UserSessionContext = createContext<UserSessionContextValue | null>(null);

function readStored(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserSession>;
    if (!parsed.displayName || !parsed.programName) return null;
    return {
      displayName: String(parsed.displayName),
      programName: String(parsed.programName),
      cohortLabel: String(parsed.cohortLabel || ""),
    };
  } catch {
    return null;
  }
}

export function UserSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(() =>
    typeof window !== "undefined" ? readStored() : null
  );

  const login = useCallback((payload: UserSession) => {
    const next: UserSession = {
      displayName: payload.displayName.trim(),
      programName: payload.programName.trim(),
      cohortLabel: payload.cohortLabel.trim(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      isLoggedIn: Boolean(session?.displayName && session?.programName),
      login,
      logout,
    }),
    [session, login, logout]
  );

  return <UserSessionContext.Provider value={value}>{children}</UserSessionContext.Provider>;
}

export function useUserSession() {
  const ctx = useContext(UserSessionContext);
  if (!ctx) {
    throw new Error("useUserSession must be used within UserSessionProvider");
  }
  return ctx;
}
