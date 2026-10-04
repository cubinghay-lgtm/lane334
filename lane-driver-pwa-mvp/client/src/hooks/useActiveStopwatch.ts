import { useCallback, useEffect, useRef } from "react";

/**
 * Counts seconds only while `running` and the page is visible, so background
 * time never inflates the time-quality score.
 */
export function useActiveStopwatch(running: boolean) {
  const totalMs = useRef(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const sync = () => {
      const shouldRun = running && document.visibilityState === "visible";
      if (shouldRun && startedAt.current === null) startedAt.current = performance.now();
      if (!shouldRun && startedAt.current !== null) {
        totalMs.current += performance.now() - startedAt.current;
        startedAt.current = null;
      }
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      if (startedAt.current !== null) {
        totalMs.current += performance.now() - startedAt.current;
        startedAt.current = null;
      }
    };
  }, [running]);

  return useCallback(() => {
    const live = startedAt.current !== null ? performance.now() - startedAt.current : 0;
    return (totalMs.current + live) / 1000;
  }, []);
}
