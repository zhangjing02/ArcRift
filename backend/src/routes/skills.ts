import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import os from "os";
import { getSqlite } from "../services/sqlite";
import { logger } from "../utils/logger";

const router = Router();

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  trigger: string;
  steps: string;
  sourceTool: string;
  sourcePath: string;
  enabled: boolean;
  tools: string[];
  category: string;
  rawMarkdown: string;
  createdAt?: string;
  updatedAt?: string;
}

function parseSkillMd(filePath: string, toolName: string): AgentSkill | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    let dirName = path.basename(path.dirname(filePath));
    let name = dirName;
    let description = "";
    let body = raw;

    if (raw.startsWith("---")) {
      const parts = raw.split("---");
      if (parts.length >= 3) {
        const front = parts[1];
        body = parts.slice(2).join("---").trim();
        const lines = front.split("\n");
        for (const l of lines) {
          const colonIdx = l.indexOf(":");
          if (colonIdx > 0) {
            const key = l.slice(0, colonIdx).trim().toLowerCase();
            let val = l.slice(colonIdx + 1).trim();
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1);
            }
            if (key === "name") name = val;
            if (key === "description") description = val;
          }
        }
      }
    }

    // Determine trigger and steps
    let trigger = "当智能体匹配技能描述或处理相关任务时自动触发";
    const bodyLines = body.split("\n");
    for (const l of bodyLines) {
      const clean = l.replace(/^[#>*-\s:]+/, "").trim();
      if (/^(触发|trigger|when|适用场景|适用范围)/i.test(clean) && clean.length > 4 && clean.length < 160) {
        trigger = clean;
        break;
      }
    }

    // Determine category
    let category = "工作流与规范";
    const n = (name + " " + description).toLowerCase();
    if (n.includes("invest") || n.includes("financ") || n.includes("stock") || n.includes("earn") || n.includes("portfolio")) {
      category = "金融与投资研报";
    } else if (n.includes("android") || n.includes("compose") || n.includes("ui") || n.includes("xml") || n.includes("style")) {
      category = "移动端开发与架构";
    } else if (n.includes("git") || n.includes("pr") || n.includes("review") || n.includes("deploy") || n.includes("workflow")) {
      category = "工程效能与流程";
    } else if (n.includes("bio") || n.includes("gene") || n.includes("protein") || n.includes("chem")) {
      category = "生命科学与数据";
    }

    const safeId = `skill_${toolName.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_")}`;

    const cleanBodySnippet = body
      .replace(/^#+\s+[^\n]+/gm, "")
      .replace(/\n+/g, " ")
      .trim()
      .slice(0, 240);

    return {
      id: safeId,
      name: name || dirName,
      description: description || name,
      trigger,
      steps: cleanBodySnippet ? `${cleanBodySnippet}...` : "遵循既定最佳实践规范",
      sourceTool: toolName,
      sourcePath: filePath,
      enabled: true,
      tools: [toolName],
      category,
      rawMarkdown: raw,
    };
  } catch (err) {
    return null;
  }
}

function scanAllAgentSkills(): AgentSkill[] {
  const home = os.homedir();
  const list: AgentSkill[] = [];

  const scanDirs = [
    { dir: path.join(home, ".gemini", "config", "skills"), tool: "Google Antigravity" },
    { dir: path.join(home, ".gemini", "config", "plugins"), tool: "Gemini Plugins" },
    { dir: path.join(home, ".gemini", "antigravity", "builtin", "skills"), tool: "Google Antigravity" },
    { dir: path.join(home, ".codex", "skills"), tool: "Codex" },
    { dir: path.join(home, ".claude", "skills"), tool: "Claude Code" },
    { dir: path.join(home, ".kiro", "skills"), tool: "Kiro CLI" },
  ];

  for (const s of scanDirs) {
    if (!fs.existsSync(s.dir)) continue;
    try {
      const entries = fs.readdirSync(s.dir);
      for (const e of entries) {
        const full = path.join(s.dir, e);
        if (fs.statSync(full).isDirectory()) {
          const directMd = path.join(full, "SKILL.md");
          if (fs.existsSync(directMd)) {
            const item = parseSkillMd(directMd, s.tool);
            if (item) list.push(item);
          } else {
            try {
              const subs = fs.readdirSync(full);
              for (const sub of subs) {
                const subFull = path.join(full, sub);
                if (fs.statSync(subFull).isDirectory()) {
                  const subMd = path.join(subFull, "SKILL.md");
                  if (fs.existsSync(subMd)) {
                    const item = parseSkillMd(subMd, s.tool);
                    if (item) list.push(item);
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed scanning skills in ${s.dir}:`, err);
    }
  }

  const uniqueMap = new Map<string, AgentSkill>();
  for (const item of list) {
    const key = `${item.sourceTool}_${item.name}`.toLowerCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values());
}

// GET /api/skills
router.get("/", (req: Request, res: Response) => {
  try {
    const db = getSqlite();
    const { search, enabled, category } = req.query;

    let sql = "SELECT * FROM skills WHERE 1=1";
    const params: any[] = [];

    if (search) {
      sql += " AND (name LIKE ? OR description LIKE ? OR trigger LIKE ? OR category LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (enabled !== undefined) {
      sql += " AND enabled = ?";
      params.push(enabled === "true" || enabled === "1" ? 1 : 0);
    }

    if (category) {
      sql += " AND category = ?";
      params.push(category);
    }

    sql += " ORDER BY updatedAt DESC, createdAt DESC";

    const rows = db.prepare(sql).all(...params) as any[];
    const skills = rows.map((r) => ({
      ...r,
      enabled: r.enabled === 1,
      tools: r.tools ? JSON.parse(r.tools) : [r.sourceTool || "Antigravity"],
    }));

    res.json({
      success: true,
      count: skills.length,
      skills,
    });
  } catch (err) {
    logger.error("Failed to fetch skills:", err);
    res.status(500).json({ error: "Failed to fetch skills" });
  }
});

// GET /api/skills/scan-agents
router.get("/scan-agents", (_req: Request, res: Response) => {
  try {
    const scanned = scanAllAgentSkills();
    const db = getSqlite();

    const existingRows = db.prepare("SELECT id, name, sourceTool FROM skills").all() as any[];
    const existingMap = new Set(existingRows.map((r) => `${r.sourceTool}_${r.name}`.toLowerCase()));

    const scannedWithStatus = scanned.map((s) => ({
      ...s,
      isImported: existingMap.has(`${s.sourceTool}_${s.name}`.toLowerCase()),
    }));

    const byTool: Record<string, number> = {};
    for (const s of scanned) {
      byTool[s.sourceTool] = (byTool[s.sourceTool] || 0) + 1;
    }

    res.json({
      success: true,
      totalCount: scanned.length,
      byTool,
      skills: scannedWithStatus,
    });
  } catch (err) {
    logger.error("Failed to scan agent skills:", err);
    res.status(500).json({ error: "Failed to scan agent skills" });
  }
});

// POST /api/skills/import-from-agents
router.post("/import-from-agents", (req: Request, res: Response) => {
  try {
    const db = getSqlite();
    const { skillIds } = req.body;

    const scanned = scanAllAgentSkills();
    const toImport = Array.isArray(skillIds) && skillIds.length > 0
      ? scanned.filter((s) => skillIds.includes(s.id))
      : scanned;

    const now = new Date().toISOString();
    const insertStmt = db.prepare(`
      INSERT INTO skills (
        id, name, description, trigger, steps, sourceTool, sourcePath,
        enabled, tools, category, rawMarkdown, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        trigger = excluded.trigger,
        steps = excluded.steps,
        sourceTool = excluded.sourceTool,
        sourcePath = excluded.sourcePath,
        tools = excluded.tools,
        category = excluded.category,
        rawMarkdown = excluded.rawMarkdown,
        updatedAt = excluded.updatedAt
    `);

    let importedCount = 0;
    const runTransaction = db.transaction(() => {
      for (const item of toImport) {
        insertStmt.run(
          item.id,
          item.name,
          item.description,
          item.trigger,
          item.steps,
          item.sourceTool,
          item.sourcePath,
          item.enabled ? 1 : 0,
          JSON.stringify(item.tools || [item.sourceTool]),
          item.category,
          item.rawMarkdown,
          now,
          now
        );
        importedCount++;
      }
    });

    runTransaction();

    logger.success(`Successfully imported/synced ${importedCount} skills from agent environments into SQLite.`);

    res.json({
      success: true,
      importedCount,
      message: `已成功将 ${importedCount} 个 Agent 技能导入到 ChronosMind 知识库！`,
    });
  } catch (err) {
    logger.error("Failed to import agent skills:", err);
    res.status(500).json({ error: "Failed to import agent skills" });
  }
});

// POST /api/skills
router.post("/", (req: Request, res: Response) => {
  try {
    const db = getSqlite();
    const { name, description, trigger, steps, tools, category, rawMarkdown } = req.body;

    if (!name || !name.trim()) {
      res.status(400).json({ error: "Skill name is required" });
      return;
    }

    const now = new Date().toISOString();
    const id = `skill_user_${Date.now()}`;
    const toolsArr = Array.isArray(tools) ? tools : ["Google Antigravity", "Codex", "Gemini CLI"];

    db.prepare(`
      INSERT INTO skills (
        id, name, description, trigger, steps, sourceTool, sourcePath,
        enabled, tools, category, rawMarkdown, createdAt, updatedAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `).run(
      id,
      name.trim(),
      description || "自定义规范技能",
      trigger || "智能体自动匹配",
      steps || "遵循既定最佳实践规范",
      "UserCreated",
      "",
      1,
      JSON.stringify(toolsArr),
      category || "自定义技能",
      rawMarkdown || `# ${name}\n\n${description || ""}\n\n## 步骤\n${steps || ""}`,
      now,
      now
    );

    res.json({
      success: true,
      message: "技能创建成功",
      skillId: id,
    });
  } catch (err) {
    logger.error("Failed to create skill:", err);
    res.status(500).json({ error: "Failed to create skill" });
  }
});

// PUT /api/skills/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getSqlite();
    const { name, description, trigger, steps, tools, category, rawMarkdown } = req.body;

    const now = new Date().toISOString();
    const toolsJson = tools ? JSON.stringify(tools) : undefined;

    db.prepare(`
      UPDATE skills SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        trigger = COALESCE(?, trigger),
        steps = COALESCE(?, steps),
        tools = COALESCE(?, tools),
        category = COALESCE(?, category),
        rawMarkdown = COALESCE(?, rawMarkdown),
        updatedAt = ?
      WHERE id = ?
    `).run(name, description, trigger, steps, toolsJson, category, rawMarkdown, now, id);

    res.json({ success: true, message: "技能已更新" });
  } catch (err) {
    logger.error("Failed to update skill:", err);
    res.status(500).json({ error: "Failed to update skill" });
  }
});

// POST /api/skills/toggle/:id
router.post("/toggle/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getSqlite();

    const row = db.prepare("SELECT enabled FROM skills WHERE id = ?").get(id) as any;
    if (!row) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    const newEnabled = row.enabled === 1 ? 0 : 1;
    const now = new Date().toISOString();

    db.prepare("UPDATE skills SET enabled = ?, updatedAt = ? WHERE id = ?").run(newEnabled, now, id);

    res.json({
      success: true,
      enabled: newEnabled === 1,
      message: newEnabled === 1 ? "技能已启用" : "技能已禁用",
    });
  } catch (err) {
    logger.error("Failed to toggle skill:", err);
    res.status(500).json({ error: "Failed to toggle skill" });
  }
});

// DELETE /api/skills/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = getSqlite();

    db.prepare("DELETE FROM skills WHERE id = ?").run(id);

    res.json({ success: true, message: "技能已删除" });
  } catch (err) {
    logger.error("Failed to delete skill:", err);
    res.status(500).json({ error: "Failed to delete skill" });
  }
});

export default router;
