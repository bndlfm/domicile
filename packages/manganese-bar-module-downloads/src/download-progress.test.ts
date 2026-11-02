import { describe, expect, it } from "bun:test";

import { downloadProgress, timeLeft } from "./download-progress";

describe(downloadProgress, () => {
  it("says what came in of the total, in the total's unit", () => {
    expect(downloadProgress(4_200_000, 18_000_000)).toBe("4.2 of 18 MB");
  });

  it("drops to a smaller unit for a small file", () => {
    expect(downloadProgress(1500, 52_000)).toBe("1.5 of 52 kB");
  });

  it("says what came in so far when the size is unknown", () => {
    expect(downloadProgress(4_200_000, 0)).toBe("4.2 MB so far");
  });
});

describe(timeLeft, () => {
  it.each([
    [1, "1 second left"],
    [20.4, "21 seconds left"],
    [59.5, "1 minute left"],
    [60, "1 minute left"],
    [61, "2 minutes left"],
    [3600, "1 hour left"],
    [7300, "3 hours left"],
  ])("says %d seconds as %p", (seconds, said) => {
    expect(timeLeft(seconds)).toBe(said);
  });
});
