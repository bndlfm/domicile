/** A page's downloads. See `downloadCount` on `<webview>`. */
export type Downloads = {
  /** How many finished, until cleared. */
  completed: number;
  /**
   * Where the finished ones were saved, absolute, in the order they started.
   * `undefined` from an engine without it.
   */
  completedPaths: readonly string[] | undefined;
  /** How many are in progress. */
  count: number;
  receivedBytes: number;
  /**
   * Each one in progress, in the order they started. `undefined` from an
   * engine without it.
   */
  running: readonly RunningDownload[] | undefined;
  /** `0` when any one in progress has an unknown size. */
  totalBytes: number;
};

/** One download in progress. See `downloadRunningPaths` on `<webview>`. */
export type RunningDownload = {
  /** Where it is saved, absolute. */
  path: string;
  receivedBytes: number;
  /** `0` when its size is unknown. */
  totalBytes: number;
};
