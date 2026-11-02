// How a download in progress reads in the downloads popup.

/** Decimal units, as the system's file managers count. */
const UNITS = ["B", "kB", "MB", "GB", "TB"] as const;

const NUMBER = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

/** The largest unit `bytes` reaches, as a power of 1000. */
const powerOf = (bytes: number): number =>
  Math.min(
    UNITS.length - 1,
    bytes < 1000 ? 0 : Math.floor(Math.log10(bytes) / 3),
  );

/** `bytes` in the unit at `power`, without the unit. */
const amount = (bytes: number, power: number): string =>
  NUMBER.format(bytes / 1000 ** power);

/**
 * How much of a download came in, such as "4.2 of 18 MB", in the total's unit.
 * `total` is `0` when its size is unknown: "4.2 MB so far".
 */
export const downloadProgress = (received: number, total: number): string => {
  if (total === 0) {
    const power = powerOf(received);
    return `${amount(received, power)} ${UNITS[power]} so far`;
  } else {
    const power = powerOf(total);
    return `${amount(received, power)} of ${amount(total, power)} ${UNITS[power]}`;
  }
};

/** `seconds` left, rounded up to its largest unit, such as "2 minutes left". */
export const timeLeft = (seconds: number): string => {
  const wholeSeconds = Math.ceil(seconds);
  const minutes = Math.ceil(wholeSeconds / 60);
  if (wholeSeconds < 60) {
    return counted(wholeSeconds, "second");
  } else if (minutes < 60) {
    return counted(minutes, "minute");
  } else {
    return counted(Math.ceil(minutes / 60), "hour");
  }
};

const counted = (count: number, unit: string): string =>
  `${count} ${unit}${count === 1 ? "" : "s"} left`;
