// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import ErrorBoundary from "./error-boundary";

function Boom({ message = "kaboom" }: { message?: string }): JSX.Element {
  throw new Error(message);
}

beforeEach(() => {
  // React logs the caught error itself; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("ErrorBoundary", () => {
  it("renders its children when nothing throws", () => {
    render(
      <ErrorBoundary>
        <p>all good</p>
      </ErrorBoundary>,
    );

    expect(screen.getByText("all good")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
  });

  it("renders a recoverable fallback when a child throws", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    expect(screen.getByTestId("button-error-reload")).toBeInTheDocument();
  });

  it("shows the error message in development builds", () => {
    // Vitest runs with import.meta.env.DEV === true.
    render(
      <ErrorBoundary>
        <Boom message="descriptor parsing failed" />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("error-boundary-detail")).toHaveTextContent(
      "descriptor parsing failed",
    );
  });

  it("renders a custom fallback when one is supplied", () => {
    render(
      <ErrorBoundary fallback={<p>custom fallback</p>}>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom fallback")).toBeInTheDocument();
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
  });

  it("logs the error so production detail is not lost", () => {
    render(
      <ErrorBoundary>
        <Boom message="logged once" />
      </ErrorBoundary>,
    );

    const logged = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(
      logged.some((args: unknown[]) => String(args[0]).includes("Unhandled render error")),
    ).toBe(true);
  });
});
