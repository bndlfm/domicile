// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef CHROME_BROWSER_DOMICILE_DOMICILE_POINTER_WARP_H_
#define CHROME_BROWSER_DOMICILE_DOMICILE_POINTER_WARP_H_

#include <optional>

#include "content/public/browser/global_routing_id.h"
#include "ui/gfx/geometry/rect_f.h"

namespace domicile {

// Moves the cursor to `x`,`y` in the coordinates of the page in `frame`,
// unless it is already over `unless_over`, also in the page's coordinates.
//
// The policy is components/domicile/browser/pointer_warp.h, which has the
// tests. This half maps the page to its aura root window, which only //chrome
// has. Whether the pointer moves depends on the platform: the DRM cursor plane
// on a console, and usually nothing when nested in another compositor.
//
// Must be called on the UI thread. `frame` is an id because the request comes
// from the IO thread and the frame may close in the meantime.
void WarpPointerIn(content::GlobalRenderFrameHostId frame,
                   double x,
                   double y,
                   const std::optional<gfx::RectF>& unless_over);

}  // namespace domicile

#endif  // CHROME_BROWSER_DOMICILE_DOMICILE_POINTER_WARP_H_
