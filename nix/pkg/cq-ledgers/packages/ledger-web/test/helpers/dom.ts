/**
 * happy-dom registration helper with cross-file cleanup (mirrors the pattern
 * used by @cq/web). GlobalRegistrator.register() patches process-global
 * symbols; without a matching unregister() those leak into later test files.
 * Each happy-dom-using file calls registerDom() at module top, which registers
 * once and installs an afterAll to unregister at the file's end.
 */

import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { afterAll } from "bun:test";

export function registerDom(): void {
  if (typeof globalThis.document === "undefined") {
    GlobalRegistrator.register();
  }
  // @ts-expect-error — React internal global, not typed in bun-types
  if (!globalThis.IS_REACT_ACT_ENVIRONMENT) {
    // @ts-expect-error — React internal global, not typed in bun-types
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  }
  afterAll(async () => {
    if (typeof globalThis.document !== "undefined") {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await GlobalRegistrator.unregister();
    }
  });
}
