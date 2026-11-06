// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "third_party/blink/renderer/core/html/domicile/domicile_external_app_event.h"

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
DomicileExternalAppEvent::DomicileExternalAppEvent(const AtomicString& type,
                                                   const String& url,
                                                   const String& origin,
                                                   bool may_remember,
                                                   Answer answer,
                                                   HTMLWebViewElement& owner)
    : Event(type, Bubbles::kYes, Cancelable::kYes),
      url_(url),
      origin_(origin),
      may_remember_(may_remember),
      answer_(std::move(answer)),
      owner_(&owner) {}

DomicileExternalAppEvent::~DomicileExternalAppEvent() = default;

// `remember` without `mayRemember` is ignored rather than thrown on: the
// browser would treat it as a bad message and end the shell's renderer.
void DomicileExternalAppEvent::open(bool remember,
                                    ExceptionState& exception_state) {
  if (!answer_) {
    exception_state.ThrowDOMException(DOMExceptionCode::kInvalidStateError,
                                      kAnswered);
    return;
  }
  Run(true, remember && may_remember_);
}

void DomicileExternalAppEvent::dismiss(ExceptionState& exception_state) {
  if (!answer_) {
    exception_state.ThrowDOMException(DOMExceptionCode::kInvalidStateError,
                                      kAnswered);
    return;
  }
  Run(false, false);
}

void DomicileExternalAppEvent::DismissIfUnanswered() {
  if (answer_) {
    Run(false, false);
  }
}

void DomicileExternalAppEvent::Run(bool open, bool remember) {
  std::move(answer_).Run(open, remember);
  owner_->ExternalAppAnswered(*this);
  owner_ = nullptr;
}

const AtomicString& DomicileExternalAppEvent::InterfaceName() const {
  return event_interface_names::kDomicileExternalAppEvent;
}

void DomicileExternalAppEvent::Trace(Visitor* visitor) const {
  visitor->Trace(owner_);
  Event::Trace(visitor);
}

}  // namespace blink
