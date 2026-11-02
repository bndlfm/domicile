import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";

import { useZoomPopup } from "./useZoomPopup";

describe(useZoomPopup, () => {
  it("shows nothing at first", () => {
    const { result } = renderHook(() => useZoomPopup(true));
    expect(result.current.open).toBe(false);
  });

  it("shows when asked", () => {
    const { result } = renderHook(() => useZoomPopup(true));
    act(() => {
      result.current.show();
    });
    expect(result.current.open).toBe(true);
  });

  it("closes the showing it is asked to", () => {
    const { result } = renderHook(() => useZoomPopup(true));
    act(() => {
      result.current.show();
    });
    act(() => {
      result.current.close(result.current.cue);
    });
    expect(result.current.open).toBe(false);
  });

  it("stays up when an earlier showing's time runs out", () => {
    const { result } = renderHook(() => useZoomPopup(true));
    act(() => {
      result.current.show();
    });
    const first = result.current.cue;
    act(() => {
      result.current.show();
    });
    act(() => {
      result.current.close(first);
    });
    expect(result.current.open).toBe(true);
  });

  it("counts each showing, so a repeat restarts its time", () => {
    const { result } = renderHook(() => useZoomPopup(true));
    act(() => {
      result.current.show();
    });
    const first = result.current.cue;
    act(() => {
      result.current.show();
    });
    expect(result.current.cue).toBeGreaterThan(first);
  });

  // Another window opening over it, or taking the focus, put it out of view;
  // its popup stayed over the new window.
  it("closes once its window is out of view, and stays closed after", () => {
    const { rerender, result } = renderHook(
      (inView: boolean) => useZoomPopup(inView),
      { initialProps: true },
    );
    act(() => {
      result.current.show();
    });
    rerender(false);
    expect(result.current.open).toBe(false);
    rerender(true);
    expect(result.current.open).toBe(false);
  });
});
