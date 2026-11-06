// The application `domicile open` runs for a file or address.

import type { Option, Result } from "@cprussin/option-result";
import { None, Some } from "@cprussin/option-result";
import type { SystemError } from "@domicile-desktop/sdk/system";
import type { AppsDesktop } from "./apps-desktop";

/**
 * The desktop file ID, without `.desktop`, of the application `domicile open`
 * runs for `target`, as `domicile open --which` says: nothing when none opens
 * it, or when it is a web address, which browses. A file path must be
 * absolute. The `domicile` is the running desktop's own, first on its `PATH`.
 */
export const opener = async (
  domicile: AppsDesktop,
  target: string,
): Promise<Result<Option<string>, SystemError>> =>
  (await domicile.processes.run(["domicile", "open", "--which", target])).map(
    ({ code, stdout }) => {
      const id = stdout.trim().replace(/\.desktop$/, "");
      return code !== 0 || id === "" ? None<string>() : Some(id);
    },
  );
