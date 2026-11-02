import { AnimatedCheckIcon } from "@domicile-desktop/component-library/AnimatedCheckIcon";
import { AnimatedCloseIcon } from "@domicile-desktop/component-library/AnimatedCloseIcon";
import { AnimatedDownloadIcon } from "@domicile-desktop/component-library/AnimatedDownloadIcon";
import { Button } from "@domicile-desktop/component-library/Button";
import type { Ref } from "react";

import { hstack } from "../../styled-system/patterns";
import type { Downloads } from "./downloads";

type Props = {
  /** The page's downloads. At least one in progress or finished. */
  downloads: Downloads;
  /** Stops showing the finished downloads. */
  onClear: () => void;
  /** Shows the downloads' popup. */
  onShow: () => void;
  /** The indicator, for the downloads popup to hang from. */
  ref: Ref<HTMLDivElement>;
};

/**
 * A browser window's downloads: how far the ones in progress have come, or,
 * once none are, that some finished, until the user clears them. Pressing it
 * shows them.
 */
export const DownloadIndicator = ({
  downloads,
  onClear,
  onShow,
  ref,
}: Props) =>
  downloads.count === 0 ? (
    <FinishedDownloads
      completed={downloads.completed}
      onClear={onClear}
      onShow={onShow}
      ref={ref}
    />
  ) : (
    <DownloadProgress downloads={downloads} onShow={onShow} ref={ref} />
  );

/**
 * A percentage beside a download icon, which shows the downloads when pressed.
 * With a size unknown the icon pulses and no amount is claimed.
 */
const DownloadProgress = ({
  downloads,
  onShow,
  ref,
}: {
  downloads: Downloads;
  onShow: () => void;
  ref: Ref<HTMLDivElement>;
}) => {
  const percent =
    downloads.totalBytes === 0
      ? undefined
      : Math.floor((downloads.receivedBytes / downloads.totalBytes) * 100);
  const name =
    downloads.count === 1
      ? "Downloading"
      : `Downloading ${String(downloads.count)} files`;

  return (
    <div
      className={indicatorStyles}
      data-size-unknown={percent === undefined ? "" : undefined}
      ref={ref}
    >
      <Button label={name} onClick={onShow} rounded size="xs" variant="ghost">
        <span
          aria-label={name}
          aria-valuenow={percent}
          className={statusStyles}
          role="progressbar"
        >
          <AnimatedDownloadIcon
            cue={downloads.count + downloads.completed}
            size={14}
          />
          {percent === undefined ? undefined : `${String(percent)}%`}
        </span>
      </Button>
    </div>
  );
};

/**
 * A check and how many finished, which shows them when pressed, with a button
 * to clear them.
 */
const FinishedDownloads = ({
  completed,
  onClear,
  onShow,
  ref,
}: {
  completed: number;
  onClear: () => void;
  onShow: () => void;
  ref: Ref<HTMLDivElement>;
}) => (
  <div className={indicatorStyles} data-finished="" ref={ref}>
    <Button
      label={completed === 1 ? "Downloaded" : `${completed} downloaded`}
      onClick={onShow}
      rounded
      size="xs"
      variant="ghost"
    >
      <span className={statusStyles} role="status">
        <AnimatedCheckIcon size={14} />
        {completed === 1 ? "Downloaded" : `${completed} downloaded`}
      </span>
    </Button>
    <Button
      label="Clear finished downloads"
      onClick={onClear}
      rounded
      size="xs"
      variant="ghost"
    >
      <AnimatedCloseIcon size={12} weight="bold" />
    </Button>
  </div>
);

// A capsule like the zoom controls beside it. Fixed-width digits so the bar
// does not shift as the number climbs. Its buttons sit inside its edge.
// Finished, it turns the success color.
const indicatorStyles = hstack({
  "&[data-finished]": {
    color: "success",
  },
  "&[data-size-unknown] svg": {
    animation: "pulse {durations.pulse} {easings.in-out} infinite",
  },
  backgroundColor: "background",
  blockSize: 6,
  border: "1px solid {colors.border}",
  borderRadius: "full",
  color: "accent",
  flex: "none",
  fontSize: "xs",
  fontVariantNumeric: "tabular-nums",
  gap: 1,
  paddingInline: 0.5,
});

const statusStyles = hstack({
  gap: 1,
});
