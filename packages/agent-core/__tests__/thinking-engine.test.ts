// ============================================================
// @bioagent/agent-core — Thinking Engine Tests
// ============================================================

import { describe, it, expect } from "vitest";
import { ThinkingEngine } from "../src/thinking-engine.js";
import { THINKING_TEMPLATE, renderTemplate } from "../src/thinking-template.js";

describe("thinking-template", () => {
  describe("renderTemplate", () => {
    it("should substitute simple variables", () => {
      const result = renderTemplate("Hello {{NAME}}!", { NAME: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should leave missing variables empty", () => {
      const result = renderTemplate("Hello {{MISSING}}!", {});
      expect(result).toBe("Hello !");
    });

    it("should handle conditional blocks when value exists", () => {
      const template = "{{#SHOW}}Content: {{VALUE}}{{/SHOW}}";
      const result = renderTemplate(template, {
        SHOW: "yes",
        VALUE: "42",
      });
      expect(result).toContain("Content: 42");
    });

    it("should remove conditional blocks when value is empty", () => {
      const template = "{{#HIDDEN}}should not appear{{/HIDDEN}}";
      const result = renderTemplate(template, { HIDDEN: "" });
      expect(result).not.toContain("should not appear");
    });

    it("should remove conditional blocks when value is 'null'", () => {
      const template = "{{#HIDDEN}}should not appear{{/HIDDEN}}";
      const result = renderTemplate(template, { HIDDEN: "null" });
      expect(result).not.toContain("should not appear");
    });

    it("should remove conditional blocks when value is 'undefined'", () => {
      const template = "{{#HIDDEN}}should not appear{{/HIDDEN}}";
      const result = renderTemplate(template, { HIDDEN: "undefined" });
      expect(result).not.toContain("should not appear");
    });

    it("should render nested variables inside conditional blocks", () => {
      const template = "{{#BLOCK}}Name: {{NAME}}, Age: {{AGE}}{{/BLOCK}}";
      const result = renderTemplate(template, {
        BLOCK: "has_content",
        NAME: "Alice",
        AGE: "30",
      });
      expect(result).toBe("Name: Alice, Age: 30");
    });

    it("should render the full thinking template with context", () => {
      const result = renderTemplate(THINKING_TEMPLATE, {
        USER_QUESTION: "How to perform scRNA-seq QC?",
        FILE_INSPECT_RESULT: "",
        RESOURCE_REPORT: "",
        KNOWLEDGE_RESULT: "",
      });
      expect(result).toContain("How to perform scRNA-seq QC?");
      expect(result).toContain("科学问题还原");
      expect(result).toContain("工具与镜像选择");
      expect(result).not.toContain("{{#FILE_INSPECT_RESULT}}"); // Conditional block should be removed
      expect(result).not.toContain("{{/FILE_INSPECT_RESULT}}");
    });

    it("should include file inspect result when provided", () => {
      const inspectResult = JSON.stringify({ files: [{ name: "data.h5ad", size: 1024 }] });
      const result = renderTemplate(THINKING_TEMPLATE, {
        USER_QUESTION: "test",
        FILE_INSPECT_RESULT: inspectResult,
        RESOURCE_REPORT: "",
        KNOWLEDGE_RESULT: "",
      });
      expect(result).toContain("文件探测结果");
      expect(result).toContain("data.h5ad");
    });
  });
});

describe("ThinkingEngine", () => {
  describe("buildPrompt", () => {
    it("should inject user question into template", () => {
      const engine = new ThinkingEngine();
      const prompt = engine.buildPrompt({
        userQuestion: "如何进行差异分析？",
      });
      expect(prompt).toContain("如何进行差异分析？");
      expect(prompt).toContain("科学问题还原");
      expect(prompt).toContain("第七步");
    });

    it("should inject resource report as JSON", () => {
      const engine = new ThinkingEngine();
      const prompt = engine.buildPrompt({
        userQuestion: "test",
        resourceReport: { dockerRunning: true, availableGB: 32, gpuAvailable: false },
      });
      expect(prompt).toContain("dockerRunning");
      expect(prompt).toContain("32");
    });

    it("should inject knowledge result as JSON", () => {
      const engine = new ThinkingEngine();
      const prompt = engine.buildPrompt({
        userQuestion: "test",
        knowledgeResult: { synthesis: "Found relevant papers", confidence: 0.85 },
      });
      expect(prompt).toContain("Found relevant papers");
      expect(prompt).toContain("0.85");
    });

    it("should stringify object contexts", () => {
      const engine = new ThinkingEngine();
      const prompt = engine.buildPrompt({
        userQuestion: "test",
        fileInspectResult: { path: "/data/test.h5ad", size: 5000 },
        resourceReport: { cpu: { cores: 8 } },
        knowledgeResult: { vectorResults: { snippets: [{ text: "example" }] } },
      });
      // Objects should be JSON stringified and present
      expect(prompt).toContain("test.h5ad");
    });
  });

  describe("parseThinkingOutput", () => {
    it("should parse 7-step Chinese format", () => {
      const engine = new ThinkingEngine();
      const output = [
        "第一步：科学问题还原",
        "这是一个测试问题",
        "---",
        "第二步：数据需求与质控标准",
        "需要 scRNA-seq 数据",
        "---",
        "第三步：工具与镜像选择",
        "推荐使用 Seurat",
        "---",
        "第四步：多分析路径评估",
        "路径A vs 路径B",
        "---",
        "第五步：风险识别与缓解",
        "批次效应风险",
        "---",
        "第六步：执行计划",
        "步骤1: QC",
        "---",
        "第七步：结果解读与可视化计划",
        "UMAP 可视化",
      ].join("\n");

      const sections = engine.parseThinkingOutput(output);
      expect(sections).toHaveLength(7);
      expect(sections[0]).toMatchObject({ index: 1, title: "科学问题还原" });
      expect(sections[1]).toMatchObject({ index: 2, title: "数据需求与质控标准" });
      expect(sections[2]).toMatchObject({ index: 3, title: "工具与镜像选择" });
      expect(sections[3]).toMatchObject({ index: 4, title: "多分析路径评估" });
      expect(sections[4]).toMatchObject({ index: 5, title: "风险识别与缓解" });
      expect(sections[5]).toMatchObject({ index: 6, title: "执行计划" });
      expect(sections[6]).toMatchObject({ index: 7, title: "结果解读与可视化计划" });
    });

    it("should parse English Step format", () => {
      const engine = new ThinkingEngine();
      const output = [
        "Step 1: Scientific Question Reduction",
        "This is a test",
        "---",
        "Step 2: Data Requirements and QC Standards",
        "Need scRNA-seq data",
        "---",
        "Step 3: Tool and Image Selection",
        "Recommend Seurat",
        "---",
        "Step 4: Multi-Path Evaluation",
        "Path A vs Path B",
        "---",
        "Step 5: Risk Identification",
        "Batch effect risk",
        "---",
        "Step 6: Execution Plan",
        "Step 1: QC",
        "---",
        "Step 7: Results Interpretation",
        "UMAP visualization",
      ].join("\n");

      const sections = engine.parseThinkingOutput(output);
      expect(sections).toHaveLength(7);
      expect(sections[0]).toMatchObject({ index: 1 });
      expect(sections[6]).toMatchObject({ index: 7 });
    });

    it("should fill missing sections with defaults", () => {
      const engine = new ThinkingEngine();
      const output = "第一步：科学问题还原\nJust one step.";

      const sections = engine.parseThinkingOutput(output);
      expect(sections).toHaveLength(7);
      expect(sections[0].index).toBe(1);
      expect(sections[0].content).toContain("Just one step");
      // Remaining sections should exist with empty content
      expect(sections[1].index).toBe(2);
      expect(sections[1].content).toBe("");
      expect(sections[6].index).toBe(7);
      expect(sections[6].content).toBe("");
    });

    it("should handle empty output", () => {
      const engine = new ThinkingEngine();
      const sections = engine.parseThinkingOutput("");
      expect(sections).toHaveLength(7);
      for (const section of sections) {
        expect(section.content).toBe("");
      }
    });

    it("should handle custom template in constructor", () => {
      const customTemplate = "Custom: {{USER_QUESTION}}";
      const engine = new ThinkingEngine(customTemplate);
      const prompt = engine.buildPrompt({ userQuestion: "hello" });
      expect(prompt).toBe("Custom: hello");
    });

    it("should auto-increment index for sections without explicit numbering", () => {
      const engine = new ThinkingEngine();
      const output = [
        "### Analysis Overview",
        "Some content here",
        "---",
        "### Quality Control",
        "QC description",
        "---",
        "### Tools",
        "Tool list",
      ].join("\n");

      const sections = engine.parseThinkingOutput(output);
      expect(sections).toHaveLength(7);
      // First 3 should have content from the output
      expect(sections[0].content).toContain("Some content here");
      expect(sections[1].content).toContain("QC description");
      expect(sections[2].content).toContain("Tool list");
      // Remaining 4 should be empty
      expect(sections[3].content).toBe("");
      expect(sections[6].content).toBe("");
    });
  });
});
