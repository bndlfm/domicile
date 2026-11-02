import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import type { Download } from "@domicile-desktop/sdk/desktop/downloads";
import { DownloadState } from "@domicile-desktop/sdk/desktop/downloads";
import { renderHook } from "@testing-library/react";

import { useSecondsLeft } from "./useSecondsLeft";

const ID = "zip";

const at = (
  receivedBytes: number,
  totalBytes = 10_000_000,
  state = DownloadState.InProgress,
): readonly Download[] => [
  {
    id: ID,
    page: "https://example.com/",
    path: "/home/me/Downloads/dataset.zip",
    receivedBytes,
    state,
    totalBytes,
    window: undefined,
  },
];

const watch = () =>
  renderHook((downloads: readonly Download[]) => useSecondsLeft(downloads), {
    initialProps: at(2_000_000),
  });

afterEach(() => {
  setSystemTime();
});

describe(useSecondsLeft, () => {
  it("knows nothing until a download has come some way", () => {
    setSystemTime(new Date(0));
    const { result } = watch();
    expect(result.current.get(ID)).toBeUndefined();
  });

  it("says how long is left at the rate it has come so far", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(4_000_000));
    // 1 MB a second, 6 MB to go.
    expect(result.current.get(ID)).toBe(6);
  });

  it("claims nothing for a download of unknown size", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(4_000_000, 0));
    expect(result.current.get(ID)).toBeUndefined();
  });

  it("forgets a download once it is no longer in progress", () => {
    setSystemTime(new Date(0));
    const { rerender, result } = watch();
    setSystemTime(new Date(2000));
    rerender(at(10_000_000, 10_000_000, DownloadState.Complete));
    expect(result.current.size).toBe(0);
  });
});
