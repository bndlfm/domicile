import { describe, expect, it } from "bun:test";
import type { Result } from "@cprussin/option-result";
import { None, Some } from "@cprussin/option-result";

import { fakeDesktop } from "./fake-desktop";
import { opener } from "./opener";

/** A desktop whose `domicile open --which` prints `printed` and ends `code`. */
const answering = (printed: string, code = 0, asked: string[][] = []) =>
  fakeDesktop({}, (argv) => {
    asked.push([...argv]);
    return { code, stderr: "", stdout: printed };
  });

const ok = <T extends NonNullable<unknown>, E extends NonNullable<unknown>>(
  result: Result<T, E>,
): T =>
  result.unwrapOrElse((error) => {
    throw new Error(`expected a value: ${JSON.stringify(error)}`);
  });

describe("opener", () => {
  it("asks `domicile open` which application opens the target", async () => {
    const asked: string[][] = [];
    await opener(answering("zoom.desktop\n", 0, asked), "zoommtg://zoom.us/j");

    expect(asked).toStrictEqual([
      ["domicile", "open", "--which", "zoommtg://zoom.us/j"],
    ]);
  });

  it("names it by its desktop file ID without `.desktop`", async () => {
    expect(
      ok(await opener(answering("us.zoom.Zoom.desktop\n"), "zoommtg:x")),
    ).toStrictEqual(Some("us.zoom.Zoom"));
  });

  it("finds none when nothing opens it", async () => {
    expect(ok(await opener(answering("", 1), "nothing:x"))).toStrictEqual(
      None(),
    );
  });

  it("finds none when it would browse", async () => {
    expect(
      ok(await opener(answering(""), "https://example.com")),
    ).toStrictEqual(None());
  });
});
