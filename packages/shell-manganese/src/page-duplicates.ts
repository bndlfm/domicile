import type { Inbox } from "@domicile-desktop/manganese-notifications/inbox";
import { InboxKind } from "@domicile-desktop/manganese-notifications/inbox";
import type { Domicile } from "@domicile-desktop/sdk/desktop/desktop";
import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * The browser windows whose pages notify what their inbox notifies already:
 * each open window of an inbox whose `app.pageNotifies`, such as a Gmail
 * account's. Their pages' notifications are cleared as they arrive. Empty
 * until the engine lists the windows.
 */
export const usePageDuplicates = (
  domicile: Pick<Domicile, "browser">,
  inboxes: readonly Inbox[],
): readonly string[] => {
  const appIds = useMemo(() => inboxes.flatMap(duplicatingAppIdsOf), [inboxes]);
  const subscribe = useCallback(
    (changed: () => void) => domicile.browser.on("change", changed),
    [domicile],
  );
  // Joined, so a list that changes no such window changes nothing.
  const ids = useSyncExternalStore(subscribe, () =>
    (domicile.browser.windows ?? [])
      .filter(({ appId }) => appIds.includes(appId))
      .map(({ id }) => id)
      .join(" "),
  );
  return useMemo(() => (ids === "" ? [] : ids.split(" ")), [ids]);
};

/** The app id of `inbox`'s window, if its page notifies the inbox's news. */
const duplicatingAppIdsOf = (inbox: Inbox): readonly string[] => {
  switch (inbox.kind) {
    case InboxKind.Watched: {
      return inbox.app?.pageNotifies === true ? [inbox.app.appId] : [];
    }
    case InboxKind.Window: {
      return [];
    }
  }
};
