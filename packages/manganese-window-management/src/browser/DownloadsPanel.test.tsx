import { describe, expect, it } from "bun:test";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DownloadsPanel } from "./DownloadsPanel";
import type { RunningDownload } from "./downloads";

const IGNORE = () => undefined;

const panel = (
  paths: readonly string[] | undefined,
  calls: Partial<{
    onCancel: (path: string) => void;
    onClearAll: () => void;
    onOpen: (path: string) => void;
    onRemove: (path: string) => void;
    onShowInFolder: (path: string) => void;
  }> = {},
  // From an engine that does not list them.
  running: readonly RunningDownload[] | "unlisted" = [],
  secondsLeft: ReadonlyMap<string, number> = new Map(),
) =>
  render(
    <DownloadsPanel
      downloads={{
        completed: paths?.length ?? 2,
        completedPaths: paths,
        count: running === "unlisted" ? 2 : running.length,
        receivedBytes: 0,
        running: running === "unlisted" ? undefined : running,
        totalBytes: 0,
      }}
      onCancel={calls.onCancel ?? IGNORE}
      onClearAll={calls.onClearAll ?? IGNORE}
      onOpen={calls.onOpen ?? IGNORE}
      onRemove={calls.onRemove ?? IGNORE}
      onShowInFolder={calls.onShowInFolder ?? IGNORE}
      secondsLeft={secondsLeft}
    />,
  );

/** The row that names `name`. */
const rowOf = (name: string): HTMLElement => {
  const row = screen
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));
  if (row === undefined) {
    throw new Error(`no row for ${name}`);
  }
  return row;
};

const ZIP: RunningDownload = {
  path: "/home/me/Downloads/dataset.zip",
  receivedBytes: 4_200_000,
  totalBytes: 18_000_000,
};
const PDF: RunningDownload = {
  path: "/home/me/Downloads/report.pdf",
  receivedBytes: 4_200_000,
  totalBytes: 0,
};

describe(DownloadsPanel, () => {
  describe("rendering", () => {
    it("says one download finished", () => {
      panel(["/home/me/Downloads/report.pdf"]);
      expect(
        screen.getByRole("heading", { name: "Download finished" }),
      ).toBeInTheDocument();
    });

    it("says how many finished", () => {
      panel(["/home/me/Downloads/a.jpg", "/home/me/Pictures/b.jpg"]);
      expect(
        screen.getByRole("heading", { name: "2 downloads finished" }),
      ).toBeInTheDocument();
    });

    it("lists each file by name and folder, the newest first", () => {
      panel(["/home/me/Downloads/a.jpg", "/home/me/Pictures/b.jpg"]);
      const rows = screen.getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toStrictEqual([
        expect.stringContaining("b.jpgSaved to Pictures"),
        expect.stringContaining("a.jpgSaved to Downloads"),
      ]);
    });

    it("lists no files from an engine that does not say where they went", () => {
      panel(undefined);
      expect(
        screen.getByRole("heading", { name: "2 downloads finished" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  describe("with downloads in progress", () => {
    it("names the one in progress", () => {
      panel([], {}, [ZIP]);
      expect(
        screen.getByRole("heading", { name: "Downloading dataset.zip" }),
      ).toBeInTheDocument();
    });

    it("says how many are in progress", () => {
      panel([], {}, [ZIP, PDF]);
      expect(
        screen.getByRole("heading", { name: "Downloading 2 files" }),
      ).toBeInTheDocument();
    });

    it("says how many from an engine that does not list them", () => {
      panel([], {}, "unlisted");
      expect(
        screen.getByRole("heading", { name: "Downloading 2 files" }),
      ).toBeInTheDocument();
    });

    it("lists them above the finished ones, the newest first", () => {
      panel(["/home/me/Downloads/a.jpg"], {}, [ZIP, PDF]);
      const rows = screen.getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toStrictEqual([
        expect.stringContaining("report.pdf"),
        expect.stringContaining("dataset.zip"),
        expect.stringContaining("a.jpg"),
      ]);
    });

    it("says how far each has come, and how long it has left", () => {
      panel([], {}, [ZIP, PDF], new Map([[ZIP.path, 20]]));
      expect(rowOf("dataset.zip")).toHaveTextContent(
        "4.2 of 18 MB · 20 seconds left",
      );
      expect(rowOf("report.pdf")).toHaveTextContent("4.2 MB so far");
    });

    it("shows how far each has come as a bar, without claiming an unknown size", () => {
      panel([], {}, [ZIP, PDF]);
      expect(
        screen.getByRole("progressbar", { name: "dataset.zip" }),
      ).toHaveAttribute("aria-valuenow", "23");
      expect(
        screen.getByRole("progressbar", { name: "report.pdf" }),
      ).not.toHaveAttribute("aria-valuenow");
    });

    it("offers to clear only what finished", () => {
      panel([], {}, [ZIP]);
      expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();
    });
  });

  describe("interactions", () => {
    const pressIn = async (name: string, button: string) => {
      await userEvent.click(
        within(rowOf(name)).getByRole("button", { name: button }),
      );
    };

    it("opens a file", async () => {
      const opened = new Promise((resolve) => {
        panel(["/home/me/Downloads/a.jpg", "/home/me/Downloads/b.jpg"], {
          onOpen: resolve,
        });
      });
      await pressIn("a.jpg", "Open");
      expect(await opened).toBe("/home/me/Downloads/a.jpg");
    });

    it("shows a file in its folder", async () => {
      const shown = new Promise((resolve) => {
        panel(["/home/me/Downloads/a.jpg"], { onShowInFolder: resolve });
      });
      await pressIn("a.jpg", "Show in folder");
      expect(await shown).toBe("/home/me/Downloads/a.jpg");
    });

    it("removes a file from the list", async () => {
      const removed = new Promise((resolve) => {
        panel(["/home/me/Downloads/a.jpg"], { onRemove: resolve });
      });
      await pressIn("a.jpg", "Remove from list");
      expect(await removed).toBe("/home/me/Downloads/a.jpg");
    });

    it("cancels a download in progress", async () => {
      const canceled = new Promise((resolve) => {
        panel([], { onCancel: resolve }, [ZIP]);
      });
      await pressIn("dataset.zip", "Cancel");
      expect(await canceled).toBe(ZIP.path);
    });

    it("clears them all", async () => {
      const cleared = new Promise((resolve) => {
        panel(["/home/me/Downloads/a.jpg"], {
          onClearAll: () => {
            resolve(true);
          },
        });
      });
      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
      expect(await cleared).toBe(true);
    });
  });
});
