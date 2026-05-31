// ============================================================
// @bioagent/agent-core — Tools Index
// ============================================================

export {
  dockerExecToolDef,
  dockerExecToolSchema,
  dockerExecHandler,
} from "./docker-exec.tool.js";

export type { DockerExecToolParams } from "./docker-exec.tool.js";

export {
  dockerSearchToolDef,
  dockerSearchToolSchema,
  dockerSearchHandler,
} from "./docker-search.tool.js";

export type { DockerSearchToolParams } from "./docker-search.tool.js";

export {
  dockerPullToolDef,
  dockerPullToolSchema,
  dockerPullHandler,
} from "./docker-pull.tool.js";

export type { DockerPullToolParams } from "./docker-pull.tool.js";

export {
  dockerInspectToolDef,
  dockerInspectToolSchema,
  dockerInspectHandler,
} from "./docker-inspect.tool.js";

export type { DockerInspectToolParams } from "./docker-inspect.tool.js";

export {
  dockerVerifyToolDef,
  dockerVerifyToolSchema,
  dockerVerifyHandler,
} from "./docker-verify.tool.js";

export type { DockerVerifyToolParams } from "./docker-verify.tool.js";

export {
  skillInvokeToolDef,
  skillInvokeToolSchema,
  skillInvokeHandler,
} from "./skill-invoke.tool.js";

export type { SkillInvokeToolParams } from "./skill-invoke.tool.js";

export {
  kbQueryToolDef,
  kbQueryToolSchema,
  kbQueryHandler,
} from "./kb-query.tool.js";

export type { KbQueryToolParams } from "./kb-query.tool.js";

export {
  fileInspectToolDef,
  fileInspectToolSchema,
  fileInspectHandler,
} from "./file-inspect.tool.js";

export type { FileInspectToolParams } from "./file-inspect.tool.js";

export {
  workflowRunToolDef,
  workflowRunToolSchema,
  workflowRunHandler,
} from "./workflow-run.tool.js";

export type { WorkflowRunToolParams } from "./workflow-run.tool.js";

// ---------------------------------------------------------------------------
// All tools array — ready to register with the agent
// ---------------------------------------------------------------------------

/** All 9 BioAgent custom tools as a flat array of tool definitions. */
export const ALL_TOOLS = [
  dockerExecToolDef,
  dockerSearchToolDef,
  dockerPullToolDef,
  dockerInspectToolDef,
  dockerVerifyToolDef,
  skillInvokeToolDef,
  kbQueryToolDef,
  fileInspectToolDef,
  workflowRunToolDef,
] as const;
