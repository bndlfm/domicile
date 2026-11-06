import type { Option } from "@cprussin/option-result";
import { Button } from "@domicile-desktop/component-library/Button";
import { Switch } from "@domicile-desktop/component-library/Switch";
import type { DescribedApp } from "@domicile-desktop/system-apps/describe-apps";
import { AppWindowIcon } from "@phosphor-icons/react/dist/ssr/AppWindow";
import type { RefCallback } from "react";
import { useState } from "react";

import { css } from "../styled-system/css";
import { PageModal } from "./PageModal";
import { hostOf } from "./site-host";
import type { ExternalAppRequest } from "./useExternalAppRequest";

/** The application's icon beside the title, as the app chooser draws it. */
const TITLE_ICON_SIZE = 32;

type Props = {
  /** The application that opens the link; nothing when none does. */
  app: Option<DescribedApp>;
  /** Gets the element to focus: the answer button. */
  ref?: RefCallback<HTMLElement> | undefined;
  request: ExternalAppRequest;
};

/**
 * Asks whether to open a link for an application, such as `zoommtg:`, over
 * the page that opened it, as Chrome's "Open Zoom?" does, naming the
 * application from its desktop entry. A site that may be remembered gets a
 * switch to stop asking.
 *
 * A `PageModal`: Enter opens and Escape cancels. Takes no focus itself: the
 * caller focuses `ref`'s element as its own focus rules allow.
 */
export const ExternalAppAsk = ({ app, ref, request }: Props) => {
  const [remember, setRemember] = useState(false);
  const host = hostOf(request.origin);
  return app.match({
    None: () => (
      <PageModal
        footer={
          <Button ref={ref} type="submit">
            Close
          </Button>
        }
        message={`Nothing on this computer opens ${schemeOf(request.url)} links.`}
        onDismiss={request.dismiss}
        onSubmit={request.dismiss}
        title="No app opens this link"
      />
    ),
    Some: ({ icon, name }) => (
      <PageModal
        footer={
          <>
            <Button onClick={request.dismiss} variant="outline">
              Cancel
            </Button>
            <Button ref={ref} type="submit" variant="accent">
              {`Open ${name}`}
            </Button>
          </>
        }
        message={`${host ?? "This page"} wants to open this link in ${name}.`}
        onDismiss={request.dismiss}
        onSubmit={() => {
          request.open(remember);
        }}
        title={
          <>
            {icon === undefined ? (
              <AppWindowIcon size={TITLE_ICON_SIZE} />
            ) : (
              <img
                alt=""
                className={iconStyles}
                height={TITLE_ICON_SIZE}
                src={icon}
                width={TITLE_ICON_SIZE}
              />
            )}
            {`Open ${name}?`}
          </>
        }
      >
        <p className={addressStyles}>{request.url}</p>
        {request.mayRemember && host !== undefined && (
          <Switch
            checked={remember}
            label={`Always let ${host} open these links in ${name}`}
            onCheckedChange={setRemember}
          />
        )}
      </PageModal>
    ),
  });
};

/** The link's scheme, as people name its links: `zoommtg`. */
const schemeOf = (url: string): string => url.slice(0, url.indexOf(":"));

const iconStyles = css({ flexShrink: 0, objectFit: "contain" });

// The link on one line, as the app chooser shows the address it opens.
const addressStyles = css({
  color: "muted",
  fontFamily: "mono",
  fontSize: "xs",
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});
