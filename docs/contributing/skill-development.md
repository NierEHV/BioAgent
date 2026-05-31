# BioAgent Skill 开发指南

## 概述

Skill 是 BioAgent 的最小分析单元。每个 Skill 封装一个生物信息学分析步骤，
遵循 **6-phase pipeline** 模式，带有强制 QC 门控。

## 6-Phase Pipeline

```
validate → select-tool → config-params → execute → qc → format-output
```

### Phase 1: validate (输入校验)
- 使用 `zod` schema 校验所有输入参数
- 验证文件格式、路径存在性、参数范围
- 返回 `ValidationResult { valid: boolean; errors: string[] }`

### Phase 2: select-tool (工具选择)
- 根据输入数据特征选择最优工具
- 返回 `ToolChoice { tool: string; action: string; reason: string }`
- 考虑因素：数据规模、批次效应、计算资源

### Phase 3: config-params (参数配置)
- 根据数据特征配置工具参数
- 从知识库查询最佳参数
- 返回完整的 `ExecConfig` 或命令字符串

### Phase 4: execute (执行)
- 通过 `docker_exec` 在容器内执行命令
- 监控执行状态、收集 stdout/stderr
- 超时控制（默认 10 分钟，可配置）

### Phase 5: qc (质量控制)
- 执行 QC 门控检查
- 检查输出文件完整性、数值合理性
- 返回 `QCReport { passed: boolean; gates: QCGateResult[] }`

### Phase 6: format-output (格式化输出)
- 格式化为标准 `SkillResult`
- 包含输出文件路径、摘要、QC 报告
- 为下游 Skill 提供标准化输入

## 创建新 Skill

### 1. 文件位置

```
packages/skills/src/<category>/<skill-name>.skill.ts
```

分类目录：
| 目录 | 用途 |
|------|------|
| `io/` | 数据导入/导出 |
| `qc/` | 质量控制 |
| `preprocess/` | 预处理（归一化、HVG、PCA、批次校正） |
| `embed/` | 嵌入和降维 |
| `cluster/` | 聚类 |
| `annotate/` | 细胞注释 |
| `analysis/` | 下游分析（marker、差异表达、富集、轨迹、通讯） |
| `network/` | 网络推断（GRN） |
| `report/` | 报告生成 |

### 2. 代码模板

```typescript
import { BaseSkill } from "../base-skill.js";
import type { SkillSpec, SkillContext, SkillResult, QCGate, ToolChoice } from "../base-skill.types.js";
import { z } from "zod";

// 1. 定义参数 schema
const paramsSchema = z.object({
  input_path: z.string().describe("Path to input data"),
  output_path: z.string().describe("Path for output files"),
  container: z.string().describe("Docker container name"),
});

type MyParams = z.infer<typeof paramsSchema>;

// 2. 定义 Skill 规格
const spec: SkillSpec = {
  name: "my-skill",
  version: "1.0.0",
  description: "What this skill does",
  omics: "scrna-seq",
  phase: "analysis",
  dependencies: ["previous-skill-name"],
  paramsSchema,
  estimatedRuntime: "5 min / 10k cells",
  checkpoint: true,
};

// 3. 定义 QC 门控
const QC_GATES: QCGate[] = [
  {
    name: "output_exists",
    description: "Output file was created and is non-empty",
    check: (output: string) => output.includes("success") && !output.includes("Error"),
    severity: "error",
    fix: "Check the command syntax and input file availability.",
  },
];

// 4. 实现 Skill 类
export class MySkill extends BaseSkill {
  constructor() {
    super(spec, QC_GATES);
  }

  protected getToolChoice(context: SkillContext): ToolChoice {
    return {
      tool: "docker_exec",
      action: "exec",
      reason: "Run analysis in Docker container",
    };
  }

  protected buildCommand(params: MyParams, context: SkillContext): string {
    return `python -c "
# Analysis code here
print('success')
"`;
  }

  protected formatOutput(result: SkillResult): SkillResult {
    return {
      ...result,
      outputs: [{
        name: "output",
        path: `${result.params?.output_path}/output.h5ad`,
        format: "h5ad",
        description: "Analysis result in AnnData format",
      }],
    };
  }
}
```

### 3. 注册 Skill

在 `packages/skills/src/index.ts` 中导出你的 Skill：

```typescript
export { MySkill } from "./<category>/<skill-name>.skill.js";
```

### 4. 编写测试

```typescript
// packages/skills/__tests__/<skill-name>.test.ts
import { describe, it, expect } from "vitest";
import { MySkill } from "../src/<category>/<skill-name>.skill.js";

describe("MySkill", () => {
  it("has valid spec", () => {
    const skill = new MySkill();
    expect(skill.spec.name).toBe("my-skill");
    expect(skill.spec.omics).toBe("scrna-seq");
  });

  it("validates params", async () => {
    const skill = new MySkill();
    const result = await skill.validate({});
    expect(result.valid).toBe(false); // missing required params
  });

  it("generates correct command", () => {
    const skill = new MySkill();
    const cmd = skill["buildCommand"]({
      input_path: "/data/test.h5ad",
      output_path: "/data/output",
      container: "test",
    }, {} as any);
    expect(cmd).toContain("python");
  });
});
```

## QC Gate 规范

### Severity 级别

| 级别 | 含义 | 行为 |
|------|------|------|
| `error` | 致命错误 | 终止 Skill，标记失败 |
| `warning` | 潜在问题 | 继续执行，记录警告 |
| `info` | 信息性检查 | 记录到日志，不影响执行 |

### QC Gate 函数签名

```typescript
interface QCGate {
  name: string;
  description: string;
  check: (output: string) => boolean;
  severity: "error" | "warning" | "info";
  fix: string;
}
```

## 最佳实践

1. **所有参数用 zod schema 定义** — 不要手动校验
2. **QC gate 要具体** — 不依赖 "看起来 OK" 的判断
3. **依赖声明清晰** — `dependencies` 数组声明前置 Skill
4. **estimatedRuntime 要诚实** — 帮助 Workflow 调度
5. **checkpoint: true** 用于耗时长的 Skill，支持失败恢复
6. **formatOutput 产生标准格式** — 方便下游 Skill 消费
