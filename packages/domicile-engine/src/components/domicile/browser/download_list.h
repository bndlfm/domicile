// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef COMPONENTS_DOMICILE_BROWSER_DOWNLOAD_LIST_H_
#define COMPONENTS_DOMICILE_BROWSER_DOWNLOAD_LIST_H_

namespace domicile {

// Where a download is, from its DownloadItem's state.
enum class DownloadStage {
  kInProgress,
  kComplete,
  // Interrupted: the network or the disk failed it.
  kFailed,
  // Canceled by the shell, its picker or the person.
  kCanceled,
};

// One download, as DeskDownloads reads it off its DownloadItem.
struct DownloadReading {
  DownloadStage stage;
  // Whether the shell has said where it goes. Until then the shell's picker is
  // open.
  bool has_target;
};

// Whether the shell lists a download: one in progress once the shell has said
// where it goes, and one that finished or failed. A canceled one is gone.
bool IsListed(const DownloadReading& download);

}  // namespace domicile

#endif  // COMPONENTS_DOMICILE_BROWSER_DOWNLOAD_LIST_H_
