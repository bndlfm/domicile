// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef COMPONENTS_DOMICILE_BROWSER_DESK_DOWNLOADS_H_
#define COMPONENTS_DOMICILE_BROWSER_DESK_DOWNLOADS_H_

#include <string>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/observer_list.h"
#include "base/observer_list_types.h"
#include "base/scoped_multi_source_observation.h"
#include "components/domicile/mojom/downloads.mojom.h"
#include "components/download/public/common/download_item.h"

namespace domicile {

// The desk's downloads, across profiles, kept after the window that started
// each closes. See components/domicile/mojom/downloads.mojom.
//
// WebViewGuest adds each download its page starts. A DownloadItem is the
// profile's, and lives until the profile goes, so an entry outlives its page.
class DeskDownloads final : public download::DownloadItem::Observer {
 public:
  // A shell document listening.
  class Observer : public base::CheckedObserver {
   public:
    virtual void OnDownloadsChanged() = 0;
  };

  static DeskDownloads& Get();

  DeskDownloads();
  DeskDownloads(const DeskDownloads&) = delete;
  DeskDownloads& operator=(const DeskDownloads&) = delete;
  ~DeskDownloads() override;

  // Lists `item`, which the page of browser window `window` started. `window`
  // is empty for a <webview> that is not a browser window.
  void Add(download::DownloadItem* item, const std::string& window);

  // The listed downloads, oldest first. See IsListed in download_list.h.
  std::vector<mojom::DownloadPtr> List() const;

  // See mojom::Downloads.
  void Cancel(const std::string& id);
  void Remove(const std::string& id);
  void Clear();

  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

 private:
  struct Entry {
    raw_ptr<download::DownloadItem> item;
    std::string window;
  };

  // download::DownloadItem::Observer:
  void OnDownloadUpdated(download::DownloadItem* item) override;
  void OnDownloadDestroyed(download::DownloadItem* item) override;

  // Stops listing the entries `drop` picks, and tells the observers.
  template <typename Predicate>
  void Drop(Predicate drop);

  void Changed();

  std::vector<Entry> entries_;
  base::ScopedMultiSourceObservation<download::DownloadItem,
                                     download::DownloadItem::Observer>
      observations_{this};
  base::ObserverList<Observer> observers_;
};

}  // namespace domicile

#endif  // COMPONENTS_DOMICILE_BROWSER_DESK_DOWNLOADS_H_
