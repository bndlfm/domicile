import { describe, expect, it } from "bun:test";
import {
  WEBVIEW_SIGN_IN_EVENT,
  WEBVIEW_SIGN_IN_WITHDRAWN_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { act, renderHook } from "@testing-library/react";

import { useSignInRequest } from "./useSignInRequest";

/**
 * A fake engine request, recording its answers. Built by hand because the
 * test DOM lacks the engine's event type; cancelable because claiming it is
 * `preventDefault()`.
 */
const asks = (view: HTMLElement, answers: string[]): DomicileSignInEvent => {
  const event = Object.assign(
    new Event(WEBVIEW_SIGN_IN_EVENT, { cancelable: true }),
    {
      dismiss: () => {
        answers.push("dismiss");
      },
      proxy: false,
      realm: "Router",
      secure: false,
      signIn: (username: string, password: string) => {
        answers.push(`sign in ${username} ${password}`);
      },
      url: "http://router.home/",
    },
  );
  act(() => {
    view.dispatchEvent(event);
  });
  return event;
};

describe("useSignInRequest", () => {
  // The engine cancels unclaimed requests when dispatch returns.
  it("takes the page's request", () => {
    const view = document.createElement("webview");
    const { result } = renderHook(() => useSignInRequest(view));

    const event = asks(view, []);

    expect(event.defaultPrevented).toBe(true);
    expect(result.current).toMatchObject({
      proxy: false,
      realm: "Router",
      secure: false,
      url: "http://router.home/",
    });
  });

  it("signs in once and has no request left", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useSignInRequest(view));
    asks(view, answers);

    act(() => {
      result.current?.signIn("admin", "hunter2");
    });

    expect(answers).toStrictEqual(["sign in admin hunter2"]);
    expect(result.current).toBeUndefined();
  });

  it("cancels it", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useSignInRequest(view));
    asks(view, answers);

    act(() => {
      result.current?.dismiss();
    });

    expect(answers).toStrictEqual(["dismiss"]);
    expect(result.current).toBeUndefined();
  });

  it("drops a request the browser withdrew", () => {
    const view = document.createElement("webview");
    const answers: string[] = [];
    const { result } = renderHook(() => useSignInRequest(view));
    asks(view, answers);

    act(() => {
      view.dispatchEvent(new Event(WEBVIEW_SIGN_IN_WITHDRAWN_EVENT));
    });

    expect(result.current).toBeUndefined();
    expect(answers).toStrictEqual([]);
  });
});
