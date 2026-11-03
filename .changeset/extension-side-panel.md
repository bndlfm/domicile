---
"@domicile-desktop/engine": patch
"@domicile-desktop/manganese-bar-module-tray": minor
"@domicile-desktop/manganese": patch
"@domicile-desktop/manganese-window-management": patch
"@domicile-desktop/sdk": patch
"domicile": patch
---

An extension's `sidePanel.open()` opens its side panel as a tiled window of its own, with no address bar, so Phantom, which opens in its side panel by default from 26.37, opens again. A popup an extension asks for opens under the icon that was clicked, on that monitor, not on the focused one; the tray state gains `clicked`.
