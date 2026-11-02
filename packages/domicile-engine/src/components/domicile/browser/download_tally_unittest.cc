// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/download_tally.h"

#include <string>
#include <vector>

#include "testing/gtest/include/gtest/gtest.h"

namespace domicile {
namespace {

TEST(DownloadTallyTest, NoDownloadsTallyToNothing) {
  EXPECT_EQ(TallyDownloads({}), DownloadTally());
}

TEST(DownloadTallyTest, AddsUpDownloadsInProgress) {
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 10,
       .total_bytes = 100,
       .path = "/home/me/Downloads/a.zip"},
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 5,
       .total_bytes = 50,
       .path = "/home/me/Downloads/b.zip"},
  };
  const DownloadTally tally = TallyDownloads(downloads);
  EXPECT_EQ(tally.count, 2);
  EXPECT_EQ(tally.received_bytes, 15);
  EXPECT_EQ(tally.total_bytes, 150);
}

// The shell lists each one in its download popup, with its own progress.
TEST(DownloadTallyTest, ListsDownloadsInProgressInTheOrderTheyStarted) {
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 10,
       .total_bytes = 100,
       .path = "/home/me/Downloads/a.zip"},
      {.stage = DownloadStage::kComplete,
       .has_target = true,
       .received_bytes = 1,
       .total_bytes = 1,
       .path = "/home/me/Downloads/b.jpg"},
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 5,
       .total_bytes = 0,
       .path = "/home/me/Downloads/c.pdf"},
  };
  EXPECT_EQ(TallyDownloads(downloads).running,
            (std::vector<RunningDownload>{
                {.path = "/home/me/Downloads/a.zip",
                 .received_bytes = 10,
                 .total_bytes = 100},
                {.path = "/home/me/Downloads/c.pdf",
                 .received_bytes = 5,
                 .total_bytes = 0},
            }));
}

TEST(DownloadTallyTest, OneDownloadOfUnknownSizeMakesTheTotalUnknown) {
  // A sum without it would read as nearly done when it is not.
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 10,
       .total_bytes = 100},
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 5,
       .total_bytes = 0},
  };
  const DownloadTally tally = TallyDownloads(downloads);
  EXPECT_EQ(tally.received_bytes, 15);
  EXPECT_EQ(tally.total_bytes, 0);
}

TEST(DownloadTallyTest, CountsFinishedDownloadsApart) {
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kInProgress,
       .has_target = true,
       .received_bytes = 10,
       .total_bytes = 100},
      {.stage = DownloadStage::kComplete,
       .has_target = true,
       .received_bytes = 100,
       .total_bytes = 100,
       .path = "/home/me/Downloads/report.pdf"},
  };
  const DownloadTally tally = TallyDownloads(downloads);
  EXPECT_EQ(tally.count, 1);
  EXPECT_EQ(tally.completed,
            std::vector<std::string>{"/home/me/Downloads/report.pdf"});
}

// The shell names the files in its download popup, the newest last.
TEST(DownloadTallyTest, ListsFinishedDownloadsInTheOrderTheyStarted) {
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kComplete,
       .has_target = true,
       .received_bytes = 1,
       .total_bytes = 1,
       .path = "/home/me/Downloads/a.jpg"},
      {.stage = DownloadStage::kStopped,
       .has_target = true,
       .received_bytes = 1,
       .total_bytes = 1,
       .path = "/home/me/Downloads/b.jpg"},
      {.stage = DownloadStage::kComplete,
       .has_target = true,
       .received_bytes = 1,
       .total_bytes = 1,
       .path = "/home/me/Downloads/c.jpg"},
  };
  EXPECT_EQ(TallyDownloads(downloads).completed,
            (std::vector<std::string>{"/home/me/Downloads/a.jpg",
                                      "/home/me/Downloads/c.jpg"}));
}

// A failed download is neither in progress nor finished.
TEST(DownloadTallyTest, LeavesOutStoppedDownloads) {
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kStopped,
       .has_target = true,
       .received_bytes = 100,
       .total_bytes = 100},
  };
  EXPECT_EQ(TallyDownloads(downloads), DownloadTally());
}

TEST(DownloadTallyTest, LeavesOutDownloadsTheShellHasNotPlaced) {
  // The shell's picker is still open for it; it fetches meanwhile.
  const std::vector<DownloadReading> downloads = {
      {.stage = DownloadStage::kInProgress,
       .has_target = false,
       .received_bytes = 10,
       .total_bytes = 100},
  };
  EXPECT_EQ(TallyDownloads(downloads), DownloadTally());
}

}  // namespace
}  // namespace domicile
