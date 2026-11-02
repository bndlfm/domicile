---
"@domicile-desktop/engine": minor
"@domicile-desktop/sdk": minor
"@domicile-desktop/manganese-window-management": minor
---

A browser window's downloads popup lists downloads in progress above the finished ones, each with a progress bar, how much came in, time left, and Cancel. It opens when a download starts and again when it finishes, and pressing the address bar's progress chip opens it. The `<webview>` element lists its downloads in progress one by one (`downloadRunningPaths`, `downloadRunningReceivedBytes`, `downloadRunningTotalBytes`) and can cancel one (`cancelDownload`).
