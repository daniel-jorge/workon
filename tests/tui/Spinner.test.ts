import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Spinner } from "@/tui/Spinner.js";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

describe("Spinner component", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should render spinner with default status text", () => {
    const { lastFrame } = render(React.createElement(Spinner));
    const frame = lastFrame();
    expect(frame).toContain("Scanning for projects…");
  });

  it("should render spinner with custom status text", () => {
    const { lastFrame } = render(React.createElement(Spinner, { status: "Loading…" }));
    const frame = lastFrame();
    expect(frame).toContain("Loading…");
  });

  it("should render a spinner character", () => {
    const { lastFrame } = render(React.createElement(Spinner));
    const frame = lastFrame();
    // Should contain one of the braille frames or ASCII fallback
    const hasSpinner = BRAILLE_FRAMES.some((char) => frame.includes(char)) || frame.includes("[…]");
    expect(hasSpinner).toBe(true);
  });

  it("should respect NO_COLOR environment variable", () => {
    process.env.NO_COLOR = "1";
    const { lastFrame } = render(React.createElement(Spinner));
    const frame = lastFrame();
    expect(frame).toContain("[…]");
    // Should not contain any braille characters
    const hasBraille = BRAILLE_FRAMES.some((char) => frame.includes(char));
    expect(hasBraille).toBe(false);
  });

  it("should show ASCII fallback when NO_COLOR is set", () => {
    process.env.NO_COLOR = "true";
    const { lastFrame } = render(React.createElement(Spinner));
    const frame = lastFrame();
    expect(frame).toContain("[…]");
  });

  it("should not render color codes when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";
    const { lastFrame } = render(React.createElement(Spinner));
    const frame = lastFrame();
    // Should use ASCII fallback, not braille
    expect(frame).toContain("[…]");
  });

  it("should clean up interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(React.createElement(Spinner));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("should render without crashing", () => {
    expect(() => {
      const { unmount } = render(React.createElement(Spinner));
      unmount();
    }).not.toThrow();
  });
});
