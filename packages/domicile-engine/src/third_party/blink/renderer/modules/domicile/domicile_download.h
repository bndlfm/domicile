// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef THIRD_PARTY_BLINK_RENDERER_MODULES_DOMICILE_DOMICILE_DOWNLOAD_H_
#define THIRD_PARTY_BLINK_RENDERER_MODULES_DOMICILE_DOMICILE_DOWNLOAD_H_

#include <cstdint>

#include "third_party/blink/renderer/bindings/modules/v8/v8_domicile_download_state.h"
#include "third_party/blink/renderer/modules/modules_export.h"
#include "third_party/blink/renderer/platform/bindings/script_wrappable.h"
#include "third_party/blink/renderer/platform/wtf/text/wtf_string.h"

namespace blink {

// One of the desk's downloads, as the browser listed it.
//
// Immutable, like DomicileBrowserWindow, and for its reason.
class MODULES_EXPORT DomicileDownload final : public ScriptWrappable {
  DEFINE_WRAPPERTYPEINFO();

 public:
  DomicileDownload(const String& id,
                   V8DomicileDownloadState state,
                   const String& path,
                   int64_t received_bytes,
                   int64_t total_bytes,
                   const String& window,
                   const String& page);
  ~DomicileDownload() override;

  const String& id() const { return id_; }
  V8DomicileDownloadState state() const { return state_; }
  const String& path() const { return path_; }
  int64_t receivedBytes() const { return received_bytes_; }
  int64_t totalBytes() const { return total_bytes_; }
  const String& window() const { return window_; }
  const String& page() const { return page_; }

  void Trace(Visitor*) const override;

 private:
  String id_;
  V8DomicileDownloadState state_;
  String path_;
  int64_t received_bytes_;
  int64_t total_bytes_;
  String window_;
  String page_;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_MODULES_DOMICILE_DOMICILE_DOWNLOAD_H_
