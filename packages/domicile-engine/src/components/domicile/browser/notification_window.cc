// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/notification_window.h"

#include <utility>

#include "base/no_destructor.h"

namespace domicile {
namespace {

NotificationWindowFinder& Finder() {
  static base::NoDestructor<NotificationWindowFinder> finder;
  return *finder;
}

}  // namespace

void SetNotificationWindowFinder(NotificationWindowFinder find) {
  Finder() = std::move(find);
}

std::string FindNotificationWindow(const std::string& notification_id) {
  return Finder() ? Finder().Run(notification_id) : std::string();
}

}  // namespace domicile
