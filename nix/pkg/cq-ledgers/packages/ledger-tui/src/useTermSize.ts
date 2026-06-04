/**
 * Track the terminal dimensions (columns × rows), updating on resize. Falls
 * back to 80×24 when stdout reports no size (e.g. the test harness).
 */

import { useEffect, useState } from "react";
import { useStdout } from "ink";

export interface TermSize {
  cols: number;
  rows: number;
}

export function useTermSize(): TermSize {
  const { stdout } = useStdout();
  const read = (): TermSize => ({
    cols: stdout?.columns && stdout.columns > 0 ? stdout.columns : 80,
    rows: stdout?.rows && stdout.rows > 0 ? stdout.rows : 24,
  });
  const [size, setSize] = useState<TermSize>(read);
  useEffect(() => {
    if (stdout === undefined) return;
    const onResize = (): void => setSize(read);
    stdout.on("resize", onResize);
    onResize();
    return () => {
      stdout.off("resize", onResize);
    };
  }, [stdout]);
  return size;
}
