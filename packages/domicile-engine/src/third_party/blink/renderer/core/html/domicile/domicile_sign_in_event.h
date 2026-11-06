// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#ifndef THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_SIGN_IN_EVENT_H_
#define THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_SIGN_IN_EVENT_H_

#include "components/domicile/mojom/web_view_guest.mojom-blink.h"
#include "third_party/blink/renderer/core/core_export.h"
#include "third_party/blink/renderer/core/dom/events/event.h"
#include "third_party/blink/renderer/platform/heap/member.h"
#include "third_party/blink/renderer/platform/wtf/text/atomic_string.h"
#include "third_party/blink/renderer/platform/wtf/text/wtf_string.h"

namespace blink {

class ExceptionState;
class HTMLWebViewElement;

// Asks the shell for a user name and password that a site or a proxy asked
// the page inside a <webview> for.
//
// - Carries the browser's reply callback, as DomicileDialogEvent does. The
//   browser expects one answer, so a second throws InvalidStateError.
// - A shell claims it with `preventDefault()`. The element dismisses an
//   unclaimed one after dispatch, so a shell that does not listen signs in
//   nowhere.
// - The element holds it until answered, withdrawn or replaced. Garbage
//   collection would otherwise drop the callback unrun.
class CORE_EXPORT DomicileSignInEvent final : public Event {
  DEFINE_WRAPPERTYPEINFO();

 public:
  using Answer =
      domicile::mojom::blink::WebViewGuestClient::SignInRequestedCallback;

  DomicileSignInEvent(const AtomicString& type,
                      const String& url,
                      const String& realm,
                      bool proxy,
                      bool secure,
                      Answer answer,
                      HTMLWebViewElement& owner);
  ~DomicileSignInEvent() override;

  const String& url() const { return url_; }
  const String& realm() const { return realm_; }
  bool proxy() const { return proxy_; }
  bool secure() const { return secure_; }

  void signIn(const String& username, const String& password, ExceptionState&);
  void dismiss(ExceptionState&);

  // Called by the element for an unclaimed event, a withdrawn one and one a
  // newer request replaced. Cancels.
  void DismissIfUnanswered();

  const AtomicString& InterfaceName() const override;

  void Trace(Visitor*) const override;

 private:
  void Run(bool sign_in, const String& username, const String& password);

  String url_;
  String realm_;
  bool proxy_;
  bool secure_;
  // Null once answered.
  Answer answer_;
  // Notified on answer so it releases this event.
  Member<HTMLWebViewElement> owner_;
};

}  // namespace blink

#endif  // THIRD_PARTY_BLINK_RENDERER_CORE_HTML_DOMICILE_DOMICILE_SIGN_IN_EVENT_H_
