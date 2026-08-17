import { memoryStore, sessionStore } from "../../services/storage";

export async function readWorkingMemory(args: { space_id?: string; spaceId?: string; project?: string }) {
  let targetSpace = args.space_id || args.spaceId || args.project || "default";

  let session = await sessionStore.getSession(targetSpace);
  if (!session) {
    session = await sessionStore.getSessionByName(targetSpace);
  }
  const effectiveId = session ? session._id : targetSpace;

  const wm = await memoryStore.getWorkingMemory(effectiveId);
  if (!wm) {
    return {
      space_id: effectiveId,
      projectName: session?.projectName || effectiveId,
      briefing: "暂无工作记忆简报。可通过 AI 自动总结生成，或使用 update_working_memory 进行更新。",
      focusAreas: [],
      activeDecisions: [],
      blockers: [],
      lastGeneratedAt: new Date().toISOString(),
    };
  }

  return {
    space_id: effectiveId,
    projectName: session?.projectName || effectiveId,
    briefing: wm.briefing,
    focusAreas: wm.focusAreas,
    activeDecisions: wm.activeDecisions,
    blockers: wm.blockers,
    lastGeneratedAt: wm.lastGeneratedAt.toISOString(),
  };
}
