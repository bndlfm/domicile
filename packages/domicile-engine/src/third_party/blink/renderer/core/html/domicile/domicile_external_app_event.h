// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_EXTERNAL_APP_EVENT_H_
#define THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_EXTERNAL_APP_EVENT_H_

#include "components/domicile/mojom/web_view_guest.mojom-blink.h"
#include "third_party/blink/renderer/core/core_export.h"
#include "third_party/blink/renderer/core/dom/events/event.h"
#include "third_party/blink/renderer/platform/heap/member.h"
#include "third_party/blink/renderer/platform/wtf/text/atomic_string.h"
#include "third_party/blink/renderer/platform/wtf/text/wtf_string.h"

namespace blink {

class ExceptionState;
class HTMLWebViewElement;

// Asks the shell whether to open a link for an application that the page
// inside a <webview> opened.
//
// - Carries the browser's reply callback, as DomicileDialogEvent does. The
//   browser expects one answer, so a second throws InvalidStateError.
// - A shell claims it with `preventDefault()`. The element dismisses an
//   unclaimed one after dispatch, so a shell that does not listen opens
//   nothing.
// - The element holds it until answered or replaced. Garbage collection would
//   otherwise drop the callback unrun.
class CORE_EXPORT DomicileExternalAppEvent final : public Event {
  DEFINE_WRAPPERTYPEINFO();

 public:
  using Answer =
      domicile::mojom::blink::WebViewGuestClient::ExternalAppRequestedCallback;

  DomicileExternalAppEvent(const AtomicString& type,
                           const String& url,
                           const String& origin,
                           bool may_remember,
                           Answer answer,
                           HTMLWebViewElement& owner);
  ~DomicileExternalAppEvent() override;

  const String& url() const { return url_; }
  const String& origin() const { return origin_; }
  bool mayRemember() const { return may_remember_; }

  void open(bool remember, ExceptionState&);
  void dismiss(ExceptionState&);

  // Called by the element for an unclaimed event and for one a newer request
  // replaced. Opens nothing.
  void DismissIfUnanswered();

  const AtomicString& InterfaceName() const override;

  void Trace(Visitor*) const override;

 private:
  void Run(bool open, bool remember);

  String url_;
  String origin_;
  bool may_remember_;
  // Null once answered.
  Answer answer_;
  // Notified on answer so it releases this event.
  Member<HTMLWebViewElement> owner_;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_EXTERNAL_APP_EVENT_H_
