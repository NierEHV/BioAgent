// ============================================================
// @bioagent/skills — Skill Loader
// ============================================================
// Discovers and loads Skill classes from the skills source tree.
// In bundler environments, skills are imported explicitly (not
// dynamically from filesystem). The SkillLoader provides a
// registry integration point and bulk-registration API.

import type { BaseSkill } from "./base-skill.js";
import { SkillRegistry } from "./skill-registry.js";

export interface SkillLoaderOptions {
  /** Registry to populate */
  registry: SkillRegistry;
}

export class SkillLoader {
  private registry: SkillRegistry;

  constructor(options: SkillLoaderOptions) {
    this.registry = options.registry;
  }

  /** Register a single Skill instance into the registry */
  registerSkill(skill: BaseSkill): void {
    this.registry.register(skill);
  }

  /** Register multiple Skill instances at once */
  registerAll(skills: BaseSkill[]): void {
    this.registry.registerAll(skills);
  }

  /** Get the current number of registered skills */
  get count(): number {
    return this.registry.listNames().length;
  }

  /** List names of all registered skills */
  listNames(): string[] {
    return this.registry.listNames();
  }
}
