// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef CHROME_BROWSER_DOMICILE_DOMICILE_DOWNLOADS_H_
#define CHROME_BROWSER_DOMICILE_DOMICILE_DOWNLOADS_H_

#include "components/domicile/mojom/downloads.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"

namespace content {
class RenderFrameHost;
}  // namespace content

namespace domicile {

// Binds Downloads for `frame`: the desk's downloads, from DeskDownloads. See
// components/domicile/mojom/downloads.mojom.
//
// This function does no access control. PopulateChromeFrameBinders registers
// it only for the shell's origin.
void BindDownloads(content::RenderFrameHost* frame,
                   mojo::PendingReceiver<mojom::Downloads> receiver);

}  // namespace domicile

#endif  // CHROME_BROWSER_DOMICILE_DOMICILE_DOWNLOADS_H_
