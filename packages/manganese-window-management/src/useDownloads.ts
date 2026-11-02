import { WEBVIEW_DOWNLOADS_CHANGE_EVENT } from "@domicile-desktop/sdk/webview-element";
import { useEffect, useState } from "react";

import type { Downloads, RunningDownload } from "./browser/downloads";

const NONE: Downloads = {
  completed: 0,
  completedPaths: [],
  count: 0,
  receivedBytes: 0,
  running: [],
  totalBytes: 0,
};

/**
 * A `<webview>`'s page's downloads: those in progress, in all and one by one,
 * and how many finished and where.
 *
 * Reads the properties on mount and on each event, like `useLoadProgress`.
 * Takes `null` because the element comes from a callback ref.
 */
export const useDownloads = (view: HTMLWebViewElement | null): Downloads => {
  const [downloads, setDownloads] = useState(NONE);

  useEffect(() => {
    if (view === null) {
      return undefined;
    } else {
      const read = () => {
        setDownloads({
          completed: view.downloadCompletedCount,
          completedPaths: view.downloadCompletedPaths,
          count: view.downloadCount,
          receivedBytes: view.downloadReceivedBytes,
          running: runningDownloads(view),
          totalBytes: view.downloadTotalBytes,
        });
      };
      read();
      view.addEventListener(WEBVIEW_DOWNLOADS_CHANGE_EVENT, read);
      return () => {
        view.removeEventListener(WEBVIEW_DOWNLOADS_CHANGE_EVENT, read);
      };
    }
  }, [view]);

  return downloads;
};

/**
 * The view's downloads in progress, from its three lists that share indexes.
 * `undefined` from an engine without them.
 */
const runningDownloads = (
  view: HTMLWebViewElement,
): readonly RunningDownload[] | undefined => {
  const paths = view.downloadRunningPaths;
  const received = view.downloadRunningReceivedBytes;
  const total = view.downloadRunningTotalBytes;
  if (paths === undefined || received === undefined || total === undefined) {
    return undefined;
  } else {
    return paths.map((path, index) => ({
      path,
      receivedBytes: entry(received, index),
      totalBytes: entry(total, index),
    }));
  }
};

/** The entry at `index` of one of the lists the engine sends one per download. */
const entry = (list: readonly number[], index: number): number => {
  const value = list[index];
  if (value === undefined) {
    throw new Error(
      `browser window: the engine listed a download in progress without its bytes at ${String(index)}`,
    );
  } else {
    return value;
  }
};
