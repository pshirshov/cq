/**
 * SessionContext.tsx — session state lifted above the tab switcher (E2E-D04).
 *
 * Mounting SessionProvider above ChatTab in App.tsx ensures that
 * activeSessionId and inProgress survive Chat ↔ History tab switches,
 * which would otherwise unmount ChatTab and lose local component state.
 *
 * D47: activeSessionId is also persisted to localStorage["cq.activeSessionId"]
 * so that a page refresh can attempt to rejoin the previous session.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const LS_KEY = "cq.activeSessionId";

function readStoredSessionId(): string | null {
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

function writeStoredSessionId(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(LS_KEY);
    } else {
      localStorage.setItem(LS_KEY, id);
    }
  } catch {
    // localStorage may be unavailable (e.g. in tests or private browsing).
  }
}

interface SessionState {
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  inProgress: boolean;
  setInProgress: (v: boolean) => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }): React.ReactElement {
  // Hydrate from localStorage on initial render (D47).
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(readStoredSessionId);
  const [inProgress, setInProgress] = useState(false);

  const setActiveSessionId = useCallback((id: string | null) => {
    writeStoredSessionId(id);
    setActiveSessionIdState(id);
  }, []);

  return (
    <SessionContext.Provider value={{ activeSessionId, setActiveSessionId, inProgress, setInProgress }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const v = useContext(SessionContext);
  if (v === null) throw new Error("useSession: no <SessionProvider> in tree");
  return v;
}
