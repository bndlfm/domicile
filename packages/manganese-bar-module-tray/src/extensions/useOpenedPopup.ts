import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import type {
  Extension,
  ExtensionPopup,
} from "@domicile-desktop/sdk/extension";
import { useCallback, useEffect, useRef, useState } from "react";

import { popupShown } from "./shown";

/** The open extension popup, and the screen whose bar it is on. */
export type OpenedPopup = ExtensionPopup & { screen: string };

/**
 * The open extension popup, held once for every bar's tray.
 *
 * A popup opens from a click on its action, through `open`, or from its
 * extension's `action.openPopup()`. That one opens on the bar its action was
 * last clicked on, as the click is what asks for it, or else on the `focused`
 * screen. It closes once its action leaves the tray, so a later
 * `action.enable()` does not reopen it.
 */
export const useOpenedPopup = (
  domicile: Pick<Domicile, "extensions">,
  extensions: readonly Extension[],
  focused: string,
): {
  opened: OpenedPopup | undefined;
  /** Open `popup` on `screen`, or close the popup there with `undefined`. */
  open: (screen: string, popup: ExtensionPopup | undefined) => void;
  /** Action `id` was clicked on the bar on `screen`. */
  clicked: (screen: string, id: string) => void;
} => {
  const [opened, setOpened] = useState<OpenedPopup | undefined>(undefined);
  // Set during render (React's pattern for derived state) so no frame shows
  // the stale popup.
  if (opened !== undefined && !popupShown(extensions, opened.id)) {
    setOpened(undefined);
  }

  // The last click on an action. A ref, as nothing renders from it.
  const lastClick = useRef<{ id: string; screen: string } | undefined>(
    undefined,
  );
  const clicked = useCallback((screen: string, id: string) => {
    lastClick.current = { id, screen };
  }, []);

  const open = useCallback(
    (screen: string, popup: ExtensionPopup | undefined) => {
      setOpened((now) =>
        popup === undefined ? closedOn(now, screen) : { ...popup, screen },
      );
    },
    [],
  );

  useEffect(
    () =>
      domicile.extensions.on("popup", (popup) => {
        open(
          lastClick.current?.id === popup.id
            ? lastClick.current.screen
            : focused,
          popup,
        );
      }),
    [domicile, focused, open],
  );

  return { clicked, open, opened };
};

/** The open popup, after bar `screen` closes its own. */
const closedOn = (
  opened: OpenedPopup | undefined,
  screen: string,
): OpenedPopup | undefined => (opened?.screen === screen ? undefined : opened);
