---
"@domicile-desktop/sdk": minor
"@domicile-desktop/manganese-window-management": patch
"@domicile-desktop/manganese": patch
"domicile": patch
---

`pointer.warp` takes an `unlessOver` box: the engine leaves the pointer where it is while it is over that box, including over a browser window's page, which the shell cannot see. Manganese passes the newly focused window's frame, so the pointer stays put when it is already on that window.
