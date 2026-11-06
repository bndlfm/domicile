import { Button } from "@domicile-desktop/component-library/Button";
import { Field } from "@domicile-desktop/component-library/Field";
import { Input } from "@domicile-desktop/component-library/Input";
import type { RefCallback } from "react";
import { useState } from "react";

import { PageModal } from "./PageModal";
import { hostOf } from "./site-host";
import type { SignInRequest } from "./useSignInRequest";

type Props = {
  /** Gets the element to focus: the user name field. */
  ref?: RefCallback<HTMLElement> | undefined;
  request: SignInRequest;
};

/**
 * Asks for the user name and password a site or proxy wants (HTTP
 * authentication), over the page that asked, as Chrome's "Sign in" does. Says
 * so when the password would cross the network unencrypted.
 *
 * The server's realm is not shown: it is the server's own text, which Chrome
 * also leaves out so a site cannot word the question.
 *
 * A `PageModal`: Enter signs in and Escape cancels. Takes no focus itself: the
 * caller focuses `ref`'s element as its own focus rules allow.
 */
export const SignInAsk = ({ ref, request }: Props) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const words = wordsFor(request);
  return (
    <PageModal
      footer={
        <>
          <Button onClick={request.dismiss} variant="outline">
            Cancel
          </Button>
          <Button type="submit" variant="accent">
            Sign in
          </Button>
        </>
      }
      message={words.message}
      onDismiss={request.dismiss}
      onSubmit={() => {
        request.signIn(username, password);
      }}
      title={words.title}
    >
      <Field label="Username">
        <Input
          autoComplete="username"
          onValueChange={setUsername}
          ref={ref}
          value={username}
        />
      </Field>
      <Field label="Password">
        <Input
          autoComplete="current-password"
          onValueChange={setPassword}
          type="password"
          value={password}
        />
      </Field>
    </PageModal>
  );
};

/** The dialog's title and text. */
const wordsFor = (
  request: SignInRequest,
): { message: string; title: string } => {
  const host = hostOf(request.url) ?? request.url;
  const notPrivate = request.secure
    ? ""
    : " Your connection to it is not private.";
  if (request.proxy) {
    return {
      message: `The proxy at ${host} needs a username and password.${notPrivate}`,
      title: "Sign in to your network's proxy",
    };
  } else {
    return {
      message: `This site needs a username and password.${notPrivate}`,
      title: `Sign in to ${host}`,
    };
  }
};
