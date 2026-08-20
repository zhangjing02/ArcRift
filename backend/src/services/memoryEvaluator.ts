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
  shouldDistill: boolean;
}

export interface MemoryDistillGateResult {
  shouldDistill: boolean;
  score: number;
  starRating: number;
  reason: string;
  category: "Architecture" | "Decision" | "Gotcha" | "Rule" | "Tech" | "Note";
}

/**
 * Memory Value Gating & Frequency Reduction Standard
 *
 * Guidelines for Agents:
 * - PRESERVE ONLY:
 *   1. Major architectural milestones & design decisions.
 *   2. Breakthrough complex bug root-cause analysis & non-obvious gotchas with concrete solutions.
 *   3. Non-negotiable security axioms, invariant rules, and cross-agent communication protocols.
 *   4. User explicit commands (/save, 存入记忆, CM, 保存记忆, 存档, 记录总结).
 *
 * - NEVER PRESERVE:
 *   1. Raw chat dialogue transcripts (stored in full_chats & vector chunks, NOT memory table).
 *   2. Daily minor fixes, typos, UI padding adjustments, routine chores.
 *   3. Conversational pleasantries, status checks, temporary scratch notes.
 */
export function evaluateMemoryDistillGating(
  title: string,
  content: string,
  options?: {
    source?: string;
    category?: string;
    isExplicitUserSave?: boolean;
  }
): MemoryDistillGateResult {
  const text = `${title}\n${content}`;

  // 1. Explicit user directive always passes gating
  if (
    options?.isExplicitUserSave ||
    /(?:^\/(?:save|cm)|保存记忆|存入记忆|存档|记录总结)/i.test(text)
  ) {
    const analysis = analyzeMemoryDimensions(title, content);
    return {
      shouldDistill: true,
      score: Math.max(0.70, analysis.finalScore),
      starRating: Math.max(4, analysis.starRating),
      reason: "用户显式指令要求存入记忆",
      category: (options?.category as any) || "Decision",
    };
  }

  // 2. Filter out raw dialogue / chat dumps
  if (
    /(?:^## (?:User|Assistant|Human|AI)|<USER_REQUEST>|<thought>|智能体连接器同步)/i.test(text) &&
    !/(?:核心架构|根本原因|排查手册|解决方案|公理)/.test(text)
  ) {
    return {
      shouldDistill: false,
      score: 0.20,
      starRating: 1,
      reason: "拒绝原始对话流/未提炼的日志",
      category: "Note",
    };
  }

  // 3. Filter out trivial noise & pleasantries
  if (text.length < 30 && /(?:好的|收到|明白了|测试|demo|hello|hi|ok)/i.test(text)) {
    return {
      shouldDistill: false,
      score: 0.15,
      starRating: 1,
      reason: "文本过短且缺乏复用价值知识",
      category: "Note",
    };
  }

  // 4. Multi-dimensional evaluation
  const analysis = analyzeMemoryDimensions(title, content);

  // Category determination
  let category: "Architecture" | "Decision" | "Gotcha" | "Rule" | "Tech" | "Note" = "Note";
  if (/(?:架构|设计模式|architecture|公理|底层|axiom)/i.test(text)) {
    category = "Architecture";
  } else if (/(?:排查|gotcha|踩坑|根因|root cause|bug fix|修复方案)/i.test(text)) {
    category = "Gotcha";
  } else if (/(?:规约|规范|准则|机制|rule|standard)/i.test(text)) {
    category = "Rule";
  } else if (/(?:决策|选型|方案决策|decision)/i.test(text)) {
    category = "Decision";
  } else if (/(?:API|协议|算法|tech|实现)/i.test(text)) {
    category = "Tech";
  }

  // Gating threshold: finalScore >= 0.65 for automatic memory creation
  const shouldDistill = analysis.finalScore >= 0.65;

  return {
    shouldDistill,
    score: analysis.finalScore,
    starRating: analysis.starRating,
    reason: shouldDistill
      ? `符合高价值记忆门控准则 (${analysis.reason})`
      : `未达到沉淀门槛 (评分 ${analysis.finalScore} < 0.65, ${analysis.reason})`,
    category,
  };
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
    coreScore = 0.75;
  } else if (/(?:规约|规范|流程|准则|机制|标准|rule|standard|workflow)/i.test(text)) {
    coreScore = 0.65;
  } else if (/(?:根因剖析|突破性修复|故障排查手册|踩坑总结|gotcha|troubleshooting)/i.test(text)) {
    coreScore = 0.70;
  } else if (/(?:全功能实现|模块实现|集成验证|重构|feature|implementation)/i.test(text)) {
    coreScore = 0.45;
  } else if (/(?:部署完成|发布就绪|版本发布|环境配置|部署|桌面图标|快捷方式|release|deploy)/i.test(text)) {
    coreScore = 0.28;
  } else if (/(?:临时|测试|草稿|demo|temp|test|好的|收到)/i.test(text)) {
    coreScore = 0.15;
  }

  // 2. Knowledge Density (0.10 - 0.90)
  let densityScore = 0.30;
  if (len > 2000) densityScore = 0.85;
  else if (len > 1000) densityScore = 0.72;
  else if (len > 500) densityScore = 0.58;
  else if (len > 200) densityScore = 0.42;
  else densityScore = 0.22;

  if (/\`\`\`[\s\S]*?\`\`\`/.test(text)) densityScore = Math.min(0.90, densityScore + 0.12);
  if (/(?:API|HTTP|SQL|SQLite|MQTT|OAuth|JWT|JSON|REST|POST|GET|Docker|Node|Python|React|TypeScript|Electron|LLM|MCP)/i.test(text)) {
    densityScore = Math.min(0.90, densityScore + 0.08);
  }

  // 3. Actionability / Reusability (0.10 - 0.90)
  let actionScore = 0.30;
  if (/(?:排查流程|标准排查手册|故障恢复手册|troubleshooting|runbook|根因剖析)/i.test(text)) {
    actionScore = 0.85;
  } else if (/(?:步骤|必须|严禁|杜绝|标准操作|检查项|checklist|procedure|rule)/i.test(text)) {
    actionScore = 0.70;
  } else if (/(?:配置方法|使用规范|操作指南|guide)/i.test(text)) {
    actionScore = 0.55;
  } else if (/(?:功能实现|支持特性|features)/i.test(text)) {
    actionScore = 0.40;
  } else if (/(?:完成|已就绪|记录|log|部署)/i.test(text)) {
    actionScore = 0.22;
  }

  if (/(?:1\.|2\.|3\.|首先|其次|最后|->|=>)/.test(text)) actionScore = Math.min(0.90, actionScore + 0.08);

  // 4. Impact Scope (0.10 - 0.90)
  let impactScore = 0.30;
  if (/(?:跨组织|全生命周期|全生态|跨企业|global-ecosystem)/i.test(text)) {
    impactScore = 0.85;
  } else if (/(?:全系统|跨智能体|全平台|跨工具|system-wide|cross-tool|antigravity|chronosmind)/i.test(text)) {
    impactScore = 0.72;
  } else if (/(?:核心服务|数据层|知识库|Skills|图谱|服务商)/i.test(text)) {
    impactScore = 0.55;
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
    timeScore = 0.72;
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
  if (finalScore >= 0.85) {
    starRating = 5;
    level = "critical";
  } else if (finalScore >= 0.70) {
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
    shouldDistill: finalScore >= 0.65,
  };
}
