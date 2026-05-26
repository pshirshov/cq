import { useMemo, useEffect } from "react";
import { Manager } from "./ws/Manager";
import { Indicator } from "./ws/Indicator";
import { attachTitleMirror } from "./ws/titleMirror";

/**
 * App — root composite component.
 *
 * Constructs a Manager pointing at the local WebSocket endpoint.
 * PR-17 will refactor this to a ConnectionProvider context so the manager
 * is accessible to deeply nested components without prop-drilling.
 *
 * useMemo with [] ensures the Manager is constructed exactly once per
 * App mount (React Strict Mode double-invokes effects but not useMemo with
 * an empty dep array). The Manager is not destroyed on unmount in this PR;
 * PR-17 will add a cleanup via useEffect.
 */
export default function App(): React.ReactElement {
  const manager = useMemo(
    () =>
      new Manager({
        url: `ws://${location.host}/ws`,
        enableTimeJumpDetector: true,
      }),
    [],
  );

  useEffect(() => {
    const mirror = attachTitleMirror(manager);
    return () => mirror.detach();
  }, [manager]);

  return (
    <>
      <Indicator manager={manager} />
      <div>cq is up</div>
    </>
  );
}
