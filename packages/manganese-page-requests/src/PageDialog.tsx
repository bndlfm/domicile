import { Button } from "@domicile-desktop/component-library/Button";
import { Input } from "@domicile-desktop/component-library/Input";
import type { RefCallback } from "react";
import { useId, useState } from "react";

import { PageModal } from "./PageModal";
import { hostOf } from "./site-host";
import type { DialogRequest } from "./useDialogRequest";

type Props = {
  /**
   * Who asks, as the user knows it, such as an extension's name. Defaults to
   * the calling site's host.
   */
  asker?: string | undefined;
  /** Gets the element to focus: a prompt's field, or else OK. */
  ref?: RefCallback<HTMLElement> | undefined;
  request: DialogRequest;
};

/**
 * A page's `alert()`, `confirm()`, `prompt()` or `beforeunload`, over the page
 * it pauses.
 *
 * A `PageModal`: Enter is OK and Escape is Cancel. Takes no focus itself: the
 * caller focuses `ref`'s element as its own focus rules allow.
 */
export const PageDialog = ({ asker, ref, request }: Props) => {
  const [value, setValue] = useState(request.defaultValue);
  const messageId = useId();
  const words = wordsFor(request, asker ?? hostOf(request.origin));
  return (
    <PageModal
      footer={
        <>
          {request.type !== "alert" && (
            <Button onClick={request.dismiss} variant="outline">
              Cancel
            </Button>
          )}
          <Button
            ref={request.type === "prompt" ? undefined : ref}
            type="submit"
            variant="accent"
          >
            {words.accept}
          </Button>
        </>
      }
      message={<span id={messageId}>{words.message}</span>}
      onDismiss={request.dismiss}
      onSubmit={() => {
        request.accept(request.type === "prompt" ? value : undefined);
      }}
      title={words.title}
    >
      {request.type === "prompt" && (
        <Input
          aria-labelledby={messageId}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          ref={ref}
          value={value}
        />
      )}
    </PageModal>
  );
};

/**
 * The dialog's title, text and OK button. A `beforeunload` has Chrome's words,
 * since Chrome shows no text from the page.
 */
const wordsFor = (
  request: DialogRequest,
  name: string | undefined,
): { accept: string; message: string; title: string } => {
  if (request.type === "beforeunload") {
    return {
      accept: "Leave",
      message: "Changes you made may not be saved.",
      title: "Leave site?",
    };
  } else {
    return {
      accept: "OK",
      message: request.message,
      title: name === undefined ? "This page says" : `${name} says`,
    };
  }
};
