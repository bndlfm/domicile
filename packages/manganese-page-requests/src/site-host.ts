// A site's host, as a dialog names who asks.

/**
 * The host of `origin`, or nothing for a frame with no site (`null`) or
 * no origin (`""`).
 *
 * Uses `URL.parse`, which does not throw, for `ConnectionIndicator`'s reason.
 */
export const hostOf = (origin: string): string | undefined => {
  const parsed = URL.parse(origin);
  return parsed === null || parsed.host === "" ? undefined : parsed.host;
};
