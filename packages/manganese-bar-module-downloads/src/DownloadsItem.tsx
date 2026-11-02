import { AnimatedCloseIcon } from "@domicile-desktop/component-library/AnimatedCloseIcon";
import { AnimatedDownloadIcon } from "@domicile-desktop/component-library/AnimatedDownloadIcon";
import { Button } from "@domicile-desktop/component-library/Button";
import { IconButton } from "@domicile-desktop/component-library/IconButton";
import { List, ListRow } from "@domicile-desktop/component-library/ListRow";
import { Panel, PanelAction } from "@domicile-desktop/component-library/Panel";
import { Popover } from "@domicile-desktop/component-library/Popover";
import type { Download } from "@domicile-desktop/sdk/desktop/downloads";
import { DownloadState } from "@domicile-desktop/sdk/desktop/downloads";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { BroomIcon } from "@phosphor-icons/react/dist/ssr/Broom";
import { FileIcon } from "@phosphor-icons/react/dist/ssr/File";
import { FileAudioIcon } from "@phosphor-icons/react/dist/ssr/FileAudio";
import { FileImageIcon } from "@phosphor-icons/react/dist/ssr/FileImage";
import { FilePdfIcon } from "@phosphor-icons/react/dist/ssr/FilePdf";
import { FileVideoIcon } from "@phosphor-icons/react/dist/ssr/FileVideo";
import { FileZipIcon } from "@phosphor-icons/react/dist/ssr/FileZip";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/ssr/FolderOpen";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import type { CSSProperties } from "react";

import { css } from "../styled-system/css";
import { downloadProgress, timeLeft } from "./download-progress";
import { FileKind, fileKind } from "./file-kind";
import { useSecondsLeft } from "./useSecondsLeft";

type Props = {
  /**
   * The desk's downloads, oldest first. `undefined` until the engine lists
   * them.
   */
  downloads: readonly Download[] | undefined;
  /** Stops the download `id`. */
  onCancel: (id: string) => void;
  /** Forgets every download not in progress. */
  onClear: () => void;
  /** Opens the file at `path`. */
  onOpen: (path: string) => void;
  /** Forgets the download `id`. */
  onRemove: (id: string) => void;
  /** Opens the folder the file at `path` is in. */
  onShowInFolder: (path: string) => void;
};

/**
 * The Downloads item on the bar, shown while the desk has downloads from any
 * window. It says how far the ones in progress have come, and its panel lists
 * every download, newest first, with what to do with each.
 */
export const DownloadsItem = ({ downloads, ...actions }: Props) => {
  if (downloads === undefined || downloads.length === 0) {
    return undefined;
  }
  const running = downloads.filter(
    ({ state }) => state === DownloadState.InProgress,
  );
  const percent = percentOf(running);
  const label = labelOf(running.length, percent);
  return (
    <Popover
      align="center"
      side="bottom"
      tone="overPhoto"
      tooltip={label}
      trigger={
        <button
          aria-label={label}
          className={triggerStyles}
          data-size-unknown={
            running.length > 0 && percent === undefined ? "" : undefined
          }
          type="button"
        >
          <AnimatedDownloadIcon cue={downloads.length} size={15} />
          {percent === undefined ? undefined : `${percent}%`}
        </button>
      }
      wide
    >
      <DownloadsPanel downloads={downloads} {...actions} />
    </Popover>
  );
};

/** Every download, newest first. */
const DownloadsPanel = ({
  downloads,
  onCancel,
  onClear,
  onOpen,
  onRemove,
  onShowInFolder,
}: Omit<Props, "downloads"> & { downloads: readonly Download[] }) => {
  const secondsLeft = useSecondsLeft(downloads);
  return (
    <Panel title="Downloads" width="standard">
      {downloads.some(({ state }) => state !== DownloadState.InProgress) && (
        <PanelAction>
          <Button
            beforeIcon={<BroomIcon aria-hidden size={14} />}
            onClick={onClear}
            rounded
            size="xs"
            variant="ghost"
          >
            Clear all
          </Button>
        </PanelAction>
      )}
      <List>
        {downloads.toReversed().map((download) => {
          const name = fileName(download.path);
          return (
            <ListRow
              detail={detailOf(download, secondsLeft.get(download.id))}
              end={
                download.state === DownloadState.InProgress ? (
                  <Button
                    onClick={() => {
                      onCancel(download.id);
                    }}
                    size="xs"
                  >
                    Cancel
                  </Button>
                ) : (
                  <>
                    {download.state === DownloadState.Complete && (
                      <>
                        <IconButton
                          label="Open"
                          onClick={() => {
                            onOpen(download.path);
                          }}
                        >
                          <ArrowSquareOutIcon aria-hidden size={14} />
                        </IconButton>
                        <IconButton
                          label="Show in folder"
                          onClick={() => {
                            onShowInFolder(download.path);
                          }}
                        >
                          <FolderOpenIcon aria-hidden size={14} />
                        </IconButton>
                      </>
                    )}
                    <IconButton
                      label="Remove from list"
                      onClick={() => {
                        onRemove(download.id);
                      }}
                    >
                      <AnimatedCloseIcon size={14} />
                    </IconButton>
                  </>
                )
              }
              endOnHover={download.state !== DownloadState.InProgress}
              icon={
                download.state === DownloadState.Failed ? (
                  <WarningCircleIcon size={16} />
                ) : (
                  <FileKindIcon kind={fileKind(download.path)} />
                )
              }
              key={download.id}
              label={name}
              surface="filled"
            >
              {download.state === DownloadState.InProgress && (
                <ProgressBar download={download} name={name} />
              )}
            </ListRow>
          );
        })}
      </List>
    </Panel>
  );
};

/** How far `download` has come, pulsing while its size is unknown. */
const ProgressBar = ({
  download,
  name,
}: {
  download: Download;
  name: string;
}) => {
  const fraction =
    download.totalBytes === 0
      ? undefined
      : download.receivedBytes / download.totalBytes;
  return (
    <div
      aria-label={name}
      aria-valuenow={
        fraction === undefined ? undefined : Math.floor(fraction * 100)
      }
      className={barStyles}
      data-size-unknown={fraction === undefined ? "" : undefined}
      role="progressbar"
      style={filledTo(fraction ?? 1)}
    />
  );
};

/** The percent the downloads in progress have come, if every size is known. */
const percentOf = (running: readonly Download[]): number | undefined => {
  if (
    running.length === 0 ||
    running.some(({ totalBytes }) => totalBytes === 0)
  ) {
    return undefined;
  }
  const received = running.reduce(
    (sum, { receivedBytes }) => sum + receivedBytes,
    0,
  );
  const total = running.reduce((sum, { totalBytes }) => sum + totalBytes, 0);
  return Math.floor((received / total) * 100);
};

/** The item's name and tooltip. */
const labelOf = (running: number, percent: number | undefined): string => {
  if (running === 0) {
    return "Downloads";
  }
  const files = `Downloading ${running} ${running === 1 ? "file" : "files"}`;
  return percent === undefined ? files : `${files}, ${percent}%`;
};

/** How `download` is going, and where it came from once it stopped. */
const detailOf = (
  download: Download,
  secondsLeft: number | undefined,
): string => {
  switch (download.state) {
    case DownloadState.InProgress: {
      const progress = downloadProgress(
        download.receivedBytes,
        download.totalBytes,
      );
      return secondsLeft === undefined
        ? progress
        : `${progress} · ${timeLeft(secondsLeft)}`;
    }
    case DownloadState.Complete: {
      return fromSite(download.page) ?? "Downloaded";
    }
    case DownloadState.Failed: {
      const from = fromSite(download.page);
      return from === undefined ? "Failed" : `Failed · ${from}`;
    }
  }
};

/** "From mail.google.com", for the page a download came from. */
const fromSite = (page: string): string | undefined => {
  const host = URL.parse(page)?.hostname.replace(/^www\./, "") ?? "";
  return host === "" ? undefined : `From ${host}`;
};

const fileName = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1);

/** The icon for a file of `kind`. */
const FileKindIcon = ({ kind }: { kind: FileKind }) => {
  switch (kind) {
    case FileKind.Archive: {
      return <FileZipIcon size={16} />;
    }
    case FileKind.Audio: {
      return <FileAudioIcon size={16} />;
    }
    case FileKind.Image: {
      return <FileImageIcon size={16} />;
    }
    case FileKind.Other: {
      return <FileIcon size={16} />;
    }
    case FileKind.Pdf: {
      return <FilePdfIcon size={16} />;
    }
    case FileKind.Video: {
      return <FileVideoIcon size={16} />;
    }
  }
};

/**
 * Inline style handing `fraction` to `barStyles` as `--download-progress`.
 * Inline because Panda only extracts build-time literals.
 */
const filledTo = (
  fraction: number,
): CSSProperties & Record<`--${string}`, string> => ({
  "--download-progress": String(fraction),
});

// Not the library's `Button`: its ghost variant uses `muted` text, which is
// unreadable over the wallpaper. Matches the Cast item, widening for the
// percent. Fixed-width digits so the bar does not shift as it climbs.
const triggerStyles = css({
  _hoverOrOpen: { backgroundColor: "fillOverPhoto" },
  "&[data-size-unknown] svg": {
    animation: "pulse {durations.pulse} {easings.in-out} infinite",
  },
  alignItems: "center",
  backgroundColor: "transparent",
  blockSize: 7,
  borderRadius: "lg",
  borderStyle: "none",
  color: "inherit",
  cursor: "pointer",
  display: "inline-flex",
  flexShrink: 0,
  fontSize: "xs",
  fontVariantNumeric: "tabular-nums",
  gap: 1,
  justifyContent: "center",
  minInlineSize: 7,
  paddingBlock: 0,
  paddingInline: 1.5,
  transition: "background-color {durations.fast} {easings.default}",
});

// A thin track filled as far as the download has come. Grows from the left:
// `transform-origin` takes no logical keyword.
const barStyles = css({
  _before: {
    backgroundColor: "accent",
    content: '""',
    inset: 0,
    position: "absolute",
    transform: "scaleX(var(--download-progress))",
    transformOrigin: "left",
    transition: "transform {durations.normal} {easings.out}",
  },
  "&[data-size-unknown]::before": {
    animation: "pulse {durations.pulse} {easings.in-out} infinite",
  },
  backgroundColor: "border",
  blockSize: 1,
  borderRadius: "full",
  overflow: "hidden",
  position: "relative",
});
