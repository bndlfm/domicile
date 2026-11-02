import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { renderHook } from "@testing-library/react";

import type { RunningDownload } from "./downloads";
import { useSecondsLeft } from "./useSecondsLeft";

const PATH = "/home/me/Downloads/dataset.zip";

const at = (receivedBytes: number, totalBytes = 10_000_000) => [
  { path: PATH, receivedBytes, totalBytes },
];

const watch = () =>
  renderHook((running: readonly RunningDownload[]) => useSecondsLeft(running), {
    initialProps: at(2_000_000),
  });

afterEach(() => {
  setSystemTime();
});

describe(useSecondsLeft, () => {
  it("knows nothing until a download has come some way", () => {
    setSystemTime(new Date(0));
    const { result } = watch();
    expect(result.current.get(PATH)).toBeUndefined();
  });

  it("says how long is left at the rate it has come so far", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(4_000_000));
    // 1 MB a second, 6 MB to go.
    expect(result.current.get(PATH)).toBe(6);
  });

  it("claims nothing for a download of unknown size", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(4_000_000, 0));
    expect(result.current.get(PATH)).toBeUndefined();
  });

  it("forgets a download once it is no longer in progress", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(4_000_000));
    rerender([]);
    expect(result.current.size).toBe(0);
  });
});
