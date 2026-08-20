import { Router, Request, Response } from "express";
import { sessionStore, graphStore } from "../services/storage";
import { getSqlite } from "../services/sqlite";
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

// Helper to format date/time into 1:1 screenshot format
function formatSessionTime(date: Date): { formatted: string; relative: string; timestamp: number } {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Relative time
  let relative = "刚刚";
  if (diffHour < 1) {
    relative = diffMin <= 1 ? "刚刚" : `${diffMin} minutes ago`;
  } else if (diffHour < 24) {
    relative = diffHour === 1 ? "about 1 hour ago" : `about ${diffHour} hours ago`;
  } else if (diffDay < 30) {
    relative = diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  } else {
    relative = `${Math.floor(diffDay / 30)} months ago`;
  }

  // Formatted date string
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const isThisWeek = diffDay < 7 && date.getDay() !== now.getDay();
  const weekDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  let formatted = `${hours}:${minutes}`;
  if (!isToday) {
    if (diffDay < 7) {
      formatted = `${weekDays[date.getDay()]} ${hours}:${minutes}`;
    } else {
      formatted = `${date.getMonth() + 1}月${date.getDate()}日`;
    }
  }

  return { formatted, relative, timestamp: date.getTime() };
}

// Helper to convert Antigravity transcript.jsonl into clean readable Markdown and turns
function parseAntigravityTranscript(content: string, convId: string, mtime: Date): {
  id: string;
  externalChatId: string;
  projectName: string;
  platform: string;
  title: string;
  markdown: string;
  messageCount: number;
  updatedAt: string;
  relativeTime: string;
  timestamp: number;
  messages: { role: "User" | "Assistant"; text: string; time?: string }[];
} {
  const lines = content.split("\n").filter(Boolean);
  let title = "";
  let projectName = "Antigravity";
  const messages: { role: "User" | "Assistant"; text: string; time?: string }[] = [];

  // Check user_information / workspace
  const userInfMatch = content.match(/<user_information>([\s\S]*?)<\/user_information>/);
  if (userInfMatch) {
    const mapMatch = userInfMatch[1].match(/([a-zA-Z]:[^\r\n]+)\s*->\s*([^\r\n]+)/);
    if (mapMatch) {
      const folder = mapMatch[1].split(/[\/\\]/).filter(Boolean).pop();
      const corpus = mapMatch[2].split(/[\/\\]/).filter(Boolean).pop();
      const pCandidate = folder || corpus;
      if (pCandidate && !pCandidate.includes("URI") && !pCandidate.includes("CorpusName")) {
        projectName = pCandidate.trim();
      }
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
            const cleanTitle = text.replace(/[#*`_]/g, "").trim().split("\n")[0];
            title = cleanTitle.slice(0, 60);
          }
          messages.push({ role: "User", text });
        }
      } else if (step.type === "PLANNER_RESPONSE" && step.content) {
        let text = step.content;
        text = text.replace(/<thought>[\s\S]*?<\/thought>/g, "").trim();
        if (text) {
          messages.push({ role: "Assistant", text });
        }
      } else if (step.type === "CHECKPOINT" && !title && step.content) {
        const objMatch = step.content.match(/# USER Objective:\s*([^\n]+)/);
        if (objMatch) {
          title = objMatch[1].trim();
        } else {
          const reqMatch = step.content.match(/# User Requests\s*1\.\s*([^\n]+)/);
          if (reqMatch) {
            title = reqMatch[1].trim();
          }
        }
      }
    } catch {}
  }

  const markdown = messages.map(m => `## ${m.role}\n${m.text}`).join("\n\n");
  const timeInfo = formatSessionTime(mtime || new Date());
  const externalChatId = `antigravity_${convId}`;

  return {
    id: externalChatId,
    externalChatId,
    projectName,
    platform: "Antigravity",
    title: title || `Antigravity 对话 (${convId.slice(0, 8)})`,
    markdown: markdown || content.slice(0, 5000),
    messageCount: messages.length || 2,
    updatedAt: timeInfo.formatted,
    relativeTime: timeInfo.relative,
    timestamp: timeInfo.timestamp,
    messages,
  };
}

// GET /api/session/scan-agents (Scan local AI agent conversations: Antigravity, Codex, Claude Code, Cursor)
router.get("/scan-agents", async (_req: Request, res: Response) => {
  try {
    const userHome = os.homedir();
    const discovered: any[] = [];
    const db = getSqlite();

    // 1. Fetch current database sessions and full chat stats for accurate status matching
    const existingSessions = await sessionStore.getSessions();
    const fullChatRows = db.prepare("SELECT sessionId, messageCount, LENGTH(rawText) as textLen FROM full_chats").all() as any[];
    const chatStatsMap = new Map<string, { messageCount: number; textLen: number }>();
    for (const fc of fullChatRows) {
      chatStatsMap.set(fc.sessionId, fc);
    }

    const sessionByExtId = new Map<string, any>();
    const sessionById = new Map<string, any>();
    const sessionByName = new Map<string, any>();

    for (const s of existingSessions) {
      if (s.externalChatId) {
        sessionByExtId.set(s.externalChatId.toLowerCase(), s);
      }
      sessionById.set(s._id, s);
      if (s.projectName) {
        sessionByName.set(s.projectName.trim().toLowerCase(), s);
      }
    }

    // 2. Scan Nowledge Mem / Antigravity unsynced queue
    const unsyncedPath = path.join(userHome, ".nowledge-mem", "plugins", "antigravity", "unsynced.json");
    if (fs.existsSync(unsyncedPath)) {
      try {
        const raw = fs.readFileSync(unsyncedPath, "utf-8");
        const unsyncedMap = JSON.parse(raw);
        for (const [id, item] of Object.entries<any>(unsyncedMap)) {
          const itemTitle = item.title || item.summary || "Antigravity Session";
          const timeInfo = formatSessionTime(new Date());
          const extId = `antigravity_${id}`;
          const msgCount = Array.isArray(item.messages) ? item.messages.length : (item.messageCount || 10);

          discovered.push({
            id: extId,
            externalChatId: extId,
            platform: "Antigravity",
            projectName: "Antigravity",
            title: itemTitle,
            messageCount: msgCount,
            updatedAt: timeInfo.formatted,
            relativeTime: timeInfo.relative,
            timestamp: timeInfo.timestamp,
            rawText: Array.isArray(item.messages) 
              ? item.messages.map((m: any) => `## ${m.role || 'User'}\n${m.content || ''}`).join("\n\n")
              : (item.content || ""),
            messages: Array.isArray(item.messages)
              ? item.messages.map((m: any) => ({ role: m.role === "assistant" ? "Assistant" : "User", text: m.content || "" }))
              : [{ role: "User", text: item.content || "" }],
            sourcePath: unsyncedPath,
          });
        }
      } catch (err) {
        logger.warn("[Scanner] Failed to parse unsynced.json", err);
      }
    }

    // 3. Scan Google Antigravity Brain logs directory
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
                externalChatId: parsed.externalChatId,
                platform: parsed.platform,
                projectName: parsed.projectName,
                title: parsed.title,
                messageCount: parsed.messageCount,
                updatedAt: parsed.updatedAt,
                relativeTime: parsed.relativeTime,
                timestamp: parsed.timestamp,
                sourcePath: transcriptPath,
                rawText: parsed.markdown,
                messages: parsed.messages,
              });
            } catch {}
          }
        }
      } catch (err) {
        logger.warn("[Scanner] Failed to scan Antigravity brain dir", err);
      }
    }

    // 4. Scan Codex / Claude Code if present
    const codexDir = path.join(userHome, ".codex", "sessions");
    if (fs.existsSync(codexDir)) {
      try {
        const files = fs.readdirSync(codexDir).filter(f => f.endsWith(".json") || f.endsWith(".md"));
        for (const f of files.slice(0, 20)) {
          const fp = path.join(codexDir, f);
          const stat = fs.statSync(fp);
          const fTitle = f.replace(/\.[^.]+$/, "");
          const timeInfo = formatSessionTime(stat.mtime);
          const extId = `codex_${f}`;
          discovered.push({
            id: extId,
            externalChatId: extId,
            platform: "Codex",
            projectName: "CodexBridge",
            title: fTitle,
            messageCount: 12,
            updatedAt: timeInfo.formatted,
            relativeTime: timeInfo.relative,
            timestamp: timeInfo.timestamp,
            sourcePath: fp,
            rawText: fs.readFileSync(fp, "utf-8"),
            messages: [{ role: "User", text: fs.readFileSync(fp, "utf-8") }],
          });
        }
      } catch {}
    }

    // 5. Match discovered items with database sessions to accurately flag imported & update states
    for (const s of discovered) {
      const extId = (s.externalChatId || s.id || "").toLowerCase();
      const matched =
        sessionByExtId.get(extId) ||
        sessionById.get(s.id) ||
        sessionByExtId.get(s.id.toLowerCase()) ||
        sessionByName.get((s.title || "").trim().toLowerCase()) ||
        sessionByName.get((s.projectName || "").trim().toLowerCase());

      if (matched) {
        const fc = chatStatsMap.get(matched._id);
        const dbMsgCount = fc ? fc.messageCount : (matched.topicCount || 0);
        s.imported = true;
        s.dbSessionId = matched._id;
        s.dbMessageCount = dbMsgCount;
        s.hasNewMessages = s.messageCount > dbMsgCount;
      } else {
        s.imported = false;
        s.dbMessageCount = 0;
        s.hasNewMessages = false;
      }
    }

    // Sort discovered sessions by timestamp descending (newest first)
    discovered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

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
          hasNewMessagesCount: 0,
          latestUpdate: s.updatedAt,
          latestTimestamp: s.timestamp || 0,
        });
      }
      const g = groupMap.get(p)!;
      g.sessions.push(s);
      g.totalMessages += s.messageCount;
      if (s.imported) g.importedCount++;
      if (s.hasNewMessages) g.hasNewMessagesCount = (g.hasNewMessagesCount || 0) + 1;
      if ((s.timestamp || 0) > (g.latestTimestamp || 0)) {
        g.latestTimestamp = s.timestamp || 0;
        g.latestUpdate = s.updatedAt;
      }
    }

    const groups = Array.from(groupMap.values()).sort(
      (a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0)
    );

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
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const s of sessions) {
      try {
        const externalChatId = s.externalChatId || s.id;
        const projectName = (s.projectName || s.title || "Agent 对话记录").trim();
        const title = (s.title || projectName).trim();
        const platform = (s.platform || "Antigravity").toLowerCase().replace(/\s+/g, "_");
        const rawText = s.rawText || (Array.isArray(s.messages)
          ? s.messages.map((m: any) => `## ${m.role || "User"}\n${m.text || m.content || ""}`).join("\n\n")
          : `## User\n${title}\n\n### Assistant\n已通过智能体连接器同步。`);
        const messageCount = s.messageCount || (Array.isArray(s.messages) ? s.messages.length : 2);

        // 1. Multi-dimensional lookup for existing session
        let existing = externalChatId ? await sessionStore.getSessionByExternalId(externalChatId) : null;
        if (!existing && s.id) {
          existing = await sessionStore.getSession(s.id);
        }
        if (!existing && externalChatId) {
          existing = await sessionStore.getSession(externalChatId);
        }
        if (!existing && projectName) {
          existing = await sessionStore.getSessionByName(projectName);
        }
        if (!existing && title && title !== projectName) {
          existing = await sessionStore.getSessionByName(title);
        }

        if (existing) {
          const existingFullChat = await sessionStore.getFullChat(existing._id);
          if (existingFullChat) {
            const isIdentical =
              existingFullChat.rawText.trim() === rawText.trim() ||
              (existingFullChat.messageCount >= messageCount && existingFullChat.rawText.length >= rawText.length);

            if (isIdentical) {
              // Ensure externalChatId is backfilled if not set
              if (!existing.externalChatId && externalChatId) {
                await sessionStore.updateSession(existing._id, { externalChatId });
              }
              skippedCount++;
            } else {
              // Incremental merge update with new messages
              await sessionStore.updateFullChat(existing._id, {
                rawText,
                messageCount,
                platform,
              });
              await sessionStore.updateSession(existing._id, {
                hasFullChat: true,
                topicCount: messageCount,
                updatedAt: new Date(),
                ...(externalChatId && !existing.externalChatId ? { externalChatId } : {}),
              });
              updatedCount++;
            }
          } else {
            // Existing session without fullChat record
            await sessionStore.saveFullChat(existing._id, rawText, messageCount, platform);
            await sessionStore.updateSession(existing._id, {
              hasFullChat: true,
              topicCount: messageCount,
              updatedAt: new Date(),
              ...(externalChatId && !existing.externalChatId ? { externalChatId } : {}),
            });
            updatedCount++;
          }
        } else {
          // Create brand new session
          const created = await sessionStore.createSession(projectName, platform, externalChatId, s.id);
          if (created && created._id) {
            await sessionStore.saveFullChat(created._id, rawText, messageCount, platform);
            await sessionStore.updateSession(created._id, {
              hasFullChat: true,
              topicCount: messageCount,
            });
            createdCount++;
          }
        }
      } catch (itemErr: any) {
        logger.warn(`[Session] Failed to process session "${s?.title}":`, itemErr?.message || itemErr);
        errors.push(itemErr?.message || "Unknown item error");
      }
    }

    const importedCount = createdCount + updatedCount;
    logger.success(
      `[Session] Agent sessions processed: ${createdCount} created, ${updatedCount} updated, ${skippedCount} skipped (${sessions.length} total)`
    );

    res.json({
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
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
  const { projectName, platform = "markdown", rawText, externalChatId } = req.body;
  if (!projectName || !rawText) {
    res.status(400).json({ error: "projectName and rawText are required" });
    return;
  }

  try {
    const lines = rawText.split("\n");
    const messageCount =
      (rawText.match(/##\s+(User|Assistant|Human|AI)/gi) || []).length ||
      Math.max(2, Math.round(lines.length / 10));

    // Check if session already exists
    let existing = externalChatId ? await sessionStore.getSessionByExternalId(externalChatId) : null;
    if (!existing) {
      existing = await sessionStore.getSessionByName(projectName);
    }

    if (existing) {
      const existingFullChat = await sessionStore.getFullChat(existing._id);
      if (existingFullChat) {
        const isIdentical =
          existingFullChat.rawText.trim() === rawText.trim() ||
          (existingFullChat.messageCount >= messageCount && existingFullChat.rawText.length >= rawText.length);

        if (isIdentical) {
          if (!existing.externalChatId && externalChatId) {
            await sessionStore.updateSession(existing._id, { externalChatId });
          }
          res.json({
            success: true,
            sessionId: existing._id,
            action: "skipped",
            skipped: true,
            message: "会话已存在且无更新，自动跳过",
          });
          return;
        }

        // Incremental update
        await sessionStore.updateFullChat(existing._id, {
          rawText,
          messageCount,
          platform,
        });
        await sessionStore.updateSession(existing._id, {
          hasFullChat: true,
          topicCount: messageCount,
          updatedAt: new Date(),
          ...(externalChatId && !existing.externalChatId ? { externalChatId } : {}),
        });

        res.json({
          success: true,
          sessionId: existing._id,
          action: "updated",
          updated: true,
          message: "增量更新成功",
        });
        return;
      }

      await sessionStore.saveFullChat(existing._id, rawText, messageCount, platform);
      await sessionStore.updateSession(existing._id, {
        hasFullChat: true,
        topicCount: messageCount,
        updatedAt: new Date(),
      });

      res.json({
        success: true,
        sessionId: existing._id,
        action: "updated",
        updated: true,
        message: "增量更新成功",
      });
      return;
    }

    // Create new session
    const created = await sessionStore.createSession(projectName, platform, externalChatId);
    if (created && created._id) {
      await sessionStore.saveFullChat(created._id, rawText, messageCount, platform);
      await sessionStore.updateSession(created._id, {
        hasFullChat: true,
        topicCount: messageCount,
      });
    }

    res.json({
      success: true,
      sessionId: created._id,
      action: "created",
      created: true,
      message: "新会话创建成功",
    });
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
      facts,
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
    const pName = session.projectName || "session";
    let targetSession = session.externalChatId
      ? await sessionStore.getSessionByExternalId(session.externalChatId)
      : null;
    if (!targetSession) {
      targetSession = await sessionStore.getSessionByName(pName);
    }

    let targetId: string;
    if (targetSession) {
      targetId = targetSession._id;
      if (fullChat) {
        await sessionStore.saveFullChat(targetId, fullChat.rawText, fullChat.messageCount, fullChat.platform);
      }
    } else {
      const newSession = await sessionStore.createSession(pName, session.platform, session.externalChatId);
      targetId = newSession._id;
      if (fullChat) {
        await sessionStore.saveFullChat(targetId, fullChat.rawText, fullChat.messageCount, fullChat.platform);
      }
    }

    if (facts && Array.isArray(facts)) {
      for (const f of facts) {
        await graphStore.saveTriple({
          subject: f.subject,
          subjectType: f.subjectType || "Entity",
          relation: f.relation,
          object: f.object,
          objectType: f.objectType || "Entity",
          sessionId: targetId,
          timestamp: f.timestamp || new Date().toISOString(),
        });
      }
    }

    logger.success(`Imported session: ${pName} (ID: ${targetId})`);
    res.json({ success: true, sessionId: targetId });
  } catch (err) {
    logger.error("Import error:", err);
    res.status(500).json({ error: "Failed to import session" });
  }
});

export default router;

