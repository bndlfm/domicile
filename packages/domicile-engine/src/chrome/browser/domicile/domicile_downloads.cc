// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "chrome/browser/domicile/domicile_downloads.h"

#include <string>
#include <utility>

#include "base/memory/self_deleting.h"
#include "base/scoped_observation.h"
#include "components/domicile/browser/desk_downloads.h"
#include "content/public/browser/document_service.h"
#include "content/public/browser/render_frame_host.h"
#include "mojo/public/cpp/bindings/remote.h"

namespace domicile {

namespace {

// The desk's downloads for one shell document. A DocumentService like
// CastSinks, so a reloaded shell binds a new one and gets the list again.
class DownloadsService final : public content::DocumentService<mojom::Downloads>,
                               public DeskDownloads::Observer {
 public:
  DownloadsService(content::RenderFrameHost& frame,
                   mojo::PendingReceiver<mojom::Downloads> receiver,
                   base::SelfDeletingPassKey key)
      : DocumentService(frame, std::move(receiver), key) {}

 private:
  ~DownloadsService() override = default;

  // mojom::Downloads:
  void SetClient(mojo::PendingRemote<mojom::DownloadsClient> client) override {
    if (client_.is_bound()) {
      ReportBadMessageAndDeleteThis(
          "domicile: the downloads have one client per document.");
      return;
    }
    client_.Bind(std::move(client));
    observation_.Observe(&DeskDownloads::Get());
    OnDownloadsChanged();
  }

  void Cancel(const std::string& id) override {
    DeskDownloads::Get().Cancel(id);
  }

  void Remove(const std::string& id) override {
    DeskDownloads::Get().Remove(id);
  }

  void Clear() override { DeskDownloads::Get().Clear(); }

  // DeskDownloads::Observer:
  void OnDownloadsChanged() override {
    client_->DownloadsChanged(DeskDownloads::Get().List());
  }

  mojo::Remote<mojom::DownloadsClient> client_;
  base::ScopedObservation<DeskDownloads, DeskDownloads::Observer>
      observation_{this};
};

}  // namespace

void BindDownloads(content::RenderFrameHost* frame,
                   mojo::PendingReceiver<mojom::Downloads> receiver) {
  // Owns itself and dies with the document, like every DocumentService.
  base::MakeSelfDeleting<DownloadsService>(*frame, std::move(receiver));
}

}  // namespace domicile
