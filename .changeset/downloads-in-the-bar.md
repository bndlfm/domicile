---
"@domicile-desktop/engine": minor
"@domicile-desktop/sdk": major
"@domicile-desktop/manganese-bar-module-downloads": minor
"@domicile-desktop/manganese-window-management": minor
"@domicile-desktop/manganese": minor
---

Downloads from every window, browser and app alike, now show in one Downloads item on the bar, shown while there are any. It says how far the downloads in progress have come, and its panel lists each download with where it came from, to cancel, open, show in its folder, or remove. The address bar's downloads chip and the downloads popup over the page are gone.

The engine keeps one list of the desk's downloads, so a download outlives its window. The SDK reads it as `domicile.downloads` (`list`, `cancel`, `remove`, `clear`, and a `change` event); `<webview>`'s per-page download properties, `clearCompletedDownloads`, `removeCompletedDownload` and `downloadschange` are removed.
