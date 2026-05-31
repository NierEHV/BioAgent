// ============================================================
// @bioagent/agent-core — Validation Hook (beforeToolCall)
// ============================================================
// Checks dangerous operations, path whitelist, timeout upper bounds.

/** Allowed filesystem path prefixes — everything else is rejected. */
const PATH_WHITELIST = [
  "/data/",
  "/tmp/",
  "/workspace/",
  "/home/",
  "/output/",
  "/input/",
  "/intermediate/",
  "/bioagent/",
];

/** Maximum allowed timeout (30 minutes). */
const MAX_TIMEOUT_MS = 1_800_000;

/** Timeout-related parameter key names. */
const TIMEOUT_PARAM_KEYS = ["timeout", "max_timeout", "timeout_ms", "execTimeout"];

/**
 * Check if a command string contains dangerous shell patterns.
 */
function containsDangerousPatterns(command: string): {
  dangerous: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Absolute root removal — match `/` followed by whitespace, end-of-string,
  // or a system directory (not data/tmp/workspace/home)
  if (/rm\s+(-[a-zA-Z]*r[a-zA-Z]*f?\s+)*\/(\s|$|etc|bin|sbin|usr|boot|dev|proc|sys|root|var|opt|lib)/.test(command)) {
    reasons.push("Attempting to remove root filesystem (rm -rf /)");
  }

  // Broad chmod
  if (/chmod\s+(-[a-zA-Z]*R[a-zA-Z]*\s+)?777\b/.test(command)) {
    reasons.push("Overly permissive chmod (777)");
  }

  // Fork bomb patterns
  if (/:\(\)\s*\{/.test(command)) {
    reasons.push("Fork bomb pattern detected");
  }
  if (/\bwhile\s*\(\s*1\s*\)/.test(command) && !/\bsleep\b/.test(command)) {
    reasons.push("Infinite loop without sleep detected");
  }

  // Pipe to shell injection
  if (/\|\s*(ba)?sh\b/.test(command)) {
    reasons.push("Pipe to shell detected — possible injection vector");
  }

  // wget/curl to pipe
  if (/(wget|curl)\s+.*\|\s*(ba)?sh\b/.test(command)) {
    reasons.push("wget/curl piped to shell — code execution risk");
  }

  // Overwrite system files
  if (/>\s*\/(etc|bin|sbin|usr|boot|dev|proc|sys)\//.test(command)) {
    reasons.push("Writing to system directory");
  }

  // DD to disk
  if (/\bdd\s+if=/.test(command) && /of=\/dev\//.test(command)) {
    reasons.push("dd to block device — data destruction risk");
  }

  // IOC exploit
  if (/mkfs\./.test(command)) {
    reasons.push("Filesystem creation command detected");
  }

  // Privilege escalation
  if (/\bsudo\b/.test(command)) {
    reasons.push("sudo usage detected — potential privilege escalation");
  }

  return { dangerous: reasons.length > 0, reasons };
}

/**
 * Check if a path is within the allowed whitelist.
 */
function isPathAllowed(filePath: string): boolean {
  // Normalize Windows backslashes
  const normalized = filePath.replace(/\\/g, "/");

  // Absolute path check
  if (normalized.startsWith("/")) {
    return PATH_WHITELIST.some((prefix) => {
      // Allow exact match (e.g., "/data" matches prefix "/data/")
      const prefixBase = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
      return normalized === prefixBase || normalized.startsWith(prefix);
    });
  }

  // Relative paths are allowed (they'll be resolved inside the container)
  return true;
}

/**
 * Extract all file paths from a tool call's parameters.
 */
function extractPaths(params: Record<string, unknown>): string[] {
  const paths: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && (key.includes("path") || key.includes("dir") || key.includes("file"))) {
      paths.push(value);
    }

    // Recurse into nested objects
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      paths.push(...extractPaths(value as Record<string, unknown>));
    }

    // Check arrays
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") paths.push(item);
      }
    }
  }

  return paths;
}

// ---------------------------------------------------------------------------
// Validation Hook
// ---------------------------------------------------------------------------

export interface ValidationResult {
  /** Whether the tool call is allowed to proceed. */
  allowed: boolean;
  /** If not allowed, the reason for rejection. */
  reason?: string;
  /** Warnings that don't block the call but should be surfaced. */
  warnings: string[];
  /** Whether this operation requires user confirmation. */
  requiresConfirmation: boolean;
}

/**
 * Before-tool-call validation hook.
 *
 * Checked items:
 * 1. Dangerous shell command patterns (rm -rf /, chmod 777, fork bombs, pipe-to-shell)
 * 2. File path whitelist (must be under /data/, /tmp/, /workspace/, etc.)
 * 3. Timeout upper bound (max 30 minutes)
 *
 * @param toolName - Name of the tool being called
 * @param params - Tool call parameters
 * @param requireConfirmation - Global requireConfirmation config flag
 * @returns Validation result
 */
export function validateBeforeToolCall(
  toolName: string,
  params: Record<string, unknown>,
  requireConfirmation: boolean = true,
): ValidationResult {
  const warnings: string[] = [];

  // ------------------------------------------------------------------
  // 1. Check dangerous command patterns
  // ------------------------------------------------------------------
  const commandFields = ["command", "cmd", "script", "entrypoint", "run"];
  for (const field of commandFields) {
    const value = params[field];
    if (typeof value === "string") {
      const { dangerous, reasons } = containsDangerousPatterns(value);
      if (dangerous) {
        return {
          allowed: false,
          reason: `Dangerous command detected in "${toolName}.${field}": ${reasons.join("; ")}`,
          warnings,
          requiresConfirmation: true,
        };
      }
    }
  }

  // ------------------------------------------------------------------
  // 2. Check path whitelist
  // ------------------------------------------------------------------
  const allPaths = extractPaths(params);
  for (const filePath of allPaths) {
    if (!isPathAllowed(filePath)) {
      return {
        allowed: false,
        reason: `Path "${filePath}" is outside the allowed whitelist. Allowed prefixes: ${PATH_WHITELIST.join(", ")}`,
        warnings,
        requiresConfirmation: false,
      };
    }
  }

  // ------------------------------------------------------------------
  // 3. Check timeout upper bound
  // ------------------------------------------------------------------
  for (const key of TIMEOUT_PARAM_KEYS) {
    const value = params[key];
    if (typeof value === "number" && value > MAX_TIMEOUT_MS) {
      return {
        allowed: false,
        reason: `Timeout ${value}ms exceeds maximum allowed ${MAX_TIMEOUT_MS}ms (30 minutes)`,
        warnings,
        requiresConfirmation: false,
      };
    }
  }

  // ------------------------------------------------------------------
  // 4. Additional safety checks for specific tools
  // ------------------------------------------------------------------
  if (toolName === "docker_exec" && params["action"] === "exec") {
    const cmd = params["command"];
    if (typeof cmd === "string" && cmd.length > 10000) {
      return {
        allowed: false,
        reason: "Command exceeds maximum length (10000 characters)",
        warnings,
        requiresConfirmation: false,
      };
    }
  }

  // Volume mount checks
  if (params["volumes"] && Array.isArray(params["volumes"])) {
    for (const vol of params["volumes"] as Array<Record<string, unknown>>) {
      if (vol["host"] && typeof vol["host"] === "string" && !isPathAllowed(vol["host"])) {
        warnings.push(`Volume host path "${vol["host"]}" is outside allowed whitelist`);
      }
    }
  }

  // ------------------------------------------------------------------
  // 5. Confirmation requirement
  // ------------------------------------------------------------------
  let requiresConfirmation = false;
  if (requireConfirmation) {
    // Operations that always require confirmation
    const confirmOps = ["stop_container", "rm", "delete", "prune", "clean", "remove"];
    for (const op of confirmOps) {
      if (
        toolName.toLowerCase().includes(op) ||
        (typeof params["action"] === "string" && params["action"].toLowerCase().includes(op))
      ) {
        requiresConfirmation = true;
        break;
      }
    }
  }

  return {
    allowed: true,
    warnings,
    requiresConfirmation,
  };
}

export { PATH_WHITELIST, MAX_TIMEOUT_MS };
