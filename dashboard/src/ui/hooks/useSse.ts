"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Lightweight SSE hook. The browser's native EventSource doesn't propagate
 * headers, so we stick with the same origin (the dashboard's own SSE proxy).
 */
export function useSse<T>(url: string | null) {
  const [events, setEvents] = useState<T[]>([]);
  const [connected, setConnected] = useState(false);
  const seenRef = useRef(0);

  useEffect(() => {
    if (!url) return;
    const es = new EventSource(url);
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as T;
        seenRef.current += 1;
        setEvents((prev) => [...prev, parsed].slice(-500));
      } catch {
        // ignore malformed events
      }
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, [url]);

  return { events, connected, count: seenRef.current };
}
