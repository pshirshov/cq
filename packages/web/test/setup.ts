/**
 * Happy-DOM global registrator — must run before any test that needs DOM APIs.
 * Referenced via bunfig.toml [test] preload.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();

// Tell React that this environment supports act() — suppresses the
// "not configured to support act(...)" warning in React 18+/19.
// @ts-expect-error — IS_REACT_ACT_ENVIRONMENT is a React internal global not typed in bun-types
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
