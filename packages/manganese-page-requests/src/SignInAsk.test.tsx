import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SignInAsk } from "./SignInAsk";
import type { SignInRequest } from "./useSignInRequest";

/** A request from router.home, recording its answers. */
const requestFor = (
  answers: string[],
  { proxy = false, secure = true, url = "https://router.home/" } = {},
): SignInRequest => ({
  dismiss: () => {
    answers.push("dismiss");
  },
  proxy,
  realm: "Router",
  secure,
  signIn: (username, password) => {
    answers.push(`sign in ${username} ${password}`);
  },
  url,
});

const ask = (request: SignInRequest) => render(<SignInAsk request={request} />);

describe("SignInAsk", () => {
  describe("rendering", () => {
    it("asks to sign in to the site", () => {
      ask(requestFor([]));

      const dialog = screen.getByRole("alertdialog", {
        name: "Sign in to router.home",
      });
      expect(dialog).toHaveAccessibleDescription(
        "This site needs a username and password.",
      );
    });

    it("says when the connection is not private", () => {
      ask(requestFor([], { secure: false, url: "http://router.home/" }));

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "This site needs a username and password. Your connection to it is not private.",
      );
    });

    it("names the proxy when a proxy asks", () => {
      ask(requestFor([], { proxy: true, url: "http://proxy.corp:3128/" }));

      const dialog = screen.getByRole("alertdialog", {
        name: "Sign in to your network's proxy",
      });
      expect(dialog).toHaveAccessibleDescription(
        "The proxy at proxy.corp:3128 needs a username and password.",
      );
    });

    it("hides the password", () => {
      ask(requestFor([]));

      expect(screen.getByLabelText("Password")).toHaveAttribute(
        "type",
        "password",
      );
    });

    it("does not show the server's realm", () => {
      ask(requestFor([]));

      expect(screen.queryByText(/Router/u)).not.toBeInTheDocument();
    });
  });

  describe("answering", () => {
    it("signs in with what was typed", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.type(screen.getByLabelText("Username"), "admin");
      await userEvent.type(screen.getByLabelText("Password"), "hunter2");
      await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

      expect(answers).toStrictEqual(["sign in admin hunter2"]);
    });

    it("signs in on Enter", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.type(screen.getByLabelText("Username"), "admin");
      await userEvent.type(screen.getByLabelText("Password"), "hunter2{Enter}");

      expect(answers).toStrictEqual(["sign in admin hunter2"]);
    });

    it("cancels", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(answers).toStrictEqual(["dismiss"]);
    });

    it("cancels on Escape", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.type(screen.getByLabelText("Username"), "{Escape}");

      expect(answers).toStrictEqual(["dismiss"]);
    });
  });
});
