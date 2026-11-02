// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef CHROME_BROWSER_DOMICILE_DOMICILE_EXTENSION_TRAY_H_
#define CHROME_BROWSER_DOMICILE_DOMICILE_EXTENSION_TRAY_H_

#include <string>

#include "components/domicile/mojom/extension_tray.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"

class GURL;

namespace content {
class BrowserContext;
class RenderFrameHost;
}  // namespace content

namespace domicile {

// Binds ExtensionTray for `frame`. Sends the profile's extension actions on
// bind and on every change, and handles clicks the way the toolbar does
// (activeTab grant, then onClicked if there is no popup).
//
// This function does no access control. PopulateChromeFrameBinders registers
// it only for domicile:// documents, so an extension page cannot click another
// extension's action. Entry formatting is in
// //components/domicile:extension_tray_entry, which has the tests.
void BindExtensionTray(content::RenderFrameHost* frame,
                       mojo::PendingReceiver<mojom::ExtensionTray> receiver);

// Asks every shell document of `context` with a tray client to open extension
// `id`'s `popup`, for `action.openPopup()`. Returns false if there is none.
bool RequestExtensionPopup(content::BrowserContext* context,
                           const std::string& id,
                           const GURL& popup);

}  // namespace domicile

#endif  // CHROME_BROWSER_DOMICILE_DOMICILE_EXTENSION_TRAY_H_
