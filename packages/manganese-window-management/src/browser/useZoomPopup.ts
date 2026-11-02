import { useCallback, useState } from "react";

type Shown = {
  /** Counts each showing, so a popup shown again restarts its time. */
  cue: number;
  open: boolean;
};

/**
 * A browser window's zoom popup, as Chrome's zoom bubble: shown on each zoom,
 * and never back by itself once closed.
 *
 * Closes when the window goes out of view (`inView`: focused, no tab covering
 * it), so it never sits over another window.
 */
export const useZoomPopup = (
  inView: boolean,
): Shown & {
  /** Closes the popup shown for `cue`, unless it has been shown again. */
  close: (cue: number) => void;
  show: () => void;
} => {
  const [shown, setShown] = useState<Shown>({ cue: 0, open: false });
  const [wasInView, setWasInView] = useState(inView);

  // Adjusts state during render rather than in an effect, so the popup closes
  // in the same render as the window leaves view.
  if (inView !== wasInView) {
    setWasInView(inView);
    if (!inView) {
      setShown({ cue: shown.cue + 1, open: false });
    }
  }

  const show = useCallback(() => {
    setShown((current) => ({ cue: current.cue + 1, open: true }));
  }, []);
  const close = useCallback((cue: number) => {
    setShown((current) =>
      current.cue === cue ? { cue, open: false } : current,
    );
  }, []);

  return { ...shown, close, show };
};
