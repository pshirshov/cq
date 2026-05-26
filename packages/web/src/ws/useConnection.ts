/**
 * useConnection.ts — React hook adapter for the WebSocket Manager (PR-17).
 *
 * useConnection() — returns the Manager from context. Throws if no
 * <ConnectionProvider> is present (fail-fast per project policy).
 *
 * useConnectionStats() — subscribes to live ManagerStats updates via
 * useSyncExternalStore. Re-renders the component whenever the Manager
 * fires onUpdate. Uses getSnapshot = () => manager.stats; no SSR.
 */

import { useContext } from "react";
import { useSyncExternalStore } from "react";
import { ConnectionContext } from "./ConnectionProvider";
import type { Manager, ManagerStats } from "./Manager";

/**
 * Returns the Manager instance from the nearest <ConnectionProvider>.
 * Throws if called outside a provider tree.
 */
export function useConnection(): Manager {
  const manager = useContext(ConnectionContext);
  if (manager === null) {
    throw new Error("useConnection: no <ConnectionProvider> in tree");
  }
  return manager;
}

/**
 * Subscribes to live ManagerStats updates for the Manager in context.
 * Re-renders on every Manager.onUpdate() notification.
 *
 * Uses useSyncExternalStore:
 *   subscribe  = manager.onUpdate (returns unsubscribe fn)
 *   getSnapshot = () => manager.stats
 *   getServerSnapshot = same (no SSR environment)
 */
export function useConnectionStats(): ManagerStats {
  const manager = useConnection();
  return useSyncExternalStore(
    (onStoreChange) => manager.onUpdate(onStoreChange),
    () => manager.stats,
    () => manager.stats,
  );
}
