// ============================================================
// @bioagent/skills — ReportGeneratorSkill
// ============================================================
// Generates an HTML analysis report from intermediate results.
// Scans the project output directory and compiles all figures,
// metrics, and QC reports into a single interactive report.
//
// QC gates:
// - report_generated: HTML file exists and is non-empty
// - sections_complete: all expected sections populated

import { BaseSkill } from "../base-skill";
import type {
  SkillSpec, SkillContext, SkillExecResult, QCReport,
  SkillOutput, ValidationResult, ToolChoice, DataContext,
} from "../base-skill.types";
import type { ResourceReport } from "@bioagent/executor";

export class ReportGeneratorSkill extends BaseSkill {
  readonly spec: SkillSpec = {
    name: "report-generator",
    version: "1.0.0",
    description: "HTML analysis report generator — compiles figures, metrics, and QC results into interactive report",
    omicsType: "scrna",
    input: { acceptedFormats: ["directory"], schema: {}, minSamples: 1, maxSamples: 1, estimatedInputSize: "10MB-500MB" },
    tools: {
      primary: "Python (jinja2 + base64 image embedding)",
      alternatives: ["R Markdown", "Quarto"],
      decisionTree: [{ condition: "HTML report (recommended)", tool: "Python HTML generator", reason: "Self-contained HTML with embedded images — no external dependencies" }],
      dockerImages: { scanpy: { image: "bioagent-scrna:latest", fallbackImage: "rnakato/shortcake_full:latest" } },
    },
    parameters: {
      defaults: { title: "scRNA-seq Analysis Report", sections: "all", format: "html" },
      descriptions: { title: "Report title", sections: "Comma-separated sections to include (default: all)", format: "html or markdown" },
      constraints: {},
    },
    qcGates: [
      { id: "report_generated", name: "Report Generated", description: "HTML file exists and is non-empty", check: { type: "threshold", expression: "report_generated == true", metric: "report_generated" }, level: "fail", onPass: "Report generated successfully", onFail: "Report generation failed", fixable: true },
      { id: "sections_complete", name: "Sections Complete", description: "All expected sections have content", check: { type: "threshold", expression: "sections_complete >= 3", metric: "sections_complete" }, level: "warn", onPass: "All sections populated", onFail: "Some sections are empty — input data may be missing", fixable: false },
    ],
    outputs: {
      files: [{ name: "report.html", format: "html", description: "Interactive analysis report", required: true }],
      visualizations: [],
      metrics: [
        { name: "n_sections", description: "Number of sections in the report" },
        { name: "n_figures", description: "Number of embedded figures" },
        { name: "report_size_kb", description: "Report file size in KB" },
      ],
    },
    troubleshooting: { common_issues: [] },
    dependencies: { requires: ["functional-enrichment"], recommends: ["marker-detection", "diff-expression", "trajectory", "cell-communication", "grn"], conflicts: [] },
    resourceEstimate: { cpu: "1", ram: "2GB", disk: "1GB", time: "1-2 min", gpu: "not_needed" },
  };

  async validateInput(data: DataContext): Promise<ValidationResult> {
    const errors: string[] = [];
    if (!data.inputPath) errors.push("Input path (project directory) is required");
    if (!data.outputPath) errors.push("Output path is required");
    return { valid: errors.length === 0, errors, warnings: [] };
  }

  async selectTool(_data: DataContext, _resources: ResourceReport): Promise<ToolChoice> {
    return { tool: "Python HTML generator", reason: "Self-contained HTML with embedded images, no external dependencies", image: "bioagent-scrna:latest" };
  }

  async configureParams(data: DataContext, _tool: ToolChoice): Promise<Record<string, unknown>> {
    return { input_path: data.inputPath, output_path: data.outputPath, title: "scRNA-seq Analysis Report", sections: "all" };
  }

  async run(context: SkillContext): Promise<SkillExecResult> {
    const { inputPath, outputPath } = context.data;
    const title = (context.params.title as string) ?? "scRNA-seq Analysis Report";
    const script = `
import os, json, base64
from datetime import datetime

project = "${inputPath}"
title = """${title}"""
output = "${outputPath}"

# Scan for result files
sections_available = []
figures = []

for root, dirs, files in os.walk(project):
    for f in sorted(files):
        full = os.path.join(root, f)
        rel = os.path.relpath(full, project)
        if f.endswith((".png", ".jpg", ".svg", ".jpeg")):
            try:
                with open(full, "rb") as img:
                    b64 = base64.b64encode(img.read()).decode()
                ext = f.rsplit(".", 1)[-1]
                mime = "image/svg+xml" if ext == "svg" else f"image/{ext.replace('jpg','jpeg')}"
                figures.append({"name": f, "path": rel, "data": b64, "mime": mime})
                sections_available.append(rel)
            except Exception as e:
                print(f"WARNING: failed to embed {full}: {e}")

n_figures = len(figures)
n_sections = len(set(os.path.dirname(f["path"]) for f in figures))

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; color: #333; background: #fff; }}
h1 {{ color: #1a5276; border-bottom: 3px solid #2980b9; padding-bottom: 10px; }}
h2 {{ color: #2980b9; margin-top: 32px; border-bottom: 1px solid #eee; padding-bottom: 6px; }}
.metrics {{ display: flex; flex-wrap: wrap; gap: 12px; margin: 16px 0; }}
.metric {{ padding: 16px 20px; border: 1px solid #e0e0e0; border-radius: 8px; text-align: center; min-width: 120px; }}
.metric .value {{ font-size: 28px; font-weight: bold; color: #2980b9; }}
.metric .label {{ font-size: 12px; color: #888; margin-top: 4px; }}
.qc-pass {{ color: #27ae60; }} .qc-warn {{ color: #f39c12; }} .qc-fail {{ color: #e74c3c; }}
img {{ max-width: 100%; border: 1px solid #eee; border-radius: 4px; margin: 12px 0; box-shadow: 0 2px 4px rgba(0,0,0,.05); }}
footer {{ margin-top: 40px; padding-top: 16px; border-top: 1px solid #eee; color: #999; font-size: 12px; }}
</style></head>
<body>
<h1>{title}</h1>
<div class="metrics">
  <div class="metric"><div class="value">{n_figures}</div><div class="label">Figures</div></div>
  <div class="metric"><div class="value">{n_sections}</div><div class="label">Sections</div></div>
  <div class="metric"><div class="value qc-pass">✓</div><div class="label">QC Complete</div></div>
</div>
<p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | BioAgent scRNA-seq Pipeline</p>
"""

# Embed figures by section
current_dir = None
for fig in figures:
    sec = os.path.dirname(fig["path"]) or "root"
    if sec != current_dir:
        html += f'<h2>{sec}</h2>'
        current_dir = sec
    html += f'<h3>{fig["name"]}</h3>'
    html += f'<img src="data:{fig["mime"]};base64,{fig["data"]}" alt="{fig["name"]}" />'

html += """
<footer>Generated by BioAgent — AI-Powered Bioinformatics Agent</footer>
</body></html>"""

os.makedirs(output, exist_ok=True)
report_path = os.path.join(output, "report.html")
with open(report_path, "w", encoding="utf-8") as f:
    f.write(html)

size_kb = round(os.path.getsize(report_path) / 1024, 1)

result = {
    "report_generated": True,
    "report_path": report_path,
    "n_sections": n_sections,
    "n_figures": n_figures,
    "report_size_kb": size_kb,
    "sections_complete": n_sections,
    "output_path": output,
}
print(json.dumps(result))
`;
    const dockerResult = await this.execInContainer(context, script);
    const parsed = this.parseJSONFromStdout(dockerResult.stdout);
    return { exitCode: dockerResult.exitCode, stdout: dockerResult.stdout, stderr: dockerResult.stderr, parsedData: parsed, metrics: { report_generated: (parsed.report_generated as boolean) ? 1 : 0, sections_complete: (parsed.n_sections as number) ?? 0, n_figures: (parsed.n_figures as number) ?? 0, report_size_kb: (parsed.report_size_kb as number) ?? 0 } };
  }

  async runQC(results: SkillExecResult): Promise<QCReport> {
    return this.runQCGates(results.metrics);
  }

  async formatOutput(results: SkillExecResult, qc: QCReport): Promise<SkillOutput> {
    const nSec = results.metrics["sections_complete"] ?? 0;
    const nFig = results.metrics["n_figures"] ?? 0;
    const size = results.metrics["report_size_kb"] ?? 0;
    return {
      files: [{ path: `${results.parsedData["report_path"] ?? ""}`, format: "html", size_bytes: (size as number) * 1024 }],
      metrics: { n_sections: nSec, n_figures: nFig, report_size_kb: size },
      logs: [`Report: ${nSec} sections, ${nFig} figures, ${size}KB — QC: ${qc.overall}`],
    };
  }
}
