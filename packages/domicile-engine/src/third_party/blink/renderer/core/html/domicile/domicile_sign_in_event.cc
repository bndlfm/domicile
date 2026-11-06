// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "third_party/blink/renderer/core/html/domicile/domicile_sign_in_event.h"

#include <utility>

#include "third_party/blink/renderer/core/event_interface_names.h"
#include "third_party/blink/renderer/core/html/domicile/html_web_view_element.h"
#include "third_party/blink/renderer/platform/bindings/exception_state.h"

namespace blink {

namespace {

constexpr char kAnswered[] =
    "This request has already been answered or withdrawn.";

}  // namespace

// Bubbles like the element's other events. Cancelable because
// `preventDefault()` claims the request (see the header).
DomicileSignInEvent::DomicileSignInEvent(const AtomicString& type,
                                         const String& url,
                                         const String& realm,
                                         bool proxy,
                                         bool secure,
                                         Answer answer,
                                         HTMLWebViewElement& owner)
    : Event(type, Bubbles::kYes, Cancelable::kYes),
      url_(url),
      realm_(realm),
      proxy_(proxy),
      secure_(secure),
      answer_(std::move(answer)),
      owner_(&owner) {}

DomicileSignInEvent::~DomicileSignInEvent() = default;

void DomicileSignInEvent::signIn(const String& username,
                                 const String& password,
                                 ExceptionState& exception_state) {
  if (!answer_) {
    exception_state.ThrowDOMException(DOMExceptionCode::kInvalidStateError,
                                      kAnswered);
    return;
  }
  Run(true, username, password);
}

void DomicileSignInEvent::dismiss(ExceptionState& exception_state) {
  if (!answer_) {
    exception_state.ThrowDOMException(DOMExceptionCode::kInvalidStateError,
                                      kAnswered);
    return;
  }
  Run(false, g_empty_string, g_empty_string);
}

void DomicileSignInEvent::DismissIfUnanswered() {
  if (answer_) {
    Run(false, g_empty_string, g_empty_string);
  }
}

void DomicileSignInEvent::Run(bool sign_in,
                              const String& username,
                              const String& password) {
  std::move(answer_).Run(sign_in, username, password);
  owner_->SignInAnswered(*this);
  owner_ = nullptr;
}

const AtomicString& DomicileSignInEvent::InterfaceName() const {
  return event_interface_names::kDomicileSignInEvent;
}

void DomicileSignInEvent::Trace(Visitor* visitor) const {
  visitor->Trace(owner_);
  Event::Trace(visitor);
}

}  // namespace blink
