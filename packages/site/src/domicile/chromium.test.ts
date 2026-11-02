import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { engineChromium } from "./chromium";

test("reads the pin's revision and its version from the engine package", () => {
  const root = mkdtempSync(join(tmpdir(), "chromium-"));
  const engine = join(root, "packages", "domicile-engine");
  mkdirSync(engine, { recursive: true });
  writeFileSync(join(engine, "CHROMIUM_PIN"), "# a comment\n#\nabc123def\n");
  writeFileSync(join(engine, "CHROMIUM_VERSION"), "159.0.8137.0\n");

  expect(engineChromium(root)).toEqual({
    revision: "abc123def",
    version: "159.0.8137.0",
  });
});
