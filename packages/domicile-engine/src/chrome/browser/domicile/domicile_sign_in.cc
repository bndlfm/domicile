// Copyright 2026 Connor Prussin
// SPDX-License-Identifier: MIT

#include "chrome/browser/domicile/domicile_sign_in.h"

#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/functional/bind.h"
#include "base/logging.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/ui/login/login_handler.h"
#include "components/domicile/browser/web_view_guest.h"
#include "content/public/browser/login_delegate.h"
#include "content/public/browser/web_contents.h"
#include "net/base/auth.h"

namespace domicile {
namespace {

// Chrome's LoginHandler, asking the guest's element in place of the dialog
// that LoginHandlerViews draws.
class ShellLoginHandler : public LoginHandler {
 public:
  ShellLoginHandler(
      const net::AuthChallengeInfo& auth_info,
      content::WebContents* web_contents,
      content::LoginDelegate::LoginAuthRequiredCallback auth_required_callback)
      : LoginHandler(auth_info,
                     web_contents,
                     std::move(auth_required_callback)) {}
  ShellLoginHandler(const ShellLoginHandler&) = delete;
  ShellLoginHandler& operator=(const ShellLoginHandler&) = delete;

  // LoginHandler cannot call CloseDialog: this part is gone by then.
  ~ShellLoginHandler() override { CloseDialog(); }

 protected:
  // LoginHandler. `authority` and `explanation` are Chrome's display strings;
  // the shell gets the parts and words them itself. An empty `explanation`
  // means the connection is private. `login_model_data` is the password
  // manager's, which is not used.
  bool BuildViewImpl(const std::u16string& authority,
                     const std::u16string& explanation,
                     LoginModelData* login_model_data) override {
    WebViewGuest* guest = WebViewGuest::FromWebContents(web_contents());
    if (!guest) {
      LOG(WARNING) << "domicile: a page outside any <webview> asked to sign "
                      "in; it is canceled.";
      return false;
    }
    guest_ = guest->GetWeakPtr();
    asked_ = guest->AskToSignIn(
        auth_info().challenger.GetURL(), auth_info().realm,
        auth_info().is_proxy, explanation.empty(),
        base::BindOnce(&ShellLoginHandler::Answered,
                       weak_factory_.GetWeakPtr()));
    return true;
  }

  void CloseDialog() override {
    if (guest_ && asked_) {
      guest_->WithdrawSignIn(asked_);
    }
    asked_ = 0;
  }

 private:
  void Answered(
      std::optional<std::pair<std::u16string, std::u16string>> credentials) {
    asked_ = 0;
    // Logged for the sign-in guard. Never the user name or password.
    LOG(INFO) << "domicile: a <webview>'s sign-in was answered: "
              << (credentials ? "signed in." : "canceled.");
    // Either may destroy this. A sign-in answers every other request for the
    // same realm, as in Chrome. A cancel is this request's alone, unlike
    // Chrome's: the element cancels a request a newer one replaced, and that
    // must not take the newer one with it.
    if (credentials) {
      SetAuth(credentials->first, credentials->second);
    } else {
      CancelAuth(/*notify_others=*/false);
    }
  }

  base::WeakPtr<WebViewGuest> guest_;
  // The guest's number for the open request, or 0 for none.
  int asked_ = 0;
  base::WeakPtrFactory<ShellLoginHandler> weak_factory_{this};
};

// Chrome's LoginHandler::CreateOverride.
std::unique_ptr<LoginHandler> CreateForTheShell(
    const net::AuthChallengeInfo& auth_info,
    content::WebContents* web_contents,
    content::LoginDelegate::LoginAuthRequiredCallback auth_required_callback) {
  return std::make_unique<ShellLoginHandler>(auth_info, web_contents,
                                             std::move(auth_required_callback));
}

}  // namespace

void UseTheShellForSignIns() {
  LoginHandler::SetCreateOverride(&CreateForTheShell);
}

}  // namespace domicile
