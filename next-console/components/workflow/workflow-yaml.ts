/**
 * 工作流 YAML 解析与构建工具
 */

import type { WorkflowData, WorkflowStep } from "./workflow-types";

/** 生成步骤 ID */
export function generateStepId(): string {
  return `step${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** 从 WorkflowData 生成 YAML */
export function buildWorkflowYaml(data: WorkflowData): string {
  const lines: string[] = [];

  // 元信息
  lines.push(`name: ${JSON.stringify(data.name || "未命名工作流")}`);
  if (data.description) {
    lines.push(`description: ${JSON.stringify(data.description)}`);
  }
  if (data.catalog) {
    lines.push(`catalog: ${JSON.stringify(data.catalog)}`);
  }
  lines.push(`status: ${JSON.stringify(data.status || "draft")}`);
  lines.push(`version: ${JSON.stringify(data.version || "1.0")}`);

  // 标签
  if (data.tags.length > 0) {
    lines.push("tags:");
    for (const tag of data.tags) {
      lines.push(`  - ${JSON.stringify(tag)}`);
    }
  }

  // 步骤
  if (data.steps.length > 0) {
    lines.push("");
    lines.push("steps:");
    for (const step of data.steps) {
      lines.push(`  - id: ${JSON.stringify(step.id)}`);
      lines.push(`    title: ${JSON.stringify(step.title || "未命名步骤")}`);
      if (step.description) {
        lines.push(`    description: ${JSON.stringify(step.description)}`);
      }
      lines.push(`    language: ${JSON.stringify(step.language || "bash")}`);
      if (step.code) {
        lines.push("    code: |");
        for (const codeLine of step.code.split("\n")) {
          lines.push(`      ${codeLine}`);
        }
      } else {
        lines.push("    code: \"\"");
      }
    }
  }

  return lines.join("\n");
}

/** 解析 YAML 为 WorkflowData（简单解析） */
export function parseWorkflowYaml(yaml: string): WorkflowData {
  const data: WorkflowData = {
    name: "",
    description: "",
    catalog: "",
    status: "draft",
    version: "1.0",
    tags: [],
    steps: [],
  };

  const lines = yaml.split("\n");

  let currentKey: string | null = null;
  let currentStep: WorkflowStep | null = null;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 处理代码块
    if (inCodeBlock && currentStep) {
      if (line.startsWith("      ") && !line.match(/^ {0,5}\S/)) {
        codeLines.push(line.slice(6));
        continue;
      } else {
        currentStep.code = codeLines.join("\n");
        inCodeBlock = false;
        codeLines = [];
      }
    }

    // 顶级字段
    const keyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
    if (keyMatch && !line.startsWith("  ")) {
      const [, key, value] = keyMatch;
      currentKey = key;
      currentStep = null;

      if (key === "name" || key === "description" || key === "catalog" || key === "status" || key === "version") {
        try {
          data[key] = JSON.parse(value);
        } catch {
          data[key] = value;
        }
      }
    }
    // 标签数组项
    else if (trimmed.startsWith("- ") && currentKey === "tags") {
      let tag = trimmed.slice(2).trim();
      try {
        tag = JSON.parse(tag);
      } catch {}
      if (typeof tag === "string") {
        data.tags.push(tag);
      }
    }
    // 步骤
    else if (trimmed.startsWith("- id:") && currentKey === "steps") {
      const idMatch = trimmed.match(/- id:\s*(.*)$/);
      if (idMatch) {
        currentStep = {
          id: idMatch[1].trim().replace(/"/g, ""),
          title: "",
          description: "",
          language: "bash",
          code: "",
        };
        data.steps.push(currentStep);
      }
    }
    // 步骤属性
    else if (line.startsWith("    ") && currentStep) {
      const stepKeyMatch = trimmed.match(/^(\w+):\s*(.*)$/);
      if (stepKeyMatch) {
        const [, key, value] = stepKeyMatch;
        if (key === "title") {
          try {
            currentStep.title = JSON.parse(value);
          } catch {
            currentStep.title = value;
          }
        } else if (key === "description") {
          try {
            currentStep.description = JSON.parse(value);
          } catch {
            currentStep.description = value;
          }
        } else if (key === "language") {
          try {
            currentStep.language = JSON.parse(value);
          } catch {
            currentStep.language = value;
          }
        } else if (key === "code") {
          if (value === "|") {
            inCodeBlock = true;
            codeLines = [];
          } else {
            try {
              currentStep.code = JSON.parse(value);
            } catch {
              currentStep.code = value;
            }
          }
        }
      }
    }
  }

  return data;
}