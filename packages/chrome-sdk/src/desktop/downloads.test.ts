import { describe, expect, it } from "bun:test";
import { FakeDomicileHost } from "../fake-host";
import { desktop } from "./desktop";
import { DownloadState } from "./downloads";

const running = {
  id: "8b0c7a1e-0000-4000-8000-000000000001",
  page: "https://mail.google.com/mail/u/0/",
  path: "/home/me/Downloads/invoice.pdf",
  receivedBytes: 10,
  state: "in-progress",
  totalBytes: 100,
  window: "3",
} as const;

describe("downloads", () => {
  it("lists nothing until the engine says", () => {
    expect(desktop(new FakeDomicileHost().host).downloads.list).toBeUndefined();
  });

  it("lists each download with its state", () => {
    const fake = new FakeDomicileHost();
    fake.set({
      downloads: [
        running,
        { ...running, id: "b", state: "complete" },
        { ...running, id: "c", state: "failed" },
      ],
    });

    expect(
      desktop(fake.host).downloads.list?.map(({ id, state }) => [id, state]),
    ).toStrictEqual([
      [running.id, DownloadState.InProgress],
      ["b", DownloadState.Complete],
      ["c", DownloadState.Failed],
    ]);
  });

  it("names no window for a download from a page that is not one", () => {
    const fake = new FakeDomicileHost();
    fake.set({ downloads: [{ ...running, window: "" }] });

    expect(desktop(fake.host).downloads.list?.[0]?.window).toBeUndefined();
  });

  it("throws on a download it cannot draw", () => {
    const fake = new FakeDomicileHost();
    fake.set({
      downloads: [{ ...running, state: "paused" as unknown as "failed" }],
    });

    expect(() => desktop(fake.host).downloads.list).toThrow();
  });

  it("cancels, removes and clears", () => {
    const fake = new FakeDomicileHost();
    const { downloads } = desktop(fake.host);
    downloads.cancel("a");
    downloads.remove("b");
    downloads.clear();

    expect(fake.calls).toStrictEqual([
      ["cancelDownload", "a"],
      ["removeDownload", "b"],
      ["clearDownloads"],
    ]);
  });

  it("says the downloads changed", async () => {
    const fake = new FakeDomicileHost();
    const changed = new Promise((resolve) => {
      desktop(fake.host).downloads.on("change", () => {
        resolve(undefined);
      });
    });
    fake.set({ downloads: [] });

    expect(await changed).toBeUndefined();
  });
});
