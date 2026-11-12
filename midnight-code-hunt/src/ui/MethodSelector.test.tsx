import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { METHOD_LABELS } from "../model/methods";
import type { MethodId } from "../model/types";
import { MethodSelector } from "./MethodSelector";

function Harness({
  available,
  initial,
}: {
  available: readonly MethodId[];
  initial: MethodId;
}) {
  const [selected, setSelected] = useState<MethodId>(initial);
  return <MethodSelector available={available} selected={selected} onSelect={setSelected} />;
}

describe("MethodSelector", () => {
  it("lists Index Keyword Lookup first and selected when both methods are offered", () => {
    render(<Harness available={["toc", "index"]} initial="index" />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);
    expect(radios[0]).toHaveTextContent(METHOD_LABELS.index);
    expect(radios[1]).toHaveTextContent(METHOD_LABELS.toc);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveAttribute("aria-checked", "false");
  });

  it("offers only Table of Contents Lookup, selected, when Index is unavailable", () => {
    render(<Harness available={["toc"]} initial="toc" />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(1);
    expect(radios[0]).toHaveTextContent(METHOD_LABELS.toc);
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText(METHOD_LABELS.index)).not.toBeInTheDocument();
  });

  it("moves selection and focus with arrow keys, wrapping at both ends", async () => {
    const user = userEvent.setup();
    render(<Harness available={["index", "toc"]} initial="index" />);
    const [indexRadio, tocRadio] = screen.getAllByRole("radio");

    indexRadio!.focus();
    await user.keyboard("{ArrowRight}");
    expect(tocRadio).toHaveFocus();
    expect(tocRadio).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowRight}");
    expect(indexRadio).toHaveFocus();
    expect(indexRadio).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowLeft}");
    expect(tocRadio).toHaveFocus();
    expect(tocRadio).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{ArrowDown}");
    expect(indexRadio).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(tocRadio).toHaveFocus();
  });

  it("selects on click and keeps the selected radio as the only tab stop", async () => {
    const user = userEvent.setup();
    render(<Harness available={["index", "toc"]} initial="index" />);
    const [indexRadio, tocRadio] = screen.getAllByRole("radio");
    expect(indexRadio).toHaveAttribute("tabindex", "0");
    expect(tocRadio).toHaveAttribute("tabindex", "-1");

    await user.click(tocRadio!);
    expect(tocRadio).toHaveAttribute("aria-checked", "true");
    expect(tocRadio).toHaveAttribute("tabindex", "0");
    expect(indexRadio).toHaveAttribute("tabindex", "-1");
  });

  it("marks the selected method with a non-color check mark", () => {
    render(<Harness available={["index", "toc"]} initial="toc" />);
    const [indexRadio, tocRadio] = screen.getAllByRole("radio");
    expect(tocRadio).toHaveTextContent("\u2713");
    expect(indexRadio).not.toHaveTextContent("\u2713");
  });
});
