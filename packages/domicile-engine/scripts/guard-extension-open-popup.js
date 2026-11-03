// The shell guard-extension-open-popup.sh and guard-extension-side-panel.sh
// drive: one focused browser window, and a click on the fixture's action once
// its service worker has cleared the action's popup.
//
// Console output, which the engine writes to its log:
//
//   GUARD listening              a listener is registered (harness check)
//   GUARD tray id=… popup=…      the fixture's row, each time one arrives
//   GUARD page url=…             the browser window's page, and the answer the
//                                fixture writes into its address
//   GUARD activated              this page clicked the fixture's action
//   GUARD popup id=… popup=…     an `extensionpopuprequested` arrived
//   GUARD window url=… size=…    a popup window was listed, as a side panel
//                                opens; it is drawn, so its page loads
//
// The engine's document calls `HostShell` once the module loads.

export const HostShell = (_root, desktop) => {
  const say = (what) => {
    console.log(`GUARD ${what}`);
  };

  /**
   * Reads a required query parameter. No default, so a misconfigured guard
   * fails instead of measuring the wrong thing.
   */
  const required = (parameters, name) => {
    const value = parameters.get(name);
    if (value === null) {
      throw new Error(`guard-extension-open-popup: ?${name}= is required`);
    } else {
      return value;
    }
  };

  const host = desktop;
  if (host === null || host === undefined) {
    throw new Error(
      "guard-extension-open-popup: no desktop was handed to Shell, so this" +
        " document was not served by the forked engine",
    );
  }

  const parameters = new URLSearchParams(location.search);
  const expected = required(parameters, "expect");
  const address = required(parameters, "a");

  // Delay between focusing and clicking: focus and the click reach the
  // browser over different pipes, so they can arrive out of order.
  const SETTLE_MS = 1000;

  let focused = false;
  let cleared = false;
  let activated = false;
  const activateOnceReady = () => {
    if (focused && cleared && !activated) {
      activated = true;
      setTimeout(() => {
        host.activateExtension(expected);
        say("activated");
      }, SETTLE_MS);
    }
  };

  host.addEventListener("extensionpopuprequested", (event) => {
    say(`popup id=${event.extensionId} popup=${event.popup}`);
  });

  const drawn = new Set();
  host.addEventListener("browserwindowschanged", () => {
    for (const window of host.browserWindows ?? []) {
      if (window.popupWindow !== null && !drawn.has(window.id)) {
        drawn.add(window.id);
        say(`window url=${window.url} size=${window.width}x${window.height}`);
        const tab = document.createElement("webview");
        tab.style.position = "absolute";
        tab.style.inset = "60% 10% 10% 10%";
        tab.setAttribute("window", window.id);
        document.body.append(tab);
      }
    }
  });

  host.addEventListener("extensionschanged", () => {
    const row = host.extensions.find((extension) => extension.id === expected);
    if (row !== undefined) {
      say(`tray id=${row.id} popup=${row.popup}`);
      if (row.popup === null) {
        cleared = true;
        activateOnceReady();
      }
    }
  });

  const view = document.createElement("webview");
  view.style.position = "absolute";
  view.style.inset = "10%";
  view.style.border = "0";
  view.addEventListener("domicile-page-change", () => {
    say(`page url=${view.url}`);
    if (!focused) {
      focused = true;
      view.focus();
      activateOnceReady();
    }
  });
  // `src` last: it is what asks for a guest, and the element needs a frame
  // first.
  document.body.append(view);
  view.setAttribute("src", address);
  say("listening");
};
