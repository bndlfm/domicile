// The shell module guard-notification-window.sh loads.
//
// `?leg=window&site=<origin>` opens an app window at `<site>/notify`, a page
// that notifies, and draws every browser window the desk lists in a
// `<webview window>`. `?leg=shell` notifies from the shell itself: the control,
// a notification no browser window's page sent.
//
// It must be a domicile:// document: the browser binds WebViewGuestHost only
// for the shell's origin.
//
// Console output, which the engine writes to its log:
//
//   GUARD window id=…   a listed browser window
//   GUARD notified      the shell notified (the control)
//
// The engine's document calls `HostShell` once the module loads.

export const HostShell = (_root, desktop) => {
  const query = new URLSearchParams(location.search);

  if (query.get("leg") === "shell") {
    new Notification("from-the-shell");
    console.log("GUARD notified");
    return;
  }

  // What was drawn, so each window is drawn and logged once.
  const drawn = new Set();
  desktop.addEventListener("browserwindowschanged", () => {
    for (const window of desktop.browserWindows ?? []) {
      if (!drawn.has(window.id)) {
        drawn.add(window.id);
        // An explicit size: a replaced element with `auto` size takes its
        // intrinsic 300x150. `window` is set before attaching, since the
        // element reads it once, on asking for a guest.
        const view = document.createElement("webview");
        view.style.inlineSize = "320px";
        view.style.blockSize = "200px";
        view.setAttribute("window", window.id);
        document.body.append(view);
        console.log(`GUARD window id=${window.id}`);
      }
    }
  });

  desktop.openAppWindow(
    `${query.get("site")}/notify?summary=from-a-window`,
    "guard-app",
    "new",
  );
};
