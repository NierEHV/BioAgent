// ============================================================
// @bioagent/agent-core — workflow-run Tool
// ============================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

export const workflowRunToolSchema = z.object({
  workflow_name: z
    .string()
    .min(1)
    .describe(
      "Workflow name, e.g. 'scrna_standard', 'scrna_integration', 'trajectory_inference'",
    ),
  project_id: z.string().min(1).describe("Project identifier for data isolation"),
  container: z.string().optional().describe("Docker container to run the workflow in"),
  params: z
    .record(z.string(), z.unknown())
    .default({})
    .describe("Workflow-specific parameters"),
  resume_from: z.string().optional().describe("Node ID to resume the workflow from"),
});

export type WorkflowRunToolParams = z.infer<typeof workflowRunToolSchema>;

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const workflowRunToolDef = {
  name: "workflow_run",
  description:
    "Start a bioinformatics analysis workflow. Workflows are pre-defined sequences of analysis steps (e.g. scRNA-seq standard workflow: QC → normalization → clustering → DE analysis → visualization). Supports resuming from a specific node.",
  schema: workflowRunToolSchema,
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * Workflow run handler.
 *
 * This handler is a placeholder that delegates to the workflow engine.
 * In the full implementation, it would import from @bioagent/workflow and
 * execute the workflow graph.
 *
 * @param params - Workflow parameters
 * @returns Workflow execution result
 */
export async function workflowRunHandler(
  params: WorkflowRunToolParams,
): Promise<{
  workflowName: string;
  projectId: string;
  status: "started" | "resumed";
  workflowId: string;
  nodes: { id: string; name: string; status: string }[];
  message: string;
}> {
  // Generate a unique workflow ID
  const workflowId = `wf-${params.workflow_name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Define standard workflow node sequences
  const workflowDefs: Record<string, { id: string; name: string }[]> = {
    scrna_standard: [
      { id: "qc", name: "Quality Control" },
      { id: "normalize", name: "Normalization" },
      { id: "hvg", name: "Highly Variable Genes" },
      { id: "pca", name: "PCA Dimensionality Reduction" },
      { id: "cluster", name: "Clustering" },
      { id: "umap", name: "UMAP Visualization" },
      { id: "de", name: "Differential Expression" },
      { id: "annotate", name: "Cell Type Annotation" },
      { id: "report", name: "Generate Report" },
    ],
    scrna_integration: [
      { id: "qc", name: "Quality Control (per sample)" },
      { id: "integrate", name: "Data Integration" },
      { id: "batch_correct", name: "Batch Correction" },
      { id: "cluster", name: "Clustering" },
      { id: "umap", name: "UMAP Visualization" },
      { id: "de", name: "Differential Expression" },
      { id: "report", name: "Generate Report" },
    ],
    trajectory_inference: [
      { id: "qc", name: "Quality Control" },
      { id: "normalize", name: "Normalization" },
      { id: "trajectory", name: "Trajectory Inference" },
      { id: "pseudotime", name: "Pseudotime Analysis" },
      { id: "branches", name: "Branch Point Analysis" },
      { id: "de", name: "Branch-specific DE" },
      { id: "report", name: "Generate Report" },
    ],
  };

  const nodes = workflowDefs[params.workflow_name] ?? [
    { id: "execute", name: "Execute Workflow" },
    { id: "report", name: "Generate Report" },
  ];

  // If resuming from a specific node, mark previous nodes as completed
  const startIndex = params.resume_from
    ? Math.max(0, nodes.findIndex((n) => n.id === params.resume_from))
    : 0;

  const nodeStatuses = nodes.map((node, i) => ({
    ...node,
    status:
      i < startIndex
        ? "completed"
        : i === startIndex
          ? params.resume_from
            ? "resumed"
            : "pending"
          : "pending",
  }));

  return {
    workflowName: params.workflow_name,
    projectId: params.project_id,
    status: params.resume_from ? "resumed" : "started",
    workflowId,
    nodes: nodeStatuses,
    message: params.resume_from
      ? `Workflow "${params.workflow_name}" resumed at node "${params.resume_from}" with ID ${workflowId}`
      : `Workflow "${params.workflow_name}" started with ID ${workflowId}`,
  };
}
