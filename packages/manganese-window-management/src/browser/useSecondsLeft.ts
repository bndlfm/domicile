import { useEffect, useRef, useState } from "react";

import type { RunningDownload } from "./downloads";

/** When a download was first seen, and how much it had then. */
type Start = { at: number; bytes: number };

/**
 * How long each download in progress has left, by path, at the rate it has
 * come since it was first seen. Absent until it has come some way, and for a
 * download of unknown size.
 */
export const useSecondsLeft = (
  running: readonly RunningDownload[],
): ReadonlyMap<string, number> => {
  const starts = useRef(new Map<string, Start>());
  const [secondsLeft, setSecondsLeft] = useState<ReadonlyMap<string, number>>(
    new Map(),
  );

  useEffect(() => {
    const now = Date.now();
    const next = new Map<string, number>();
    const seen = new Map<string, Start>();
    for (const download of running) {
      const start = starts.current.get(download.path) ?? {
        at: now,
        bytes: download.receivedBytes,
      };
      seen.set(download.path, start);
      const seconds = (now - start.at) / 1000;
      const came = download.receivedBytes - start.bytes;
      if (download.totalBytes > 0 && seconds > 0 && came > 0) {
        next.set(
          download.path,
          (download.totalBytes - download.receivedBytes) / (came / seconds),
        );
      }
    }
    starts.current = seen;
    setSecondsLeft(next);
  }, [running]);

  return secondsLeft;
};
