// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/download_list.h"

#include "testing/gtest/include/gtest/gtest.h"

namespace domicile {
namespace {

TEST(DownloadListTest, ListsADownloadInProgressOnceItHasATarget) {
  EXPECT_TRUE(IsListed(
      {.stage = DownloadStage::kInProgress, .has_target = true}));
}

TEST(DownloadListTest, LeavesOutADownloadTheShellHasNotPlaced) {
  // The shell's picker is still open for it.
  EXPECT_FALSE(IsListed(
      {.stage = DownloadStage::kInProgress, .has_target = false}));
}

TEST(DownloadListTest, ListsFinishedAndFailedDownloads) {
  EXPECT_TRUE(
      IsListed({.stage = DownloadStage::kComplete, .has_target = true}));
  EXPECT_TRUE(IsListed({.stage = DownloadStage::kFailed, .has_target = true}));
}

TEST(DownloadListTest, LeavesOutACanceledDownload) {
  EXPECT_FALSE(
      IsListed({.stage = DownloadStage::kCanceled, .has_target = true}));
  // Canceled in the shell's picker.
  EXPECT_FALSE(
      IsListed({.stage = DownloadStage::kCanceled, .has_target = false}));
}

}  // namespace
}  // namespace domicile
