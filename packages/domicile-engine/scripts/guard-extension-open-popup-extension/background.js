// Phantom's tray click, for guard-extension-open-popup.sh and
// guard-extension-side-panel.sh. The action names no popup, so a click reaches
// `action.onClicked`. What the listener does depends on the clicked tab's
// address:
//
// - `?ask`: sets the popup, calls `action.openPopup()`, and clears the popup
//   again, as Phantom does for its popup.
// - `?bare`: calls `action.openPopup()` with no popup set, which Chrome
//   refuses. The open-popup guard's control.
// - `?panel`: calls `sidePanel.open()`, as Phantom does for its side panel,
//   its default from 26.37.
// - `?nopanel`: turns the side panel off, then calls `sidePanel.open()`, which
//   Chrome refuses. The side panel guard's control.
//
// The answer goes into the clicked tab's address, which the shell reads:
// `#opened`, `#refused` for Chrome's error, or `#error-<message>`.
//
// Read from `globalThis` because the linter does not know the `chrome` global.
const { action, sidePanel, tabs } = globalThis.chrome;

const NO_POPUP = "Extension does not have a popup on the active tab.";
const NO_PANEL = "No active side panel for windowId: ";

action.setPopup({ popup: "" });

/** The call each address makes, and the start of the error that refuses it. */
const call = (mode, tab) => {
  switch (mode) {
    case "panel":
      return [() => sidePanel.open({ windowId: tab.windowId }), NO_PANEL];
    case "nopanel":
      return [
        () =>
          sidePanel
            .setOptions({ enabled: false })
            .then(() => sidePanel.open({ windowId: tab.windowId })),
        NO_PANEL,
      ];
    case "bare":
      return [() => action.openPopup({ windowId: tab.windowId }), NO_POPUP];
    default:
      return [
        () =>
          action
            .setPopup({ popup: "popup.html" })
            .then(() => action.openPopup({ windowId: tab.windowId })),
        NO_POPUP,
      ];
  }
};

action.onClicked.addListener((tab) => {
  const say = (answer) =>
    tabs.update(tab.id, { url: `${tab.url.split("#")[0]}#${answer}` });
  const mode = new URL(tab.url).search.slice(1);
  const [open, refusal] = call(mode, tab);
  open()
    .then(
      () => say("opened"),
      (error) =>
        say(
          error.message.startsWith(refusal)
            ? "refused"
            : `error-${encodeURIComponent(error.message)}`,
        ),
    )
    .finally(() => action.setPopup({ popup: "" }));
});
