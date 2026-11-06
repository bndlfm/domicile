import { describe, expect, it } from "bun:test";
import { None, Some } from "@cprussin/option-result";
import { fakeDesktop } from "@domicile-desktop/system-apps/fake-desktop";
import { renderHook, waitFor } from "@testing-library/react";

import { useLinkOpener } from "./useLinkOpener";

const ZOOM_ENTRY = `[Desktop Entry]
Type=Application
Name=Zoom
Exec=zoom %u
MimeType=x-scheme-handler/zoommtg;
`;

/** A desktop with Zoom installed, whose `domicile open --which` prints `id`. */
const desktop = (id: string) =>
  fakeDesktop({ "/apps/applications/zoom.desktop": ZOOM_ENTRY }, (argv) =>
    argv[0] === "env"
      ? { code: 0, stderr: "", stdout: "XDG_DATA_DIRS=/apps\0" }
      : { code: id === "" ? 1 : 0, stderr: "", stdout: id },
  );

describe("useLinkOpener", () => {
  it("is unknown until read", () => {
    const { result } = renderHook(() =>
      useLinkOpener(desktop("zoom.desktop"), "zoommtg:x"),
    );

    expect(result.current).toBeUndefined();
  });

  it("names the application that opens the link", async () => {
    const { result } = renderHook(() =>
      useLinkOpener(desktop("zoom.desktop"), "zoommtg:x"),
    );

    await waitFor(() => {
      expect(result.current?.map(({ name }) => name)).toStrictEqual(
        Some("Zoom"),
      );
    });
  });

  it("finds none when nothing opens the link", async () => {
    const { result } = renderHook(() =>
      useLinkOpener(desktop(""), "nothing:x"),
    );

    await waitFor(() => {
      expect(result.current).toStrictEqual(None());
    });
  });

  it("reads nothing without a link", () => {
    const { result } = renderHook(() =>
      useLinkOpener(desktop("zoom.desktop"), undefined),
    );

    expect(result.current).toBeUndefined();
  });
});
