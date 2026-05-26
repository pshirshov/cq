/**
 * ConnectionProvider.tsx — React context provider for the WebSocket Manager (PR-17).
 *
 * Exposes a single Manager instance to the whole component tree without prop-drilling.
 * Descendants read the manager via useConnection() from useConnection.ts.
 */

import { createContext } from "react";
import type { Manager } from "./Manager";

/** Holds the single Manager instance for the application tree. null = no provider. */
export const ConnectionContext = createContext<Manager | null>(null);

export interface ConnectionProviderProps {
  value: Manager;
  children?: React.ReactNode;
}

/**
 * <ConnectionProvider> — wraps the application root and provides the Manager
 * instance to all descendants via ConnectionContext.
 *
 * Construct the Manager in main.tsx (or a test harness) and pass it here;
 * do not construct Managers inside components (G2c: F-18 — no module-global).
 */
export function ConnectionProvider({ value, children }: ConnectionProviderProps): React.ReactElement {
  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}
