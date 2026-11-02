import { describe, expect, it } from "bun:test";
import { extensionPopupSchema } from "./extension";

const ID = "abcdefghijklmnopabcdefghijklmnop";

describe("extensionPopupSchema", () => {
  it("refuses a popup outside an extension", () => {
    expect(
      extensionPopupSchema.safeParse({ id: ID, popup: "https://example.com/" })
        .success,
    ).toBe(false);
  });
});
