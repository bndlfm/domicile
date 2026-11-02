---
"@domicile-desktop/engine": patch
"@domicile-desktop/sdk": minor
"@domicile-desktop/manganese-bar-module-tray": patch
"@domicile-desktop/manganese": patch
"domicile": patch
---

An extension's `action.openPopup()` opens its popup in the tray, so Phantom's tray button opens Phantom. The SDK reports the request as `extensions.on("popup")`.
