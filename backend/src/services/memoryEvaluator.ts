import { getSettings } from "../utils/settings";
import { logger } from "../utils/logger";

export interface MemoryEvaluationResult {
  importance: number;
  knowledgeDensity: number;
  actionability: number;
  impactScope: number;
  timelessness: number;
  finalScore: number;
  starRating: number;
  level: "critical" | "high" | "medium" | "low";
  reason: string;
}

/**
 * Strict Multi-Dimensional Knowledge Evaluator
 * Calibrated to prevent score inflation and preserve headroom for top-tier knowledge.
 */
export function analyzeMemoryDimensions(title: string, content: string): MemoryEvaluationResult {
  const text = `${title}\n${content}`;
  const len = text.length;

  // 1. Core Importance (0.10 - 0.90)
  let coreScore = 0.35;
  if (/(?:核心架构公理|不可违背公理|全局安全底层|零信任根|core-invariant|security-axiom)/i.test(text)) {
    coreScore = 0.88;
  } else if (/(?:通信协议规约|全系统交互架构|核心设计模式|architecture|protocol)/i.test(text)) {
    coreScore = 0.68;
  } else if (/(?:规约|规范|流程|准则|机制|标准|rule|standard|workflow)/i.test(text)) {
    coreScore = 0.55;
  } else if (/(?:全功能实现|模块实现|集成验证|重构|feature|implementation)/i.test(text)) {
    coreScore = 0.42;
  } else if (/(?:部署完成|发布就绪|版本发布|环境配置|部署|桌面图标|快捷方式|release|deploy)/i.test(text)) {
    coreScore = 0.28;
  } else if (/(?:临时|测试|草稿|demo|temp|test)/i.test(text)) {
    coreScore = 0.18;
  }

  // 2. Knowledge Density (0.10 - 0.90)
  let densityScore = 0.30;
  if (len > 2000) densityScore = 0.85;
  else if (len > 1000) densityScore = 0.72;
  else if (len > 500) densityScore = 0.58;
  else if (len > 200) densityScore = 0.42;
  else densityScore = 0.25;

  if (/\`\`\`[\s\S]*?\`\`\`/.test(text)) densityScore = Math.min(0.90, densityScore + 0.10);
  if (/(?:API|HTTP|SQL|SQLite|MQTT|OAuth|JWT|JSON|REST|POST|GET|Docker|Node|Python|React|TypeScript|Electron|LLM|MCP)/i.test(text)) {
    densityScore = Math.min(0.90, densityScore + 0.08);
  }

  // 3. Actionability / Reusability (0.10 - 0.90)
  let actionScore = 0.30;
  if (/(?:排查流程|标准排查手册|故障恢复手册|troubleshooting|runbook)/i.test(text)) {
    actionScore = 0.80;
  } else if (/(?:步骤|必须|严禁|杜绝|标准操作|检查项|checklist|procedure|rule)/i.test(text)) {
    actionScore = 0.65;
  } else if (/(?:配置方法|使用规范|操作指南|guide)/i.test(text)) {
    actionScore = 0.52;
  } else if (/(?:功能实现|支持特性|features)/i.test(text)) {
    actionScore = 0.40;
  } else if (/(?:完成|已就绪|记录|log|部署)/i.test(text)) {
    actionScore = 0.25;
  }

  if (/(?:1\.|2\.|3\.|首先|其次|最后|->|=>)/.test(text)) actionScore = Math.min(0.90, actionScore + 0.08);

  // 4. Impact Scope (0.10 - 0.90)
  let impactScore = 0.30;
  if (/(?:跨组织|全生命周期|全生态|跨企业|global-ecosystem)/i.test(text)) {
    impactScore = 0.85;
  } else if (/(?:全系统|跨智能体|全平台|跨工具|system-wide|cross-tool|antigravity)/i.test(text)) {
    impactScore = 0.68;
  } else if (/(?:核心服务|数据层|知识库|Skills|图谱|服务商)/i.test(text)) {
    impactScore = 0.52;
  } else if (/(?:模块|组件|客户端|UI|前端|设置)/i.test(text)) {
    impactScore = 0.38;
  } else {
    impactScore = 0.22;
  }

  // 5. Timelessness (0.10 - 0.90)
  let timeScore = 0.40;
  if (/(?:不可变定律|基础物理规律|通用设计原则|timeless-law)/i.test(text)) {
    timeScore = 0.88;
  } else if (/(?:架构设计原则|长期最佳实践|避坑指南|规约|standard)/i.test(text)) {
    timeScore = 0.68;
  } else if (/(?:功能实现|模块设计)/i.test(text)) {
    timeScore = 0.45;
  } else if (/(?:部署完成|正式发布|发布就绪|版本|v\d+\.\d+\.\d+|今天|刚刚|milestone|安装部署)/i.test(text)) {
    timeScore = 0.20;
  }

  // Weighted formula:
  // Importance: 30%, Density: 20%, Actionability: 20%, Impact: 15%, Timelessness: 15%
  const rawScore = coreScore * 0.30 + densityScore * 0.20 + actionScore * 0.20 + impactScore * 0.15 + timeScore * 0.15;
  const finalScore = Number(rawScore.toFixed(2));

  let starRating = 3;
  let level: "critical" | "high" | "medium" | "low" = "medium";

  // Strict thresholds preserving headroom for top-tier master knowledge
  if (finalScore >= 0.90) {
    starRating = 5;
    level = "critical";
  } else if (finalScore >= 0.72) {
    starRating = 4;
    level = "high";
  } else if (finalScore >= 0.45) {
    starRating = 3;
    level = "medium";
  } else if (finalScore >= 0.25) {
    starRating = 2;
    level = "low";
  } else {
    starRating = 1;
    level = "low";
  }

  const reason = `核心重要性: ${Math.round(coreScore * 100)}% | 知识密度: ${Math.round(densityScore * 100)}% | 可操作性: ${Math.round(actionScore * 100)}% | 影响范围: ${Math.round(impactScore * 100)}% | 长期价值: ${Math.round(timeScore * 100)}%`;

  return {
    importance: coreScore,
    knowledgeDensity: densityScore,
    actionability: actionScore,
    impactScope: impactScore,
    timelessness: timeScore,
    finalScore,
    starRating,
    level,
    reason,
  };
}
