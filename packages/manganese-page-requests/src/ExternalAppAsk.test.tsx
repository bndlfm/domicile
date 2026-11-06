import { describe, expect, it } from "bun:test";
import type { Option } from "@cprussin/option-result";
import { None, Some } from "@cprussin/option-result";
import type { DescribedApp } from "@domicile-desktop/system-apps/describe-apps";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExternalAppAsk } from "./ExternalAppAsk";
import type { ExternalAppRequest } from "./useExternalAppRequest";

const ZOOM: DescribedApp = { icon: undefined, id: "zoom", name: "Zoom" };

/** A request from zoom.us, recording its answers. */
const requestFor = (
  answers: string[],
  { mayRemember = true, origin = "https://zoom.us" } = {},
): ExternalAppRequest => ({
  dismiss: () => {
    answers.push("dismiss");
  },
  mayRemember,
  open: (remember) => {
    answers.push(`open ${String(remember)}`);
  },
  origin,
  url: "zoommtg://zoom.us/join?confno=1",
});

const ask = (
  request: ExternalAppRequest,
  app: Option<DescribedApp> = Some(ZOOM),
) => render(<ExternalAppAsk app={app} request={request} />);

const button = (name: string): HTMLElement =>
  screen.getByRole("button", { name });

describe("ExternalAppAsk", () => {
  describe("rendering", () => {
    it("asks to open the app, naming the site", () => {
      ask(requestFor([]));

      const dialog = screen.getByRole("alertdialog", { name: "Open Zoom?" });
      expect(dialog).toHaveAccessibleDescription(
        "zoom.us wants to open this link in Zoom.",
      );
    });

    it("shows the link", () => {
      ask(requestFor([]));

      expect(
        screen.getByText("zoommtg://zoom.us/join?confno=1"),
      ).toBeInTheDocument();
    });

    it("names the page for a link no site opened", () => {
      ask(requestFor([], { origin: "" }));

      expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
        "This page wants to open this link in Zoom.",
      );
    });

    it("offers to always allow the site", () => {
      ask(requestFor([]));

      expect(
        screen.getByRole("switch", {
          name: "Always let zoom.us open these links in Zoom",
        }),
      ).not.toBeChecked();
    });

    it("offers no remembering for a site that may not be remembered", () => {
      ask(requestFor([], { mayRemember: false }));

      expect(screen.queryByRole("switch")).toBeNull();
    });

    it("says when no app opens the link, with only Close", () => {
      ask(requestFor([]), None());

      expect(
        screen.getByRole("alertdialog", { name: "No app opens this link" }),
      ).toHaveAccessibleDescription(
        "Nothing on this computer opens zoommtg links.",
      );
      expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
        "Close",
      ]);
    });
  });

  describe("answers", () => {
    it("opens the app", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.click(button("Open Zoom"));

      expect(answers).toStrictEqual(["open false"]);
    });

    it("opens the app and remembers with the switch on", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.click(screen.getByRole("switch"));
      await userEvent.click(button("Open Zoom"));

      expect(answers).toStrictEqual(["open true"]);
    });

    it("cancels", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      await userEvent.click(button("Cancel"));

      expect(answers).toStrictEqual(["dismiss"]);
    });

    it("cancels with Escape", async () => {
      const answers: string[] = [];
      ask(requestFor(answers));

      button("Open Zoom").focus();
      await userEvent.keyboard("{Escape}");

      expect(answers).toStrictEqual(["dismiss"]);
    });

    it("closes when no app opens the link", async () => {
      const answers: string[] = [];
      ask(requestFor(answers), None());

      await userEvent.click(button("Close"));

      expect(answers).toStrictEqual(["dismiss"]);
    });
  });
});
