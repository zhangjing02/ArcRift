import { Router, Request, Response } from "express";
import { memoryStore, sessionStore, graphStore } from "../services/storage";
import { llm } from "../services/extractor";
import { logger } from "../utils/logger";
import { isValidSessionId } from "../utils/validators";

const router = Router();

// GET /api/working-memory/:sessionId
router.get("/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;

  if (!isValidSessionId(sessionId as string)) {
    res.status(400).json({ error: "Invalid sessionId format" });
    return;
  }

  try {
    const sId = sessionId as string;
    let wm = await memoryStore.getWorkingMemory(sId);

    if (!wm) {
      const session = await sessionStore.getSession(sId);
      wm = {
        sessionId: sId,
        briefing: session?.summary || "暂无工作记忆。点击「AI 自动生成简报」或手动编辑当前焦点与决策。",
        focusAreas: [],
        activeDecisions: [],
        blockers: [],
        lastGeneratedAt: new Date(),
        updatedAt: new Date(),
      };
    }

    res.json({ success: true, workingMemory: wm });
  } catch (err: any) {
    logger.error("Failed to fetch working memory:", err?.message);
    res.status(500).json({ error: "Failed to fetch working memory" });
  }
});

// PUT /api/working-memory/:sessionId
router.put("/:sessionId", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { briefing, focusAreas, activeDecisions, blockers } = req.body;

  if (!isValidSessionId(sessionId as string)) {
    res.status(400).json({ error: "Invalid sessionId format" });
    return;
  }

  try {
    const sId = sessionId as string;
    const saved = await memoryStore.saveWorkingMemory({
      sessionId: sId,
      briefing,
      focusAreas: Array.isArray(focusAreas) ? focusAreas : [],
      activeDecisions: Array.isArray(activeDecisions) ? activeDecisions : [],
      blockers: Array.isArray(blockers) ? blockers : [],
      updatedAt: new Date(),
    });

    res.json({ success: true, workingMemory: saved });
  } catch (err: any) {
    logger.error("Failed to save working memory:", err?.message);
    res.status(500).json({ error: "Failed to save working memory" });
  }
});

// POST /api/working-memory/generate
router.post("/generate", async (req: Request, res: Response) => {
  const { sessionId } = req.body;

  if (!sessionId || !isValidSessionId(sessionId)) {
    res.status(400).json({ error: "Valid sessionId is required" });
    return;
  }

  try {
    const session = await sessionStore.getSession(sessionId);
    const fullChat = await sessionStore.getFullChat(sessionId);
    const triples = await graphStore.getTriplesBySession(sessionId);
    const memories = await memoryStore.getMemories(sessionId);

    const projectName = session?.projectName || sessionId;
    const chatSnippet = fullChat?.rawText ? fullChat.rawText.slice(-3000) : "";
    const triplesSnippet = triples.slice(0, 20).map(t => `${t.subject} -[${t.relation}]-> ${t.object}`).join("\n");
    const memoriesSnippet = memories.slice(0, 10).map(m => `[${m.importance.toUpperCase()}] ${m.title}: ${m.content}`).join("\n");

    const prompt = `You are an AI working memory generator for the project "${projectName}".
Analyze the following project background, recent discussions, knowledge triples, and recorded memories.
Generate a structured, high-signal Working Memory briefing (in Chinese).

Context provided:
=== PROJECT FACTS ===
${triplesSnippet || "No triples recorded"}

=== MEMORIES ===
${memoriesSnippet || "No discrete memories recorded"}

=== RECENT CHAT / LOGS ===
${chatSnippet || "No recent chat logs"}

Return ONLY a valid JSON object matching this exact schema:
{
  "briefing": "A concise 2-3 sentence executive briefing summarizing where the project currently stands, recent key achievements, and the immediate focus.",
  "focusAreas": ["Immediate priority 1", "Immediate priority 2", "Immediate priority 3"],
  "activeDecisions": ["Key architectural or technical decision 1", "Key decision 2"],
  "blockers": ["Any open issue, known bug, gotcha, or constraint to keep in mind"]
}`;

    const responseText = await llm(prompt, 1200);

    let parsed: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found");
      }
    } catch {
      parsed = {
        briefing: responseText.slice(0, 200),
        focusAreas: ["继续推进核心功能", "完善测试与文档"],
        activeDecisions: [],
        blockers: [],
      };
    }

    const saved = await memoryStore.saveWorkingMemory({
      sessionId,
      briefing: parsed.briefing || "",
      focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas : [],
      activeDecisions: Array.isArray(parsed.activeDecisions) ? parsed.activeDecisions : [],
      blockers: Array.isArray(parsed.blockers) ? parsed.blockers : [],
      lastGeneratedAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ success: true, workingMemory: saved });
  } catch (err: any) {
    logger.error("Failed to generate working memory:", err?.message);
    res.status(500).json({ error: "Failed to generate working memory: " + (err?.message || "Unknown error") });
  }
});

export default router;
