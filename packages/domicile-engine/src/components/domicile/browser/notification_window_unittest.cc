// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/notification_window.h"

#include <string>

#include "base/functional/bind.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace domicile {
namespace {

TEST(NotificationWindowTest, WindowsAreFoundThroughTheFinderOnceSet) {
  EXPECT_EQ(FindNotificationWindow("p#1"), "");

  SetNotificationWindowFinder(
      base::BindRepeating([](const std::string& notification_id) {
        return notification_id == "p#1" ? std::string("7") : std::string();
      }));

  EXPECT_EQ(FindNotificationWindow("p#1"), "7");
  EXPECT_EQ(FindNotificationWindow("p#2"), "");
  SetNotificationWindowFinder(NotificationWindowFinder());
}

}  // namespace
}  // namespace domicile
