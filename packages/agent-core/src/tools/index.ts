// ============================================================
// @bioagent/agent-core — Tools Index
// ============================================================

import {
  dockerExecToolDef,
  dockerExecToolSchema,
  dockerExecHandler,
  type DockerExecToolParams,
} from "./docker-exec.tool";

import {
  dockerSearchToolDef,
  dockerSearchToolSchema,
  dockerSearchHandler,
  type DockerSearchToolParams,
} from "./docker-search.tool";

import {
  dockerPullToolDef,
  dockerPullToolSchema,
  dockerPullHandler,
  type DockerPullToolParams,
} from "./docker-pull.tool";

import {
  dockerInspectToolDef,
  dockerInspectToolSchema,
  dockerInspectHandler,
  type DockerInspectToolParams,
} from "./docker-inspect.tool";

import {
  dockerVerifyToolDef,
  dockerVerifyToolSchema,
  dockerVerifyHandler,
  type DockerVerifyToolParams,
} from "./docker-verify.tool";

import {
  skillInvokeToolDef,
  skillInvokeToolSchema,
  skillInvokeHandler,
  type SkillInvokeToolParams,
} from "./skill-invoke.tool";

import {
  kbQueryToolDef,
  kbQueryToolSchema,
  kbQueryHandler,
  type KbQueryToolParams,
} from "./kb-query.tool";

import {
  fileInspectToolDef,
  fileInspectToolSchema,
  fileInspectHandler,
  type FileInspectToolParams,
} from "./file-inspect.tool";

import {
  workflowRunToolDef,
  workflowRunToolSchema,
  workflowRunHandler,
  type WorkflowRunToolParams,
} from "./workflow-run.tool";

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export {
  dockerExecToolDef,
  dockerExecToolSchema,
  dockerExecHandler,
  type DockerExecToolParams,
};

export {
  dockerSearchToolDef,
  dockerSearchToolSchema,
  dockerSearchHandler,
  type DockerSearchToolParams,
};

export {
  dockerPullToolDef,
  dockerPullToolSchema,
  dockerPullHandler,
  type DockerPullToolParams,
};

export {
  dockerInspectToolDef,
  dockerInspectToolSchema,
  dockerInspectHandler,
  type DockerInspectToolParams,
};

export {
  dockerVerifyToolDef,
  dockerVerifyToolSchema,
  dockerVerifyHandler,
  type DockerVerifyToolParams,
};

export {
  skillInvokeToolDef,
  skillInvokeToolSchema,
  skillInvokeHandler,
  type SkillInvokeToolParams,
};

export {
  kbQueryToolDef,
  kbQueryToolSchema,
  kbQueryHandler,
  type KbQueryToolParams,
};

export {
  fileInspectToolDef,
  fileInspectToolSchema,
  fileInspectHandler,
  type FileInspectToolParams,
};

export {
  workflowRunToolDef,
  workflowRunToolSchema,
  workflowRunHandler,
  type WorkflowRunToolParams,
};

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
