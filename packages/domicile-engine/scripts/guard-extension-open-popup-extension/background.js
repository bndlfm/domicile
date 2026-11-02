// Phantom's tray click, for guard-extension-open-popup.sh. The action names no
// popup, so a click reaches `action.onClicked`. The listener sets the popup,
// calls `action.openPopup()`, and clears the popup again.
//
// A tab whose address has `?bare` is the guard's control: the listener calls
// `action.openPopup()` with no popup set, which Chrome refuses.
//
// The answer goes into the clicked tab's address, which the shell reads:
// `#opened`, `#refused` for Chrome's no-popup error, or `#error-<message>`.
//
// Read from `globalThis` because the linter does not know the `chrome` global.
const { action, tabs } = globalThis.chrome;

const NO_POPUP = "Extension does not have a popup on the active tab.";

action.setPopup({ popup: "" });

action.onClicked.addListener((tab) => {
  const say = (answer) =>
    tabs.update(tab.id, { url: `${tab.url.split("#")[0]}#${answer}` });
  const bare = new URL(tab.url).searchParams.has("bare");
  const set = bare
    ? Promise.resolve()
    : action.setPopup({ popup: "popup.html" });
  set
    .then(() => action.openPopup({ windowId: tab.windowId }))
    .then(
      () => say("opened"),
      (error) =>
        say(
          error.message === NO_POPUP
            ? "refused"
            : `error-${encodeURIComponent(error.message)}`,
        ),
    )
    .finally(() => action.setPopup({ popup: "" }));
});
