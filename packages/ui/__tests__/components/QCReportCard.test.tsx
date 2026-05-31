// ============================================================
// @bioagent/ui — QCReportCard Component Tests
// ============================================================

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import QCReportCard, {
  type QCGateData,
} from "../../src/components/bioagent/QCReportCard";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeGate(
  overrides: Partial<QCGateData> & { id: string }
): QCGateData {
  return {
    name: "Test Gate",
    result: "pass",
    detail: "All checks passed.",
    canAutoFix: false,
    ...overrides,
  };
}

function makeGates(
  results: ("pass" | "warn" | "fail")[]
): QCGateData[] {
  return results.map((result, index) =>
    makeGate({
      id: `gate-${index}`,
      name: `Gate ${index + 1}`,
      result,
      detail: `Detail for gate ${index + 1}`,
      suggestion:
        result !== "pass"
          ? `Suggested fix for gate ${index + 1}`
          : undefined,
      canAutoFix: result === "fail",
    })
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("QCReportCard", () => {
  const defaultProps = {
    skillName: "scrna-qc",
    overall: "pass" as const,
    gates: [] as QCGateData[],
    onApplySuggestion: vi.fn(),
    onIgnoreSuggestion: vi.fn(),
    onCustomThreshold: vi.fn(),
  };

  describe("rendering", () => {
    it("should render skill name", () => {
      render(<QCReportCard {...defaultProps} skillName="scrna-qc" />);
      expect(screen.getByText("scrna-qc")).toBeInTheDocument();
    });

    it("should render pass badge when overall is pass", () => {
      render(<QCReportCard {...defaultProps} overall="pass" />);
      expect(screen.getByText(/Pass/)).toBeInTheDocument();
    });

    it("should render warn badge when overall is warn", () => {
      render(<QCReportCard {...defaultProps} overall="warn" />);
      expect(screen.getByText(/Warning/)).toBeInTheDocument();
    });

    it("should render fail badge when overall is fail", () => {
      render(<QCReportCard {...defaultProps} overall="fail" />);
      expect(screen.getByText(/Fail/)).toBeInTheDocument();
    });

    it("should show pass count", () => {
      const gates = makeGates(["pass", "pass", "warn", "fail"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="warn" />);
      expect(screen.getByText("2/4 passed")).toBeInTheDocument();
    });
  });

  describe("expand/collapse", () => {
    it("should expand gates on click", () => {
      const gates = makeGates(["pass", "warn", "fail"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="warn" />);

      // Gates should not be visible initially
      expect(screen.queryByText("Gate 1")).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(screen.getByText("scrna-qc"));

      // Gates should now be visible
      expect(screen.getByText("Gate 1")).toBeInTheDocument();
      expect(screen.getByText("Gate 2")).toBeInTheDocument();
      expect(screen.getByText("Gate 3")).toBeInTheDocument();
    });

    it("should show gate details when expanded", () => {
      const gates = makeGates(["pass", "warn", "fail"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="warn" />);
      fireEvent.click(screen.getByText("scrna-qc"));

      expect(screen.getByText("Detail for gate 1")).toBeInTheDocument();
      expect(screen.getByText("Detail for gate 2")).toBeInTheDocument();
      expect(screen.getByText("Detail for gate 3")).toBeInTheDocument();
    });

    it("should show suggestions for non-pass gates", () => {
      const gates = makeGates(["pass", "warn", "fail"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="warn" />);
      fireEvent.click(screen.getByText("scrna-qc"));

      expect(screen.getByText(/Suggested fix for gate 2/)).toBeInTheDocument();
      expect(screen.getByText(/Suggested fix for gate 3/)).toBeInTheDocument();
    });
  });

  describe("interactions", () => {
    it("should call onApplySuggestion when auto-fix is clicked", () => {
      const onApplySuggestion = vi.fn();
      const gates = makeGates(["fail"]);
      render(
        <QCReportCard
          {...defaultProps}
          gates={gates}
          overall="fail"
          onApplySuggestion={onApplySuggestion}
        />
      );

      fireEvent.click(screen.getByText("scrna-qc"));
      fireEvent.click(screen.getByText("Auto-fix"));

      expect(onApplySuggestion).toHaveBeenCalledWith("gate-0");
    });

    it("should call onIgnoreSuggestion when ignore is clicked", () => {
      const onIgnoreSuggestion = vi.fn();
      const gates = makeGates(["warn"]);
      render(
        <QCReportCard
          {...defaultProps}
          gates={gates}
          overall="warn"
          onIgnoreSuggestion={onIgnoreSuggestion}
        />
      );

      fireEvent.click(screen.getByText("scrna-qc"));
      fireEvent.click(screen.getByText("Ignore"));

      expect(onIgnoreSuggestion).toHaveBeenCalledWith("gate-0");
    });

    it("should show auto-fix only for fixable gates", () => {
      const gates: QCGateData[] = [
        makeGate({
          id: "gate-fixable",
          name: "Fixable Gate",
          result: "fail",
          detail: "Failed check",
          suggestion: "Try auto-fix",
          canAutoFix: true,
        }),
        makeGate({
          id: "gate-nonfixable",
          name: "Non-Fixable Gate",
          result: "fail",
          detail: "Failed check",
          suggestion: "Manual fix needed",
          canAutoFix: false,
        }),
      ];
      render(
        <QCReportCard {...defaultProps} gates={gates} overall="fail" />
      );

      fireEvent.click(screen.getByText("scrna-qc"));

      // Both gates should exist
      expect(screen.getByText("Fixable Gate")).toBeInTheDocument();
      expect(screen.getByText("Non-Fixable Gate")).toBeInTheDocument();

      // Only fixable gate should have auto-fix button
      const autoFixButtons = screen.getAllByText("Auto-fix");
      expect(autoFixButtons).toHaveLength(1);
    });

    it("should render custom threshold input for warn gates", () => {
      const gates = makeGates(["warn"]);
      render(
        <QCReportCard {...defaultProps} gates={gates} overall="warn" />
      );

      fireEvent.click(screen.getByText("scrna-qc"));

      expect(screen.getByText("Custom threshold:")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();
    });

    it("should call onCustomThreshold when apply is clicked", () => {
      const onCustomThreshold = vi.fn();
      const gates = makeGates(["warn"]);
      render(
        <QCReportCard
          {...defaultProps}
          gates={gates}
          overall="warn"
          onCustomThreshold={onCustomThreshold}
        />
      );

      fireEvent.click(screen.getByText("scrna-qc"));

      const input = screen.getByPlaceholderText("Value");
      fireEvent.change(input, { target: { value: "0.5" } });
      fireEvent.click(screen.getByText("Apply"));

      expect(onCustomThreshold).toHaveBeenCalledWith("gate-0", 0.5);
    });
  });

  describe("gate result display", () => {
    it("should show pass emoji for passed gates", () => {
      const gates = makeGates(["pass"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="pass" />);
      fireEvent.click(screen.getByText("scrna-qc"));
      expect(screen.getByText("✅")).toBeInTheDocument();
    });

    it("should show warn emoji for warned gates", () => {
      const gates = makeGates(["warn"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="warn" />);
      fireEvent.click(screen.getByText("scrna-qc"));
      expect(screen.getByText("⚠️")).toBeInTheDocument();
    });

    it("should show fail emoji for failed gates", () => {
      const gates = makeGates(["fail"]);
      render(<QCReportCard {...defaultProps} gates={gates} overall="fail" />);
      fireEvent.click(screen.getByText("scrna-qc"));
      expect(screen.getByText("❌")).toBeInTheDocument();
    });
  });
});
