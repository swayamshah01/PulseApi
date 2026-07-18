import { useEffect, useRef } from "react";

export const LIVE_REFRESH_INTERVAL_MS = 10_000;

export function useAutoRefresh(refresh, intervalMs = LIVE_REFRESH_INTERVAL_MS) {
  const refreshRef = useRef(refresh);
  const inFlightRef = useRef(false);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let active = true;

    async function runRefresh() {
      if (!active || inFlightRef.current || document.visibilityState === "hidden") {
        return;
      }

      inFlightRef.current = true;
      try {
        await refreshRef.current();
      } catch {
        // Each page owns how refresh errors are displayed.
      } finally {
        inFlightRef.current = false;
      }
    }

    const intervalId = window.setInterval(runRefresh, intervalMs);
    const handleFocus = () => runRefresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") runRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);
}
