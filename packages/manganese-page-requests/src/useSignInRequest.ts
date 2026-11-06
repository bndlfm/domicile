import {
  WEBVIEW_SIGN_IN_EVENT,
  WEBVIEW_SIGN_IN_WITHDRAWN_EVENT,
} from "@domicile-desktop/sdk/webview-element";
import { useEffect, useState } from "react";

/** A user name and password a site or proxy asked for, waiting on the user. */
export type SignInRequest = {
  /** The server or proxy that asked, such as `https://example.com/`. */
  url: string;
  /** Its name for what is behind the sign-in; may be `""`. */
  realm: string;
  /** Whether a proxy asked rather than the site. */
  proxy: boolean;
  /** False when the password would cross the network unencrypted. */
  secure: boolean;
  /** Send the user name and password. */
  signIn: (username: string, password: string) => void;
  /** Cancel. */
  dismiss: () => void;
};

/**
 * The sign-in the page in `view` is waiting on, if any.
 *
 * `preventDefault()` claims it; the engine cancels unclaimed ones when
 * dispatch returns (see `WEBVIEW_SIGN_IN_EVENT`). Answering clears it, as does
 * the engine withdrawing it. Unmounting answers nothing: the engine cancels a
 * request whose element is gone.
 *
 * `view` is `null` when missing, as React's callback refs provide.
 */
export const useSignInRequest = (
  view: HTMLElement | null,
): SignInRequest | undefined => {
  const [request, setRequest] = useState<SignInRequest | undefined>(undefined);

  useEffect(() => {
    if (view === null) {
      return undefined;
    } else {
      const cleared = () => {
        setRequest(undefined);
      };
      const asked = (event: DomicileSignInEvent) => {
        event.preventDefault();
        setRequest({
          dismiss: () => {
            cleared();
            event.dismiss();
          },
          proxy: event.proxy,
          realm: event.realm,
          secure: event.secure,
          signIn: (username, password) => {
            cleared();
            event.signIn(username, password);
          },
          url: event.url,
        });
      };
      view.addEventListener(WEBVIEW_SIGN_IN_EVENT, asked);
      view.addEventListener(WEBVIEW_SIGN_IN_WITHDRAWN_EVENT, cleared);
      return () => {
        view.removeEventListener(WEBVIEW_SIGN_IN_EVENT, asked);
        view.removeEventListener(WEBVIEW_SIGN_IN_WITHDRAWN_EVENT, cleared);
      };
    }
  }, [view]);

  return request;
};
