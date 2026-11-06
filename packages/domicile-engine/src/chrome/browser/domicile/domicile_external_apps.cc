// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "chrome/browser/domicile/domicile_external_apps.h"

#include <optional>
#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/weak_ptr.h"
#include "base/types/optional_util.h"
#include "chrome/browser/external_protocol/external_protocol_handler.h"
#include "chrome/browser/profiles/profile.h"
#include "components/domicile/browser/web_view_guest.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents.h"
#include "mojo/public/cpp/bindings/message.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace domicile {
namespace {

constexpr char kNotRememberable[] =
    "domicile: a <webview> asked to remember a link for a site that may not "
    "be remembered.";

// Runs as the shell's answer arrives, so a bad one is reported against the
// message that carried it.
void Answered(const GURL& url,
              base::WeakPtr<content::WebContents> contents,
              const std::optional<url::Origin>& origin,
              bool may_remember,
              content::WeakDocumentPtr initiator_document,
              bool open,
              bool remember) {
  if (open && remember && !may_remember) {
    mojo::ReportBadMessage(kNotRememberable);
    return;
  }
  // Logged for the external app guard.
  LOG(INFO) << "domicile: a <webview>'s " << url.GetScheme()
            << ": link was answered: " << (open ? "open" : "not opened")
            << (open && remember ? ", remembered." : ".");
  // The page closed while the shell asked.
  if (!open || !contents) {
    return;
  }
  if (remember) {
    ExternalProtocolHandler::SetBlockState(
        url.GetScheme(), *origin, ExternalProtocolHandler::DONT_BLOCK,
        Profile::FromBrowserContext(contents->GetBrowserContext()));
  }
  ExternalProtocolHandler::LaunchUrlWithoutSecurityCheck(
      url, contents.get(), std::move(initiator_document));
}

// Chrome's ExternalProtocolHandler::DialogOverride.
void AskTheShell(const GURL& url,
                 content::WebContents* web_contents,
                 const std::optional<url::Origin>& initiating_origin,
                 content::WeakDocumentPtr initiator_document) {
  WebViewGuest* guest = WebViewGuest::FromWebContents(web_contents);
  if (!guest) {
    LOG(WARNING) << "domicile: a page outside any <webview> asked to open a "
                 << url.GetScheme() << ": link; it is refused.";
    return;
  }
  const bool may_remember =
      ExternalProtocolHandler::MayRememberAllowDecisionsForThisOrigin(
          base::OptionalToPtr(initiating_origin));
  guest->AskToOpenExternalApp(
      url, initiating_origin, may_remember,
      base::BindOnce(&Answered, url, web_contents->GetWeakPtr(),
                     initiating_origin, may_remember,
                     std::move(initiator_document)));
}

}  // namespace

void UseTheShellForExternalApps() {
  ExternalProtocolHandler::SetDialogOverride(&AskTheShell);
}

}  // namespace domicile
