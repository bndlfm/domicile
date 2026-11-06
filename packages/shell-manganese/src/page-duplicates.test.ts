import { describe, expect, it } from "bun:test";
import { Inbox } from "@domicile-desktop/manganese-notifications/inbox";
import { sharedWatch } from "@domicile-desktop/react/shared-watch";
import { FakeDomicileHost } from "@domicile-desktop/sdk/fake-host";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr/EnvelopeSimple";
import { act, renderHook } from "@testing-library/react";

import { usePageDuplicates } from "./page-duplicates";

const MAIL = "https://mail.example.com/";

/** A watched inbox whose window is app `appId`'s. */
const watched = (appId: string, pageNotifies: boolean) =>
  Inbox.Watched({
    app: { appId, pageNotifies, url: MAIL },
    icon: EnvelopeSimpleIcon,
    name: appId,
    notifiesAs: appId,
    open: () => undefined,
    read: () => sharedWatch(() => () => undefined),
  });

describe(usePageDuplicates, () => {
  it("is each open window of an inbox whose page notifies its news too", () => {
    const fake = new FakeDomicileHost();
    const inboxes = [watched("work", true), watched("chat", false)];
    const { result } = renderHook(() =>
      usePageDuplicates(fake.domicile, inboxes),
    );

    act(() => {
      fake.openApp(MAIL, "work", "new");
      fake.openApp(MAIL, "chat", "new");
      fake.openBrowser(MAIL);
    });

    expect(result.current).toEqual(["1"]);
  });

  it("is nothing before the engine lists the windows", () => {
    const fake = new FakeDomicileHost();
    const { result } = renderHook(() =>
      usePageDuplicates(fake.domicile, [watched("work", true)]),
    );

    expect(result.current).toEqual([]);
  });
});
