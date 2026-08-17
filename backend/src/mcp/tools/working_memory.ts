/**
 * mcp/tools/working_memory.ts — Working Memory tools (Nowledge Mem spec)
 * 
 * Provides AI agents (Antigravity, Cursor, Claude, etc.) with instant access
 * to the project's daily briefing, focus areas, active decisions, and blockers.
 */

import { memoryStore, sessionStore } from "../../services/storage";
import { logger } from "../../utils/logger";

export async function getWorkingMemoryTool(project?: string): Promise<string> {
  try {
    let targetSessionId = project;

    if (!targetSessionId) {
      targetSessionId = (await sessionStore.getActiveSessionId()) || undefined;
    }

    if (!targetSessionId) {
      const all = await sessionStore.getSessions();
      if (all.length > 0) targetSessionId = all[0]._id;
    }

    if (!targetSessionId) {
      return "No active project found in ArcRift. Please specify a project name.";
    }

    const session = (await sessionStore.getSession(targetSessionId)) || (await sessionStore.getSessionByName(targetSessionId));
    const effectiveId = session ? session._id : targetSessionId;
    const projectName = session ? session.projectName : targetSessionId;

    const wm = await memoryStore.getWorkingMemory(effectiveId);

    if (!wm || (!wm.briefing && wm.focusAreas.length === 0)) {
      return `<WORKING_MEMORY project="${projectName}">
# Project: ${projectName}
Status: Initialized (No active briefing recorded yet).
</WORKING_MEMORY>`;
    }

    const focusStr = wm.focusAreas.length > 0 ? wm.focusAreas.map(f => `- ${f}`).join("\n") : "- Ongoing development";
    const decisionsStr = wm.activeDecisions.length > 0 ? wm.activeDecisions.map(d => `- ${d}`).join("\n") : "- Follow standard codebase patterns";
    const blockersStr = wm.blockers.length > 0 ? wm.blockers.map(b => `- ${b}`).join("\n") : "- None reported";

    return `<WORKING_MEMORY project="${projectName}" updated="${wm.updatedAt.toISOString()}">
# 🧠 Working Memory & Briefing: ${projectName}

## 📋 Executive Briefing
${wm.briefing || "No briefing text."}

## 🎯 Current Focus Areas & Priorities
${focusStr}

## 🏛️ Active Architectural & Design Decisions
${decisionsStr}

## ⚠️ Known Blockers & Gotchas
${blockersStr}
</WORKING_MEMORY>`;
  } catch (err: any) {
    logger.error("get_working_memory tool error:", err);
    return `get_working_memory failed: ${err?.message || String(err)}`;
  }
}

export async function updateWorkingMemoryTool(
  projectOrInput: string | { project?: string; space_id?: string; briefing?: string; focusAreas?: string[]; activeDecisions?: string[]; blockers?: string[] },
  briefing?: string,
  focusAreas?: string[],
  activeDecisions?: string[],
  blockers?: string[]
): Promise<string> {
  try {
    let proj: string | undefined;
    let b = briefing;
    let fa = focusAreas;
    let ad = activeDecisions;
    let bl = blockers;

    if (typeof projectOrInput === "object" && projectOrInput !== null) {
      proj = projectOrInput.project || projectOrInput.space_id;
      b = projectOrInput.briefing;
      fa = projectOrInput.focusAreas;
      ad = projectOrInput.activeDecisions;
      bl = projectOrInput.blockers;
    } else {
      proj = projectOrInput;
    }

    if (!proj) return "Error: project or space_id is required.";

    let session = await sessionStore.getSession(proj);
    if (!session) {
      session = await sessionStore.getSessionByName(proj);
      if (!session) {
        session = await sessionStore.createSession(proj, "mcp", undefined, proj);
      }
    }

    const effectiveId = session._id;
    const saved = await memoryStore.saveWorkingMemory({
      sessionId: effectiveId,
      briefing: b,
      focusAreas: Array.isArray(fa) ? fa : undefined,
      activeDecisions: Array.isArray(ad) ? ad : undefined,
      blockers: Array.isArray(bl) ? bl : undefined,
      updatedAt: new Date(),
    });

    return `Successfully updated Working Memory for project "${session.projectName}".\n- Last updated: ${saved.updatedAt.toISOString()}\n- Focus items: ${saved.focusAreas.length}\n- Active decisions: ${saved.activeDecisions.length}`;
  } catch (err: any) {
    logger.error("update_working_memory tool error:", err);
    return `update_working_memory failed: ${err?.message || String(err)}`;
  }
}
