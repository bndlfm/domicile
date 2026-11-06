import type { Result } from "@cprussin/option-result";
import { None, Ok, Option } from "@cprussin/option-result";
import type { SystemError } from "@domicile-desktop/sdk/system";
import type { AppsDesktop } from "@domicile-desktop/system-apps/apps-desktop";
import type { DescribedApp } from "@domicile-desktop/system-apps/describe-apps";
import { describeApps } from "@domicile-desktop/system-apps/describe-apps";
import { opener } from "@domicile-desktop/system-apps/opener";
import { useEffect, useState } from "react";

/**
 * The application that opens `url`, as `domicile open` would run it, named
 * and drawn by its desktop entry: nothing when none opens it, and `undefined`
 * until read or without a `url`. Reads again when `url` changes, dropping a
 * read it has moved past.
 */
export const useLinkOpener = (
  domicile: AppsDesktop,
  url: string | undefined,
): Option<DescribedApp> | undefined => {
  const [found, setFound] = useState<
    { url: string; app: Option<DescribedApp> } | undefined
  >();

  useEffect(() => {
    if (url === undefined) {
      return undefined;
    } else {
      let current = true;
      openerOf(domicile, url)
        .then((result) => {
          result.match({
            Err: (error) => {
              throw new Error(
                `could not find what opens ${url}: ${error.message}`,
              );
            },
            Ok: (app) => {
              if (current) {
                setFound({ app, url });
              }
            },
          });
        })
        .catch((error: unknown) => {
          // biome-ignore lint/suspicious/noConsole: the dialog then waits on nothing; say why
          console.error("Could not find the app that opens a link", error);
        });
      return () => {
        current = false;
      };
    }
  }, [domicile, url]);

  return found?.url === url ? found?.app : undefined;
};

/** The application `domicile open` runs for `url`, described. */
const openerOf = async (
  domicile: AppsDesktop,
  url: string,
): Promise<Result<Option<DescribedApp>, SystemError>> =>
  (await opener(domicile, url)).andThenAsync((id) =>
    id.match({
      None: () =>
        Promise.resolve(Ok<Option<DescribedApp>, SystemError>(None())),
      Some: async (found) =>
        (await describeApps(domicile, [found])).map((apps) =>
          Option.wrap(apps[0]),
        ),
    }),
  );
