// Shell for guard-webview-history-new-window.sh: one view navigated to two
// pages, then a step back in a new window, drawn in a second view.
//
// A module, because the engine writes the shell document and loads one module
// (see ShellURLLoaderFactory::ShellDocument). Loaded on a domicile:// page, the
// only origin WebViewGuestHost is bound for.
//
// ?drive=new-window calls goBackInNewWindow(). ?drive=back is the control: it
// calls goBack() on the same view after the same navigations. A window opened
// for any back, or a first view that moves anyway, shows up there.
//
// The second view is drawn for each window the desk lists, as a shell would.
// This document's own `<webview src>` is in no list, so every listed window is
// one the call opened.
//
// Logs to the console, which the engine writes to its log:
//
//   GUARD driving mode=…          the module ran, and which run this is
//   GUARD calling …               the call under test
//   GUARD new-window url=…        a listed window's address, on each change
//   GUARD second-view             the shell drew it in a second <webview>
//   GUARD second-page path=… can=…/…   what the second view shows, with its
//                                 canGoBack/canGoForward once settled
//   GUARD first-page path=…       where the first view is once the call settled
//   GUARD done                    the schedule finished
//
// Domicile calls `HostShell` once the module loads.

export const HostShell = (_root, desktop) => {
  /**
   * Reads a required query parameter. No default, so a misconfigured run fails.
   */
  const required = (parameters, name) => {
    const value = parameters.get(name);
    if (value === null) {
      throw new Error(
        `guard-webview-history-new-window: ?${name}= is required`,
      );
    } else {
      return value;
    }
  };

  /**
   * Reads a required millisecond query parameter. Throws rather than return NaN.
   */
  const requiredMilliseconds = (parameters, name) => {
    const value = Number(required(parameters, name));
    if (Number.isFinite(value)) {
      return value;
    } else {
      throw new Error(
        `guard-webview-history-new-window: ?${name}= is a number of ms`,
      );
    }
  };

  /** The call under test, or the control's. */
  const callFor = (mode) => {
    switch (mode) {
      case "new-window": {
        return { name: "goBackInNewWindow", run: (v) => v.goBackInNewWindow() };
      }
      case "back": {
        return { name: "goBack", run: (v) => v.goBack() };
      }
      default: {
        throw new Error(
          `guard-webview-history-new-window: ?drive= is "new-window" or "back", got "${mode}"`,
        );
      }
    }
  };

  const say = (what) => {
    console.log(`GUARD ${what}`);
  };

  if (desktop === null || desktop === undefined) {
    throw new Error(
      "guard-webview-history-new-window: no desktop was handed to Shell, so" +
        " this document is not a shell the engine serves",
    );
  }

  const parameters = new URLSearchParams(location.search);
  const base = required(parameters, "src");
  const mode = required(parameters, "drive");
  const call = callFor(mode);
  // Timeout for the first page to attach and navigate.
  const settle = requiredMilliseconds(parameters, "settle");
  // Timeout for each later step, and how long the run watches after the call,
  // since the control checks for absences.
  const step = requiredMilliseconds(parameters, "step");

  const POLL_MS = 50;

  /**
   * A <webview> filling the window. An explicit size: a replaced element with
   * `auto` size takes its intrinsic 300x150.
   */
  const viewFilling = () => {
    const view = document.createElement("webview");
    view.style.position = "absolute";
    view.style.inset = "0";
    view.style.inlineSize = "100%";
    view.style.blockSize = "100%";
    view.style.border = "0";
    return view;
  };

  // A view's path, or "" before the element reports a URL (`new URL("")`
  // throws).
  const pathOf = (view) => {
    const url = view.url ?? "";
    return url === "" ? "" : new URL(url).pathname;
  };

  // Resolves once `ready()` holds, or once `within` ms have passed regardless.
  const until = (ready, within) =>
    new Promise((resolve) => {
      const deadline = Date.now() + within;
      const poll = () => {
        if (ready() || Date.now() >= deadline) {
          resolve();
        } else {
          setTimeout(poll, POLL_MS);
        }
      };
      poll();
    });

  const pause = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  // Each listed window's last reported address. A window is listed before its
  // first navigation commits, so its address can arrive in a later change.
  const reported = new Map();
  desktop.addEventListener("browserwindowschanged", () => {
    for (const window of desktop.browserWindows ?? []) {
      if (reported.get(window.id) !== window.url) {
        say(`new-window url=${window.url}`);
      }
      if (!reported.has(window.id)) {
        // Set `window` before attaching: the element requests its page then.
        const opened = viewFilling();
        opened.setAttribute("window", window.id);
        // The history state settles after the page shows, so it is read once
        // the page stops loading, with time for the report to cross.
        opened.addEventListener("domicile-page-change", () => {
          until(() => !opened.loading, step)
            .then(() => pause(POLL_MS * 4))
            .then(() => {
              say(
                `second-page path=${pathOf(opened)}` +
                  ` can=${opened.canGoBack}/${opened.canGoForward}`,
              );
            })
            .catch((error) => {
              say(`failed ${error}`);
            });
        });
        document.body.append(opened);
        say("second-view");
      }
      reported.set(window.id, window.url);
    }
  });

  const view = viewFilling();

  const shows = (path) => () => pathOf(view) === path && !view.loading;

  const navigate = async (path, within) => {
    view.setAttribute("src", `${base}${path}`);
    await until(shows(path), within);
  };

  const run = async () => {
    say(`driving mode=${mode}`);
    // Attach before navigating: `src` requests the guest, which needs a frame.
    document.body.append(view);
    await navigate("/one", settle);
    await navigate("/two", step);
    await until(() => view.canGoBack, step);

    say(`calling ${call.name}`);
    call.run(view);
    // A fixed wait, not a poll: the control checks for absences.
    await pause(step);

    say(`first-page path=${pathOf(view)}`);
    say("done");
  };

  run().catch((error) => {
    say(`failed ${error}`);
  });
};
