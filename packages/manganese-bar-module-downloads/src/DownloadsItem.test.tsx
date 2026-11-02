import { describe, expect, it } from "bun:test";
import type { Download } from "@domicile-desktop/sdk/desktop/downloads";
import { DownloadState } from "@domicile-desktop/sdk/desktop/downloads";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DownloadsItem } from "./DownloadsItem";

const download = (fields: Partial<Download> & { id: string }): Download => ({
  page: "https://mail.google.com/mail/u/0/",
  path: `/home/me/Downloads/${fields.id}`,
  receivedBytes: 100,
  state: DownloadState.Complete,
  totalBytes: 100,
  window: "1",
  ...fields,
});

const INVOICE = download({ id: "invoice.pdf" });
const PHOTOS = download({
  id: "photos.zip",
  page: "https://www.example.com/gallery",
  receivedBytes: 4_200_000,
  state: DownloadState.InProgress,
  totalBytes: 18_000_000,
});
const BROKEN = download({ id: "broken.iso", state: DownloadState.Failed });

type Calls = {
  onCancel: (id: string) => void;
  onClear: () => void;
  onOpen: (path: string) => void;
  onRemove: (id: string) => void;
  onShowInFolder: (path: string) => void;
};

const IGNORE = () => undefined;

const item = (
  downloads: readonly Download[] | undefined,
  calls: Partial<Calls> = {},
) =>
  render(
    <DownloadsItem
      downloads={downloads}
      onCancel={calls.onCancel ?? IGNORE}
      onClear={calls.onClear ?? IGNORE}
      onOpen={calls.onOpen ?? IGNORE}
      onRemove={calls.onRemove ?? IGNORE}
      onShowInFolder={calls.onShowInFolder ?? IGNORE}
    />,
  );

const open = async (name = "Downloads") => {
  await userEvent.click(screen.getByRole("button", { name }));
};

/** The panel's row for the file `name`. */
const row = (name: string) => {
  const found = screen
    .getAllByRole("listitem")
    .find((listed) => within(listed).queryByText(name) !== null);
  if (found === undefined) {
    throw new Error(`No row for ${name}`);
  }
  return within(found);
};

describe("DownloadsItem", () => {
  describe("the bar item", () => {
    it("is hidden until the engine lists the downloads", () => {
      item(undefined);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("is hidden while there are no downloads", () => {
      item([]);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("says how far the downloads in progress have come", () => {
      item([INVOICE, PHOTOS, { ...PHOTOS, id: "b", receivedBytes: 0 }]);
      expect(
        screen.getByRole("button", { name: "Downloading 2 files, 11%" }),
      ).toHaveTextContent("11%");
    });

    it("claims no amount while a size is unknown", () => {
      item([{ ...PHOTOS, totalBytes: 0 }]);
      expect(
        screen.getByRole("button", { name: "Downloading 1 file" }),
      ).not.toHaveTextContent("%");
    });
  });

  describe("the panel", () => {
    it("lists each download, the newest first", async () => {
      item([INVOICE, PHOTOS, BROKEN]);
      await open("Downloading 1 file, 23%");

      expect(
        screen.getAllByRole("listitem").map((listed) => listed.textContent),
      ).toStrictEqual([
        expect.stringContaining("broken.iso"),
        expect.stringContaining("photos.zip"),
        expect.stringContaining("invoice.pdf"),
      ]);
    });

    it("says where each came from and how it is going", async () => {
      item([INVOICE, PHOTOS, BROKEN]);
      await open("Downloading 1 file, 23%");

      expect(
        row("invoice.pdf").getByText("From mail.google.com"),
      ).toBeVisible();
      expect(row("photos.zip").getByText("4.2 of 18 MB")).toBeVisible();
      expect(
        row("photos.zip").getByRole("progressbar", { name: "photos.zip" }),
      ).toHaveAttribute("aria-valuenow", "23");
      expect(
        row("broken.iso").getByText("Failed · From mail.google.com"),
      ).toBeVisible();
    });

    it("cancels a download in progress", async () => {
      const canceled = new Promise((resolve) => {
        item([PHOTOS], { onCancel: resolve });
      });
      await open("Downloading 1 file, 23%");
      await userEvent.click(
        row("photos.zip").getByRole("button", { name: "Cancel" }),
      );

      expect(await canceled).toBe(PHOTOS.id);
    });

    it("opens a finished file", async () => {
      const opened = new Promise((resolve) => {
        item([INVOICE], { onOpen: resolve });
      });
      await open();
      await userEvent.click(
        row("invoice.pdf").getByRole("button", { name: "Open" }),
      );

      expect(await opened).toBe(INVOICE.path);
    });

    it("shows a finished file in its folder", async () => {
      const shown = new Promise((resolve) => {
        item([INVOICE], { onShowInFolder: resolve });
      });
      await open();
      await userEvent.click(
        row("invoice.pdf").getByRole("button", { name: "Show in folder" }),
      );

      expect(await shown).toBe(INVOICE.path);
    });

    it("removes a failed download from the list", async () => {
      const removed = new Promise((resolve) => {
        item([BROKEN], { onRemove: resolve });
      });
      await open();
      await userEvent.click(
        row("broken.iso").getByRole("button", { name: "Remove from list" }),
      );

      expect(await removed).toBe(BROKEN.id);
    });

    it("clears every download not in progress", async () => {
      const cleared = new Promise((resolve) => {
        item([INVOICE], { onClear: () => resolve(undefined) });
      });
      await open();
      await userEvent.click(screen.getByRole("button", { name: "Clear all" }));

      expect(await cleared).toBeUndefined();
    });

    it("offers no clearing while every download is in progress", async () => {
      item([PHOTOS]);
      await open("Downloading 1 file, 23%");

      expect(
        screen.queryByRole("button", { name: "Clear all" }),
      ).not.toBeInTheDocument();
    });
  });
});
