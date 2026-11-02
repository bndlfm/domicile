// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/download_list.h"

namespace domicile {

bool IsListed(const DownloadReading& download) {
  switch (download.stage) {
    case DownloadStage::kInProgress:
      return download.has_target;
    case DownloadStage::kComplete:
    case DownloadStage::kFailed:
      return true;
    case DownloadStage::kCanceled:
      return false;
  }
}

}  // namespace domicile
