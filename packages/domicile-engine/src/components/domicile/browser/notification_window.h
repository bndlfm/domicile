// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef COMPONENTS_DOMICILE_BROWSER_NOTIFICATION_WINDOW_H_
#define COMPONENTS_DOMICILE_BROWSER_NOTIFICATION_WINDOW_H_

#include <string>

#include "base/functional/callback.h"

namespace domicile {

// Finds the id of the browser window whose page showed non-persistent
// notification `notification_id`, or empty when no browser window's did.
using NotificationWindowFinder = base::RepeatingCallback<std::string(
    const std::string& notification_id)>;

// Set once by //chrome, which owns the browser windows (see
// chrome/browser/domicile/domicile_browser_windows.h). Chrome's Linux
// notification bridge asks it. UI thread only.
void SetNotificationWindowFinder(NotificationWindowFinder find);

// The browser window non-persistent notification `notification_id` came
// from. Empty when none did, or before //chrome sets the finder.
std::string FindNotificationWindow(const std::string& notification_id);

}  // namespace domicile

#endif  // COMPONENTS_DOMICILE_BROWSER_NOTIFICATION_WINDOW_H_
