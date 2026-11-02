// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "third_party/blink/renderer/modules/domicile/domicile_download.h"

namespace blink {

DomicileDownload::DomicileDownload(const String& id,
                                   V8DomicileDownloadState state,
                                   const String& path,
                                   int64_t received_bytes,
                                   int64_t total_bytes,
                                   const String& window,
                                   const String& page)
    : id_(id),
      state_(state),
      path_(path),
      received_bytes_(received_bytes),
      total_bytes_(total_bytes),
      window_(window),
      page_(page) {}

DomicileDownload::~DomicileDownload() = default;

void DomicileDownload::Trace(Visitor* visitor) const {
  ScriptWrappable::Trace(visitor);
}

}  // namespace blink
