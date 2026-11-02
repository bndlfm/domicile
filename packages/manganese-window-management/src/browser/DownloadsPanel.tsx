import { Button } from "@domicile-desktop/component-library/Button";
import { IconButton } from "@domicile-desktop/component-library/IconButton";
import { List, ListRow } from "@domicile-desktop/component-library/ListRow";
import { PanelHeader } from "@domicile-desktop/component-library/PanelHeader";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { BroomIcon } from "@phosphor-icons/react/dist/ssr/Broom";
import { FileIcon } from "@phosphor-icons/react/dist/ssr/File";
import { FileAudioIcon } from "@phosphor-icons/react/dist/ssr/FileAudio";
import { FileImageIcon } from "@phosphor-icons/react/dist/ssr/FileImage";
import { FilePdfIcon } from "@phosphor-icons/react/dist/ssr/FilePdf";
import { FileVideoIcon } from "@phosphor-icons/react/dist/ssr/FileVideo";
import { FileZipIcon } from "@phosphor-icons/react/dist/ssr/FileZip";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/ssr/FolderOpen";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

import type { CSSProperties } from "react";

import { css } from "../../styled-system/css";
import { vstack } from "../../styled-system/patterns";
import { downloadProgress, timeLeft } from "./download-progress";
import type { Downloads, RunningDownload } from "./downloads";
import { FileKind, fileKind } from "./file-kind";

type Props = {
  /** The page's downloads: some in progress or finished. */
  downloads: Downloads;
  onCancel: (path: string) => void;
  onClearAll: () => void;
  onOpen: (path: string) => void;
  onRemove: (path: string) => void;
  onShowInFolder: (path: string) => void;
  /** How long each download in progress has left, by path, once known. */
  secondsLeft: ReadonlyMap<string, number>;
};

/**
 * A browser window's downloads, as Chrome's download bubble lists them: those
 * in progress, with how far each has come, above the finished ones, each part
 * newest first. Each file's buttons show while the pointer is on it.
 *
 * Lists no files from an engine that does not say where they went.
 */
export const DownloadsPanel = ({
  downloads,
  onCancel,
  onClearAll,
  onOpen,
  onRemove,
  onShowInFolder,
  secondsLeft,
}: Props) => {
  const rows =
    (downloads.running?.length ?? 0) + (downloads.completedPaths?.length ?? 0);
  return (
    <section aria-labelledby={TITLE_ID} className={panelStyles}>
      <PanelHeader
        action={
          downloads.completed === 0 ? undefined : (
            <Button
              beforeIcon={<BroomIcon aria-hidden size={14} />}
              onClick={onClearAll}
              rounded
              size="xs"
              variant="ghost"
            >
              Clear all
            </Button>
          )
        }
        title={title(downloads)}
        titleId={TITLE_ID}
      />
      {rows === 0 ? undefined : (
        <List>
          {(downloads.running ?? []).toReversed().map((download) => (
            <ListRow
              detail={detail(download, secondsLeft.get(download.path))}
              end={
                <IconButton
                  label="Cancel"
                  onClick={() => {
                    onCancel(download.path);
                  }}
                >
                  <XIcon aria-hidden size={14} />
                </IconButton>
              }
              endOnHover
              icon={<FileKindIcon kind={fileKind(download.path)} />}
              key={`running:${download.path}`}
              label={fileName(download.path)}
            >
              <DownloadBar download={download} />
            </ListRow>
          ))}
          {(downloads.completedPaths ?? []).toReversed().map((path) => (
            <ListRow
              detail={`Saved to ${folderName(path)}`}
              end={
                <>
                  <IconButton
                    label="Open"
                    onClick={() => {
                      onOpen(path);
                    }}
                  >
                    <ArrowSquareOutIcon aria-hidden size={14} />
                  </IconButton>
                  <IconButton
                    label="Show in folder"
                    onClick={() => {
                      onShowInFolder(path);
                    }}
                  >
                    <FolderOpenIcon aria-hidden size={14} />
                  </IconButton>
                  <IconButton
                    label="Remove from list"
                    onClick={() => {
                      onRemove(path);
                    }}
                  >
                    <XIcon aria-hidden size={14} />
                  </IconButton>
                </>
              }
              endOnHover
              icon={<FileKindIcon kind={fileKind(path)} />}
              key={`finished:${path}`}
              label={fileName(path)}
            />
          ))}
        </List>
      )}
    </section>
  );
};

/**
 * "Downloading report.pdf" or "Downloading 2 files" while any are in progress,
 * then how many finished.
 */
const title = (downloads: Downloads): string => {
  const only =
    downloads.running?.length === 1 ? downloads.running[0] : undefined;
  if (only !== undefined) {
    return `Downloading ${fileName(only.path)}`;
  } else if (downloads.count === 1) {
    return "Downloading 1 file";
  } else if (downloads.count > 1) {
    return `Downloading ${String(downloads.count)} files`;
  } else if (downloads.completed === 1) {
    return "Download finished";
  } else {
    return `${String(downloads.completed)} downloads finished`;
  }
};

/** How far `download` has come, and how long it has left once known. */
const detail = (
  download: RunningDownload,
  seconds: number | undefined,
): string => {
  const progress = downloadProgress(
    download.receivedBytes,
    download.totalBytes,
  );
  return seconds === undefined
    ? progress
    : `${progress} · ${timeLeft(seconds)}`;
};

/**
 * A thin bar of how far `download` has come. With its size unknown a stretch
 * of it slides, and no amount is claimed.
 */
const DownloadBar = ({ download }: { download: RunningDownload }) => {
  const fraction =
    download.totalBytes === 0
      ? undefined
      : download.receivedBytes / download.totalBytes;
  return (
    <div
      aria-label={fileName(download.path)}
      aria-valuenow={
        fraction === undefined ? undefined : Math.floor(fraction * 100)
      }
      className={barStyles}
      data-size-unknown={fraction === undefined ? "" : undefined}
      role="progressbar"
      style={fraction === undefined ? undefined : barProgressStyle(fraction)}
    />
  );
};

/**
 * Inline style handing `fraction` to `barStyles` as `--download-progress`.
 * Inline because Panda only extracts build-time literals.
 */
const barProgressStyle = (
  fraction: number,
): CSSProperties & Record<`--${string}`, string> => ({
  "--download-progress": String(fraction),
});

/** The file's name, without its folder. */
const fileName = (path: string): string =>
  path.slice(path.lastIndexOf("/") + 1);

const TITLE_ID = "downloads-panel-title";

/** The name of the folder `path` is in. */
const folderName = (path: string): string => {
  const folder = path.slice(0, path.lastIndexOf("/"));
  return folder.slice(folder.lastIndexOf("/") + 1);
};

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

// Wide enough for a long file name beside its buttons.
const panelStyles = vstack({
  alignItems: "stretch",
  gap: 1,
  inlineSize: 80,
  maxInlineSize: "100%",
});

// Fills from the start as it comes in. Of unknown size, it fills and pulses,
// as the address bar's download icon does.
const barStyles = css({
  _before: {
    backgroundColor: "accent",
    borderRadius: "full",
    content: '""',
    inset: 0,
    position: "absolute",
    transform: "scaleX(var(--download-progress))",
    transformOrigin: "left",
    transition: "transform {durations.normal} {easings.out}",
  },
  "&[data-size-unknown]::before": {
    animation: "pulse {durations.pulse} {easings.in-out} infinite",
    transform: "none",
  },
  backgroundColor: "border",
  blockSize: 1,
  borderRadius: "full",
  overflow: "hidden",
  position: "relative",
});
