import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FIXED } from "../copy/strings";
import { parseSwitcherUrl } from "../logic/switcher";
import { SwitcherLink } from "./SwitcherLink";

function renderFor(raw: unknown) {
  return render(<SwitcherLink href={parseSwitcherUrl(raw)} />);
}

describe("SwitcherLink with parseSwitcherUrl", () => {
  it.each([
    ["https://example.test/dcc"],
    ["http://example.test/dcc"],
    ["/dead-circuit-check/"],
  ])("renders an anchor for valid value %s", (value) => {
    renderFor(value);
    const link = screen.getByRole("link", { name: FIXED.switcherLinkText });
    expect(link.getAttribute("href")).toBe(value);
    expect(link.textContent).toBe("Dead Circuit Check");
  });

  it("accepts a value of exactly 2048 characters", () => {
    const value = "https://" + "a".repeat(2048 - "https://".length);
    renderFor(value);
    expect(screen.getByRole("link").getAttribute("href")).toBe(value);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace only", "   "],
    ["leading whitespace", " https://example.test"],
    ["over-length", "https://" + "a".repeat(2049 - "https://".length)],
    ["wrong prefix ftp", "ftp://example.test"],
    ["wrong prefix javascript", "javascript:alert(1)"],
    ["wrong prefix bare host", "example.test/app"],
    ["wrong prefix relative", "app/"],
    ["non-string", 42],
  ])("renders nothing for %s", (_label, value) => {
    const { container } = renderFor(value);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("");
  });
});
