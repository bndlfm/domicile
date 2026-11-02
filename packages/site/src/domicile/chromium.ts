import { readFileSync } from "node:fs";
import { join } from "node:path";

import { REPO_ROOT } from "../docs/pages";

/** The Chromium the engine is built on, from the engine package's pin files. */
export const engineChromium = (
  root: string = REPO_ROOT,
): { revision: string; version: string } => {
  const engine = join(root, "packages", "domicile-engine");
  const read = (file: string) =>
    readFileSync(join(engine, file), "utf8").trim();
  const revision = read("CHROMIUM_PIN").split("\n").at(-1);
  if (revision === undefined) {
    throw new Error("CHROMIUM_PIN names no revision");
  } else {
    return { revision, version: read("CHROMIUM_VERSION") };
  }
};
