// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "components/domicile/browser/desk_downloads.h"

#include <algorithm>

#include "base/files/file_path.h"
#include "base/logging.h"
#include "base/no_destructor.h"
#include "base/notreached.h"
#include "components/domicile/browser/download_list.h"
#include "url/gurl.h"

namespace domicile {

namespace {

DownloadStage StageOf(download::DownloadItem::DownloadState state) {
  switch (state) {
    case download::DownloadItem::IN_PROGRESS:
      return DownloadStage::kInProgress;
    case download::DownloadItem::COMPLETE:
      return DownloadStage::kComplete;
    case download::DownloadItem::INTERRUPTED:
      return DownloadStage::kFailed;
    case download::DownloadItem::CANCELLED:
      return DownloadStage::kCanceled;
    case download::DownloadItem::MAX_DOWNLOAD_STATE:
      NOTREACHED();
  }
}

// The state of a listed download. A canceled one is never listed.
mojom::DownloadState StateOf(DownloadStage stage) {
  switch (stage) {
    case DownloadStage::kInProgress:
      return mojom::DownloadState::kInProgress;
    case DownloadStage::kComplete:
      return mojom::DownloadState::kComplete;
    case DownloadStage::kFailed:
      return mojom::DownloadState::kFailed;
    case DownloadStage::kCanceled:
      NOTREACHED();
  }
}

bool InProgress(const download::DownloadItem& item) {
  return item.GetState() == download::DownloadItem::IN_PROGRESS;
}

}  // namespace

// static
DeskDownloads& DeskDownloads::Get() {
  static base::NoDestructor<DeskDownloads> downloads;
  return *downloads;
}

DeskDownloads::DeskDownloads() = default;
DeskDownloads::~DeskDownloads() = default;

template <typename Predicate>
void DeskDownloads::Drop(Predicate drop) {
  std::erase_if(entries_, [this, &drop](const Entry& entry) {
    if (!drop(*entry.item)) {
      return false;
    }
    observations_.RemoveObservation(entry.item);
    return true;
  });
  Changed();
}

void DeskDownloads::Add(download::DownloadItem* item,
                        const std::string& window) {
  entries_.push_back({item, window});
  observations_.AddObservation(item);
  // Logged for guard-webview-download.sh.
  LOG(INFO) << "domicile: the desk listed a download from browser window \""
            << window << "\".";
  Changed();
}

std::vector<mojom::DownloadPtr> DeskDownloads::List() const {
  std::vector<mojom::DownloadPtr> listed;
  for (const Entry& entry : entries_) {
    const download::DownloadItem& item = *entry.item;
    const DownloadStage stage = StageOf(item.GetState());
    if (!IsListed({.stage = stage,
                   .has_target = !item.GetTargetFilePath().empty()})) {
      continue;
    }
    listed.push_back(mojom::Download::New(
        item.GetGuid(), StateOf(stage), item.GetTargetFilePath().AsUTF8Unsafe(),
        item.GetReceivedBytes(), item.GetTotalBytes(), entry.window,
        item.GetTabUrl()));
  }
  return listed;
}

void DeskDownloads::Cancel(const std::string& id) {
  auto entry = std::ranges::find_if(entries_, [&id](const Entry& entry) {
    return entry.item->GetGuid() == id;
  });
  if (entry != entries_.end() && InProgress(*entry->item)) {
    // Its update drops it.
    entry->item->Cancel(/*user_cancel=*/true);
  }
}

void DeskDownloads::Remove(const std::string& id) {
  Drop([&id](const download::DownloadItem& item) {
    return item.GetGuid() == id && !InProgress(item);
  });
}

void DeskDownloads::Clear() {
  Drop([](const download::DownloadItem& item) { return !InProgress(item); });
}

void DeskDownloads::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void DeskDownloads::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void DeskDownloads::OnDownloadUpdated(download::DownloadItem* item) {
  if (item->GetState() == download::DownloadItem::CANCELLED) {
    // Never listed again, so not kept.
    Drop([item](const download::DownloadItem& listed) {
      return &listed == item;
    });
  } else {
    Changed();
  }
}

void DeskDownloads::OnDownloadDestroyed(download::DownloadItem* item) {
  Drop([item](const download::DownloadItem& listed) {
    return &listed == item;
  });
}

void DeskDownloads::Changed() {
  for (Observer& observer : observers_) {
    observer.OnDownloadsChanged();
  }
}

}  // namespace domicile
