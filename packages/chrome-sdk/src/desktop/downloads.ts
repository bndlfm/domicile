// The desk's downloads: every download a browser window's page started while
// the browser runs, kept after its window closes until the shell removes it.
// See "Downloads" in docs/SHELL-BROWSER-WINDOWS.md.

import { z } from "zod";

import type { DomicileDownload, DomicileHost } from "../domicile-host";
import { memoizeLast } from "./memoize-last";
import type { On } from "./subscribe";
import { hostEvent, on } from "./subscribe";

export enum DownloadState {
  InProgress,
  Complete,
  /** Interrupted by the network or the disk. */
  Failed,
}

/**
 * Parses a row of `DomicileHost.downloads`. The engine and the SDK ship apart,
 * so a row is checked rather than trusted.
 */
const downloadSchema = z.object({
  id: z.string(),
  /** The page that started it. */
  page: z.string(),
  /** Where it is saved, absolute. */
  path: z.string(),
  receivedBytes: z.number(),
  state: z.enum(["in-progress", "complete", "failed"]).transform((state) => {
    switch (state) {
      case "in-progress": {
        return DownloadState.InProgress;
      }
      case "complete": {
        return DownloadState.Complete;
      }
      case "failed": {
        return DownloadState.Failed;
      }
    }
  }),
  /** `0` when the server sent no size. */
  totalBytes: z.number(),
  /**
   * The browser window whose page started it, which may have closed since;
   * `undefined` for a page that is not a browser window.
   */
  window: z
    .string()
    .transform((window) => (window === "" ? undefined : window)),
});

export type Download = z.infer<typeof downloadSchema>;

export type DownloadsListeners = {
  /** A download started, progressed, finished, failed or left the list. */
  change: () => void;
};

export type Downloads = {
  /** Oldest first; `undefined` until the engine says. */
  readonly list: readonly Download[] | undefined;
  /** Cancel download `id`. It leaves the list. */
  cancel: (id: string) => void;
  /** Take finished or failed download `id` off the list. The file stays. */
  remove: (id: string) => void;
  /** Take every download not in progress off the list. The files stay. */
  clear: () => void;
  on: On<DownloadsListeners>;
};

export type DownloadsHost = Pick<
  DomicileHost,
  | "addEventListener"
  | "cancelDownload"
  | "clearDownloads"
  | "downloads"
  | "removeDownload"
  | "removeEventListener"
>;

export const downloads = (host: DownloadsHost): Downloads => {
  const listOf = memoizeLast((list: readonly DomicileDownload[] | null) =>
    list === null ? undefined : z.array(downloadSchema).parse(list),
  );
  return {
    cancel: (id) => {
      host.cancelDownload(id);
    },
    clear: () => {
      host.clearDownloads();
    },
    get list() {
      return listOf(host.downloads);
    },
    on: on<DownloadsListeners>({
      change: (listener) =>
        hostEvent(host, "downloadschanged", () => listener()),
    }),
    remove: (id) => {
      host.removeDownload(id);
    },
  };
};
