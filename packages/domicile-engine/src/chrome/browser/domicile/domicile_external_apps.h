// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef CHROME_BROWSER_DOMICILE_DOMICILE_EXTERNAL_APPS_H_
#define CHROME_BROWSER_DOMICILE_DOMICILE_EXTERNAL_APPS_H_

namespace domicile {

// Links for applications, such as zoommtg: or slack:, asked about by the
// shell.
//
// Chrome asks with a dialog anchored to the outermost WebContents' window,
// which for a <webview> guest is the shell's own: its "Open xdg-open?" was
// drawn over the desktop. This sets Chrome's override (patch 0176) to ask the
// guest's element through ExternalAppRequested (see
// components/domicile/mojom/web_view_guest.mojom).
//
// - Chrome still decides whether to ask: a blocked scheme opens nothing and a
//   remembered one opens at once.
// - Open launches the scheme's default application, as Chrome's dialog does.
// - Remember is Chrome's "Always allow", stored in the profile the same way.
// - A page outside any guest opens nothing.
//
// Called once from StartDesk, before any guest exists.
void UseTheShellForExternalApps();

}  // namespace domicile

#endif  // CHROME_BROWSER_DOMICILE_DOMICILE_EXTERNAL_APPS_H_
