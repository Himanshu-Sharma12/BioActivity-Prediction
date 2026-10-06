// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import SafetyAssessmentComponent from "./safety-assessment";
import type { SafetyAssessment, StructuralAlert, RuleSet } from "@shared/schema";

afterEach(cleanup);

/**
 * These strings are the guardrails that stop the assessment being over-read.
 * They live in server/services/{safety,structural-alerts}.ts. If the product
 * copy changes, change it here too — but it must never disappear from the UI.
 */
const COVERAGE_NOTE = "Absence of an alert is not evidence of safety.";
const DISCLAIMER =
  "For research use only. Not for use in diagnostic or therapeutic procedures. " +
  "These are computed physicochemical properties and published structural alerts, " +
  "not experimental measurements or validated toxicity predictions. They must not " +
  "be used to make safety decisions about human or animal exposure.";

// Fixtures are typed against the real contract, so a schema change breaks the
// build here rather than silently drifting.
const lipinski: RuleSet = {
  rules: [
    { name: "Molecular weight", passed: true, value: 180.16, threshold: 500 },
    { name: "LogP", passed: true, value: 1.19, threshold: 5 },
    { name: "H-bond donors", passed: true, value: 1, threshold: 5 },
    { name: "H-bond acceptors", passed: true, value: 4, threshold: 10 },
  ],
  violations: 0,
  passed: true,
  citation: "Lipinski et al., Adv. Drug Deliv. Rev. 2001.",
};

const veber: RuleSet = {
  rules: [
    { name: "Rotatable bonds", passed: false, value: 12, threshold: 10 },
    { name: "Topological polar surface area", passed: true, value: 63.6, threshold: 140 },
  ],
  violations: 1,
  passed: false,
  citation: "Veber et al., J. Med. Chem. 2002.",
};

const michaelAcceptor: StructuralAlert = {
  id: "brenk-michael-acceptor",
  name: "Michael acceptor",
  severity: "high",
  concern: "Electrophilic; can covalently modify proteins and nucleic acids.",
  source: "Brenk",
  matchedAtoms: [3, 4, 5],
};

const catechol: StructuralAlert = {
  id: "pains-catechol",
  name: "Catechol",
  severity: "moderate",
  concern: "Frequent hitter; redox cycling can produce assay interference.",
  source: "PAINS",
  matchedAtoms: [7, 8],
};

const aliphaticHalide: StructuralAlert = {
  id: "brenk-aliphatic-halide",
  name: "Aliphatic long chain",
  severity: "low",
  concern: "Associated with poor solubility and promiscuous binding.",
  source: "Brenk",
  matchedAtoms: [11],
};

function makeAssessment(overrides: Partial<SafetyAssessment> = {}): SafetyAssessment {
  return {
    concernLevel: "none",
    summary: "No substructure from the screened alert sets matched this structure.",
    structuralAlerts: [],
    alertCounts: { high: 0, moderate: 0, low: 0, total: 0 },
    drugLikeness: { lipinski, veber },
    coverage: {
      brenk: "curated subset (25 of ~105 Brenk alerts)",
      pains: "curated subset (6 of ~480 PAINS_A patterns)",
      note: COVERAGE_NOTE,
    },
    disclaimer: DISCLAIMER,
    ...overrides,
  };
}

const withAlerts = makeAssessment({
  concernLevel: "high",
  summary: "Three structural alerts matched, including one high-severity alert.",
  structuralAlerts: [michaelAcceptor, catechol, aliphaticHalide],
  alertCounts: { high: 1, moderate: 1, low: 1, total: 3 },
});

describe("SafetyAssessment — structural alerts", () => {
  it("renders every matched alert with its severity and source", () => {
    render(<SafetyAssessmentComponent assessment={withAlerts} isLoading={false} />);

    const list = screen.getByTestId("list-structural-alerts");
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    const high = screen.getByTestId("alert-brenk-michael-acceptor");
    expect(within(high).getByText("Michael acceptor")).toBeInTheDocument();
    expect(within(high).getByText("high")).toBeInTheDocument();
    expect(within(high).getByText("Brenk")).toBeInTheDocument();
    expect(within(high).getByText(michaelAcceptor.concern)).toBeInTheDocument();

    const moderate = screen.getByTestId("alert-pains-catechol");
    expect(within(moderate).getByText("moderate")).toBeInTheDocument();
    expect(within(moderate).getByText("PAINS")).toBeInTheDocument();

    const low = screen.getByTestId("alert-brenk-aliphatic-halide");
    expect(within(low).getByText("low")).toBeInTheDocument();
  });

  it("shows the severity breakdown that matches alertCounts", () => {
    render(<SafetyAssessmentComponent assessment={withAlerts} isLoading={false} />);

    const counts = screen.getByTestId("text-alert-counts").textContent ?? "";
    expect(counts).toContain("3 matched");
    expect(counts).toContain("1 high");
    expect(counts).toContain("1 moderate");
    expect(counts).toContain("1 low");
  });

  it("renders the empty state, not a list, when nothing matched", () => {
    render(<SafetyAssessmentComponent assessment={makeAssessment()} isLoading={false} />);

    expect(screen.getByTestId("empty-structural-alerts")).toBeInTheDocument();
    expect(screen.queryByTestId("list-structural-alerts")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-alert-counts").textContent).toContain("0 matched");
  });

  it("labels a clean result as 'no alerts matched' rather than as safe", () => {
    render(<SafetyAssessmentComponent assessment={makeAssessment()} isLoading={false} />);

    const level = screen.getByTestId("text-concern-level").textContent ?? "";
    expect(level).toBe("No Alerts Matched");
    expect(level).not.toMatch(/\bsafe\b/i);
    expect(level).not.toMatch(/non[- ]?toxic/i);
  });

  it("escalates the concern level label when a high-severity alert matched", () => {
    render(<SafetyAssessmentComponent assessment={withAlerts} isLoading={false} />);
    expect(screen.getByTestId("text-concern-level")).toHaveTextContent("High-Severity Alerts");
  });
});

describe("SafetyAssessment — guardrails", () => {
  // The single most valuable assertion in the client: this fails loudly if the
  // disclaimer or the coverage caveats are ever dropped from the UI.
  it.each([
    ["no alerts matched", makeAssessment()],
    ["alerts matched", withAlerts],
  ])("always renders the disclaimer and coverage caveats (%s)", (_label, assessment) => {
    render(<SafetyAssessmentComponent assessment={assessment} isLoading={false} />);

    expect(screen.getByTestId("text-disclaimer")).toHaveTextContent(
      "For research use only",
    );
    expect(screen.getByTestId("text-disclaimer")).toHaveTextContent(
      "not experimental measurements or validated toxicity predictions",
    );
    expect(screen.getByTestId("text-coverage-note")).toHaveTextContent(COVERAGE_NOTE);
    expect(screen.getByTestId("text-coverage-brenk")).toHaveTextContent(/subset/i);
    expect(screen.getByTestId("text-coverage-pains")).toHaveTextContent(/subset/i);
  });

  it("does not render any toxicity probability, percentage or score", () => {
    const { container } = render(
      <SafetyAssessmentComponent assessment={withAlerts} isLoading={false} />,
    );

    // The disclaimer legitimately contains the word "predictions" (as something
    // this is NOT), so exclude it before scanning.
    screen.getByTestId("text-disclaimer").remove();
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/probabilit/i);
    expect(text).not.toMatch(/likelihood/i);
    expect(text).not.toMatch(/confidence/i);
    expect(text).not.toMatch(/\bscore\b/i);
    expect(text).not.toMatch(/\bpredicted\b/i);
    expect(text).not.toMatch(/\brisk of\b/i);
  });
});

describe("SafetyAssessment — rule sets and other states", () => {
  it("renders Lipinski and Veber rules with values, thresholds and pass/fail", () => {
    render(<SafetyAssessmentComponent assessment={withAlerts} isLoading={false} />);

    const lipinskiTable = screen.getByTestId("table-lipinski");
    expect(within(lipinskiTable).getByText("No violations")).toBeInTheDocument();
    expect(within(lipinskiTable).getByText("Molecular weight")).toBeInTheDocument();
    expect(within(lipinskiTable).getByText("180.16")).toBeInTheDocument();
    expect(within(lipinskiTable).getByText("500")).toBeInTheDocument();
    expect(within(lipinskiTable).getAllByText("PASS")).toHaveLength(4);
    expect(within(lipinskiTable).getByText(lipinski.citation)).toBeInTheDocument();

    const veberTable = screen.getByTestId("table-veber");
    expect(within(veberTable).getByText("1 violation")).toBeInTheDocument();
    expect(within(veberTable).getByText("FAIL")).toBeInTheDocument();
  });

  it("renders the loading state without any assessment content", () => {
    render(<SafetyAssessmentComponent assessment={null} isLoading />);

    expect(screen.getByText(/Screening structural alerts/i)).toBeInTheDocument();
    expect(screen.queryByTestId("text-concern-level")).not.toBeInTheDocument();
    expect(screen.queryByTestId("text-disclaimer")).not.toBeInTheDocument();
  });

  it("prompts for input when there is no assessment", () => {
    render(<SafetyAssessmentComponent assessment={null} isLoading={false} />);

    expect(screen.getByText(/Analyze a compound to view safety assessment/i)).toBeInTheDocument();
    expect(screen.queryByTestId("text-concern-level")).not.toBeInTheDocument();
  });
});
