import { Router, Request, Response } from "express";
import { sessionStore, vectorStore, graphStore, memoryStore } from "../services/storage";
import { logger } from "../utils/logger";
import { isValidSessionId } from "../utils/validators";
import path from "path";
import os from "os";
import fs from "fs";

const router = Router();

// Helper to safely read files
function safeReadFile(p: string): string | null {
  try {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch {}
  return null;
}

// Helper to convert Antigravity transcript.jsonl into clean readable Markdown and turns
function parseAntigravityTranscript(content: string, convId: string, mtime: Date): {
  id: string;
  projectName: string;
  platform: string;
  title: string;
  markdown: string;
  messageCount: number;
  updatedAt: string;
  messages: { role: "User" | "Assistant"; text: string; time?: string }[];
} {
  const lines = content.split("\n").filter(Boolean);
  let title = "";
  let projectName = "Antigravity";
  const messages: { role: "User" | "Assistant"; text: string; time?: string }[] = [];

  // Check user_information / workspace
  const matchWorkspace = content.match(/->\s*([A-Za-z0-9_\-\.\/]+)/) || content.match(/AI-Project\\([A-Za-z0-9_\-]+)/i);
  if (matchWorkspace) {
    const rawP = matchWorkspace[1].split(/[\/\\]/).pop() || matchWorkspace[1];
    if (rawP && rawP.trim() && !rawP.includes("URI")) {
      projectName = rawP.trim();
    }
  }

  for (const l of lines) {
    try {
      const step = JSON.parse(l);
      if (step.type === "USER_INPUT" && step.content) {
        let text = step.content;
        const match = text.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
        if (match) {
          text = match[1].trim();
        } else {
          // Remove internal metadata tags
          text = text.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/g, "")
                     .replace(/<CONTEXT_SUMMARY>[\s\S]*?<\/CONTEXT_SUMMARY>/g, "")
                     .replace(/<user_information>[\s\S]*?<\/user_information>/g, "")
                     .trim();
        }
        if (text) {
          if (!title) {
            title = text.slice(0, 45).replace(/\n/g, " ");
          }
          messages.push({ role: "User", text });
        }
      } else if (step.type === "PLANNER_RESPONSE" && step.content) {
        let text = step.content;
        text = text.replace(/<thought>[\s\S]*?<\/thought>/g, "").trim();
        if (text) {
          messages.push({ role: "Assistant", text });
        }
      }
    } catch {}
  }

  const markdown = messages.map(m => `## ${m.role}\n${m.text}`).join("\n\n");
  const timeFormatted = mtime ? `${mtime.getMonth() + 1}月${mtime.getDate()}日` : "今天";

  return {
    id: `antigravity_${convId}`,
    projectName,
    platform: "Antigravity",
    title: title || `Antigravity 对话 (${convId.slice(0, 8)})`,
    markdown: markdown || content.slice(0, 5000),
    messageCount: messages.length || 2,
    updatedAt: timeFormatted,
    messages,
  };
}

// GET /api/session/scan-agents (Scan local AI agent conversations: Antigravity, Codex, Claude Code, Cursor)
router.get("/scan-agents", async (_req: Request, res: Response) => {
  try {
    const userHome = os.homedir();
    const discovered: any[] = [];
    const existingSessions = await sessionStore.getSessions();
    const existingNames = new Set(existingSessions.map(s => s.projectName));

    // 1. Scan Nowledge Mem / Antigravity unsynced queue
    const unsyncedPath = path.join(userHome, ".nowledge-mem", "plugins", "antigravity", "unsynced.json");
    if (fs.existsSync(unsyncedPath)) {
      try {
        const raw = fs.readFileSync(unsyncedPath, "utf-8");
        const unsyncedMap = JSON.parse(raw);
        for (const [id, item] of Object.entries<any>(unsyncedMap)) {
          const itemTitle = item.title || item.summary || "Antigravity Session";
          discovered.push({
            id: `antigravity_${id}`,
            platform: "Antigravity",
            projectName: "Antigravity",
            title: itemTitle,
            messageCount: Array.isArray(item.messages) ? item.messages.length : (item.messageCount || 10),
            updatedAt: "今天",
            rawText: Array.isArray(item.messages) 
              ? item.messages.map((m: any) => `## ${m.role || 'User'}\n${m.content || ''}`).join("\n\n")
              : (item.content || ""),
            messages: Array.isArray(item.messages)
              ? item.messages.map((m: any) => ({ role: m.role === "assistant" ? "Assistant" : "User", text: m.content || "" }))
              : [{ role: "User", text: item.content || "" }],
            sourcePath: unsyncedPath,
            imported: existingNames.has(itemTitle),
          });
        }
      } catch (err) {
        logger.warn("[Scanner] Failed to parse unsynced.json", err);
      }
    }

    // 2. Scan Google Antigravity Brain logs directory
    const brainDir = path.join(userHome, ".gemini", "antigravity", "brain");
    if (fs.existsSync(brainDir)) {
      try {
        const entries = fs.readdirSync(brainDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name === "tempmediaStorage") continue;
          if (discovered.some(d => d.id === `antigravity_${entry.name}`)) continue;

          const transcriptPath = path.join(brainDir, entry.name, ".system_generated", "logs", "transcript.jsonl");
          if (fs.existsSync(transcriptPath)) {
            try {
              const stat = fs.statSync(transcriptPath);
              const content = fs.readFileSync(transcriptPath, "utf-8");
              const parsed = parseAntigravityTranscript(content, entry.name, stat.mtime);

              discovered.push({
                id: parsed.id,
                platform: parsed.platform,
                projectName: parsed.projectName,
                title: parsed.title,
                messageCount: parsed.messageCount,
                updatedAt: parsed.updatedAt,
                sourcePath: transcriptPath,
                rawText: parsed.markdown,
                messages: parsed.messages,
                imported: existingNames.has(parsed.title),
              });
            } catch {}
          }
        }
      } catch (err) {
        logger.warn("[Scanner] Failed to scan Antigravity brain dir", err);
      }
    }

    // 3. Scan Claude Code / Codex if present
    const codexDir = path.join(userHome, ".codex", "sessions");
    if (fs.existsSync(codexDir)) {
      try {
        const files = fs.readdirSync(codexDir).filter(f => f.endsWith(".json") || f.endsWith(".md"));
        for (const f of files.slice(0, 15)) {
          const fp = path.join(codexDir, f);
          const stat = fs.statSync(fp);
          const fTitle = f.replace(/\.[^.]+$/, "");
          discovered.push({
            id: `codex_${f}`,
            platform: "Codex",
            projectName: "CodexBridge",
            title: fTitle,
            messageCount: 12,
            updatedAt: `${stat.mtime.getMonth() + 1}月${stat.mtime.getDate()}日`,
            sourcePath: fp,
            rawText: fs.readFileSync(fp, "utf-8"),
            messages: [{ role: "User", text: fs.readFileSync(fp, "utf-8") }],
            imported: existingNames.has(fTitle),
          });
        }
      } catch {}
    }

    // Group by projectName
    const groupMap = new Map<string, any>();
    for (const s of discovered) {
      const p = s.projectName || s.platform || "Default";
      if (!groupMap.has(p)) {
        groupMap.set(p, {
          projectName: p,
          platform: s.platform,
          totalMessages: 0,
          sessions: [],
          importedCount: 0,
        });
      }
      const g = groupMap.get(p)!;
      g.sessions.push(s);
      g.totalMessages += s.messageCount;
      if (s.imported) g.importedCount++;
    }

    const groups = Array.from(groupMap.values());

    res.json({
      success: true,
      totalDiscovered: discovered.length,
      totalProjects: groups.length,
      groups,
      sessions: discovered,
    });
  } catch (err: any) {
    logger.error("Scan agents failed:", err?.message);
    res.status(500).json({ error: "Failed to scan agent sessions" });
  }
});

// POST /api/session/import-agent-session
router.post("/import-agent-session", async (req: Request, res: Response) => {
  const { sessions } = req.body;
  if (!sessions || !Array.isArray(sessions)) {
    res.status(400).json({ error: "Invalid sessions array" });
    return;
  }

  try {
    let importedCount = 0;
    const errors: string[] = [];

    for (const s of sessions) {
      try {
        const projectName = s.title || s.projectName || "Agent 对话记录";
        const platform = (s.platform || "gemini").toLowerCase().replace(/\s+/g, "_");
        const rawText = s.rawText || `## User\n${projectName}\n\n### Assistant\n已通过智能体连接器同步。`;
        const messageCount = s.messageCount || (Array.isArray(s.messages) ? s.messages.length : 6);

        const created = await sessionStore.createSession(projectName, platform);
        if (created && created._id) {
          await sessionStore.saveFullChat(created._id, rawText, messageCount, platform);
          
          // Auto-distill memory entry into memories table
          try {
            await memoryStore.createMemory({
              sessionId: created._id,
              title: projectName.slice(0, 50),
              content: rawText.slice(0, 800),
              importance: 0.55,
              category: "Note",
              unitType: "context",
              tags: [s.platform || "Antigravity", "Imported"],
              source: "agent_import",
            });
          } catch (mErr: any) {
            logger.warn(`[Session] Auto-memory create warning for "${projectName}":`, mErr?.message || mErr);
          }

          importedCount++;
        }
      } catch (itemErr: any) {
        logger.warn(`[Session] Failed to import session "${s?.title}":`, itemErr?.message || itemErr);
        errors.push(itemErr?.message || "Unknown item error");
      }
    }

    logger.success(`[Session] Successfully imported ${importedCount}/${sessions.length} agent session(s)`);
    res.json({
      success: true,
      importedCount,
      totalRequested: sessions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    logger.error("Import agent sessions error:", err?.message || err);
    res.status(500).json({ error: "Failed to import agent sessions: " + (err?.message || "Unknown error") });
  }
});

// POST /api/session/import-markdown
router.post("/import-markdown", async (req: Request, res: Response) => {
  const { projectName, platform = "markdown", rawText } = req.body;
  if (!projectName || !rawText) {
    res.status(400).json({ error: "projectName and rawText are required" });
    return;
  }

  try {
    const lines = rawText.split("\n");
    const messageCount = (rawText.match(/##\s+(User|Assistant|Human|AI)/gi) || []).length || Math.max(2, Math.round(lines.length / 10));

    const created = await sessionStore.createSession(projectName, platform);
    if (created && created._id) {
      await sessionStore.saveFullChat(created._id, rawText, messageCount, platform);

      // Auto-distill memory entry into memories table
      try {
        await memoryStore.createMemory({
          sessionId: created._id,
          title: projectName.slice(0, 50),
          content: rawText.slice(0, 800),
          importance: 0.55,
          category: "Note",
          unitType: "context",
          tags: ["Markdown", "Imported"],
          source: "markdown_import",
        });
      } catch (mErr: any) {
        logger.warn(`[Session] Auto-memory create warning for markdown "${projectName}":`, mErr?.message || mErr);
      }
    }

    res.json({ success: true, sessionId: created._id });
  } catch (err: any) {
    logger.error("Import markdown error:", err?.message || err);
    res.status(500).json({ error: "Failed to import markdown: " + (err?.message || "Unknown error") });
  }
});

// GET /api/session/export/:id
router.get("/export/:id", async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id || !isValidSessionId(id as string)) {
    res.status(400).json({ error: "Invalid sessionId" });
    return;
  }

  const sessionId = id as string;

  try {
    const session = await sessionStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const fullChat = await sessionStore.getFullChat(sessionId);
    const facts = await graphStore.getTriplesBySession(sessionId);

    const exportData = {
      version: "1.6.3",
      timestamp: new Date().toISOString(),
      session,
      fullChat,
      facts
    };

    const safeName = (session.projectName || "session")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="ChronosMind-${safeName}.json"`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (err) {
    logger.error("Export error:", err);
    res.status(500).json({ error: "Failed to export session" });
  }
});

// POST /api/session/import
router.post("/import", async (req: Request, res: Response) => {
  const data = req.body;

  if (!data || !data.session) {
    res.status(400).json({ error: "Invalid import data" });
    return;
  }

  try {
    const { session, fullChat, facts } = data;

    const newSession = await sessionStore.createSession(session.projectName, session.platform);
    const newId = newSession._id;

    if (fullChat) {
      await sessionStore.saveFullChat(newId, fullChat.rawText, fullChat.messageCount, fullChat.platform);
    }

    if (facts && Array.isArray(facts)) {
      for (const f of facts) {
        await graphStore.saveTriple({
          subject: f.subject,
          subjectType: f.subjectType || "Entity",
          relation: f.relation,
          object: f.object,
          objectType: f.objectType || "Entity",
          sessionId: newId,
          timestamp: f.timestamp || new Date().toISOString()
        });
      }
    }

    logger.success(`Imported session: ${session.projectName} (New ID: ${newId})`);
    res.json({ success: true, sessionId: newId });
  } catch (err) {
    logger.error("Import error:", err);
    res.status(500).json({ error: "Failed to import session" });
  }
});

export default router;
