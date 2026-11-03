---
"@domicile-desktop/engine": minor
"@domicile-desktop/sdk": minor
"@domicile-desktop/manganese-window-management": minor
---

Middle-clicking Back or Forward in a browser window's address bar opens that step in a new window, as Chrome does in a new tab. The new window keeps the page's history, and the window you clicked in stays where it was.

`<webview>` gains `goBackInNewWindow()` and `goForwardInNewWindow()`.
