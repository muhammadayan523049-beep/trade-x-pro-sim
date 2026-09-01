import { useEffect, useState } from "react";

/**
 * Returns a timestamp that advances on an interval, starting at 0 until the
 * component has mounted so server and client render identical markup.
 */
export function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
