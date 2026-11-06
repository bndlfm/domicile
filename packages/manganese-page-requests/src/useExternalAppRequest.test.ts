import { describe, expect, it } from "bun:test";
import {
  WEBVIEW_EXTERNAL_APP_EVENT,
  WEBVIEW_EXTERNAL_APP_WITHDRAWN_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { act, renderHook } from "@testing-library/react";

import { useExternalAppRequest } from "./useExternalAppRequest";

/**
 * A fake engine request, recording its answers. Built by hand because the
 * test DOM lacks the engine's event type; cancelable because claiming it is
 * `preventDefault()`.
 */
const opens = (
  view: HTMLElement,
  answers: string[],
  mayRemember = true,
): DomicileExternalAppEvent => {
  const event = Object.assign(
    new Event(WEBVIEW_EXTERNAL_APP_EVENT, { cancelable: true }),
    {
      dismiss: () => {
        answers.push("dismiss");
      },
      mayRemember,
      open: (remember?: boolean) => {
        answers.push(`open ${String(remember)}`);
      },
      origin: "https://zoom.us",
      url: "zoommtg://zoom.us/join?confno=1",
    },
  );
  act(() => {
    view.dispatchEvent(event);
  });
  return event;
};

describe("useExternalAppRequest", () => {
  // The engine dismisses unclaimed requests when dispatch returns.
  it("takes the page's request", () => {
    const view = document.createElement("webview");
    const { result } = renderHook(() => useExternalAppRequest(view));

    const event = opens(view, []);

    expect(event.defaultPrevented).toBe(true);
    expect(result.current).toMatchObject({
      mayRemember: true,
      origin: "https://zoom.us",
      url: "zoommtg://zoom.us/join?confno=1",
    });
  });

  it("opens it once, remembering when asked, and has no request left", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useExternalAppRequest(view));
    opens(view, answers);

    act(() => {
      result.current?.open(true);
    });

    expect(answers).toStrictEqual(["open true"]);
    expect(result.current).toBeUndefined();
  });

  it("dismisses it", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useExternalAppRequest(view));
    opens(view, answers);

    act(() => {
      result.current?.dismiss();
    });

    expect(answers).toStrictEqual(["dismiss"]);
    expect(result.current).toBeUndefined();
  });

  it("drops a request the browser withdrew", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useExternalAppRequest(view));
    opens(view, answers);

    act(() => {
      view.dispatchEvent(new Event(WEBVIEW_EXTERNAL_APP_WITHDRAWN_EVENT));
    });

    expect(result.current).toBeUndefined();
    expect(answers).toStrictEqual([]);
  });
});
