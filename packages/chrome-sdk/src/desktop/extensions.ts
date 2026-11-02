// Browser extensions with an action, which a shell's tray draws. See
// docs/architecture/EXTENSIONS.md.

import { z } from "zod";

import type { DomicileExtension, DomicileHost } from "../domicile-host";
import type { Extension, ExtensionPopup } from "../extension";
import { extensionPopupSchema, extensionSchema } from "../extension";
import { memoizeLast } from "./memoize-last";
import type { On } from "./subscribe";
import { hostEvent, on } from "./subscribe";

export type ExtensionsListeners = {
  change: () => void;
  /**
   * An extension called `action.openPopup()`. Open `popup` as a clicked
   * action's popup. Parsed: throws on a request a shell cannot open.
   */
  popup: (request: ExtensionPopup) => void;
};

export type Extensions = {
  /**
   * `undefined` until the engine says. Parsed, since the engine and the SDK
   * ship apart: throws on an action a shell cannot draw.
   */
  readonly list: readonly Extension[] | undefined;
  /** Click extension `id`'s action. One with a popup is the shell's to open. */
  activate: (id: string) => void;
  on: On<ExtensionsListeners>;
};

export type ExtensionsHost = Pick<
  DomicileHost,
  | "activateExtension"
  | "addEventListener"
  | "extensions"
  | "removeEventListener"
>;

export const extensions = (host: ExtensionsHost): Extensions => {
  const listOf = memoizeLast((list: readonly DomicileExtension[] | null) =>
    list === null ? undefined : z.array(extensionSchema).parse(list),
  );
  return {
    activate: (id) => {
      host.activateExtension(id);
    },
    get list() {
      return listOf(host.extensions);
    },
    on: on<ExtensionsListeners>({
      change: (listener) =>
        hostEvent(host, "extensionschanged", () => listener()),
      popup: (listener) =>
        hostEvent(host, "extensionpopuprequested", ({ extensionId, popup }) =>
          listener(extensionPopupSchema.parse({ id: extensionId, popup })),
        ),
    }),
  };
};
