import { memoryStore } from "./storage";
import { analyzeMemoryDimensions } from "./memoryEvaluator";
import { getSqlite } from "./sqlite";
import { logger } from "../utils/logger";

// Default interval: every 6 hours (6 * 60 * 60 * 1000 ms)
const DEFAULT_AUTO_EVAL_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface AutoEvaluatorState {
  enabled: boolean;
  intervalMs: number;
  lastRunAt: string | null;
  lastEvaluatedCount: number;
  lastDistribution: Record<string, number>;
  isRunning: boolean;
}

const state: AutoEvaluatorState = {
  enabled: true,
  intervalMs: DEFAULT_AUTO_EVAL_INTERVAL_MS,
  lastRunAt: null,
  lastEvaluatedCount: 0,
  lastDistribution: {},
  isRunning: false,
};

let timer: NodeJS.Timeout | null = null;

/**
 * Execute a single pass of memory self-evaluation
 */
export async function runMemorySelfEvaluation(): Promise<{
  success: boolean;
  evaluatedCount: number;
  distribution: Record<string, number>;
}> {
  if (state.isRunning) {
    logger.info("[Auto-Evaluator] Evaluation already in progress, skipping concurrent run.");
    return { success: false, evaluatedCount: 0, distribution: state.lastDistribution };
  }

  state.isRunning = true;
  logger.info("[Auto-Evaluator] 🤖 Starting autonomous memory self-evaluation & calibration...");

  try {
    const memories = await memoryStore.getMemories();
    const db = getSqlite();
    const updateStmt = db.prepare("UPDATE memories SET importance = ?, updatedAt = ? WHERE id = ?");
    const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

    let updatedCount = 0;
    for (const m of memories) {
      const evalRes = analyzeMemoryDimensions(m.title, m.content);
      updateStmt.run(evalRes.finalScore, new Date().toISOString(), m.id);
      distribution[String(evalRes.starRating)] = (distribution[String(evalRes.starRating)] || 0) + 1;
      updatedCount++;
    }

    state.lastRunAt = new Date().toISOString();
    state.lastEvaluatedCount = updatedCount;
    state.lastDistribution = distribution;

    logger.success(
      `[Auto-Evaluator] ✨ Autonomous evaluation completed! Evaluated ${updatedCount} memories. Distribution: 5★: ${distribution["5"]}, 4★: ${distribution["4"]}, 3★: ${distribution["3"]}, 2★: ${distribution["2"]}, 1★: ${distribution["1"]}`
    );

    return {
      success: true,
      evaluatedCount: updatedCount,
      distribution,
    };
  } catch (err: any) {
    logger.error("[Auto-Evaluator] Failed during memory self-evaluation:", err?.message);
    return { success: false, evaluatedCount: 0, distribution: {} };
  } finally {
    state.isRunning = false;
  }
}

/**
 * Start the background recurring worker
 */
export function startMemoryAutoEvaluator(intervalMs = DEFAULT_AUTO_EVAL_INTERVAL_MS) {
  state.intervalMs = intervalMs;
  state.enabled = true;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  // Initial delayed pass 15s after startup so boot is fast
  setTimeout(() => {
    runMemorySelfEvaluation().catch((err) => {
      logger.error("[Auto-Evaluator] Initial evaluation run failed", err);
    });
  }, 15000);

  // Recurring background interval
  timer = setInterval(() => {
    if (state.enabled) {
      runMemorySelfEvaluation().catch((err) => {
        logger.error("[Auto-Evaluator] Scheduled evaluation run failed", err);
      });
    }
  }, state.intervalMs);

  logger.info(`[Auto-Evaluator] Periodic memory self-evaluation worker started (interval: ${Math.round(state.intervalMs / 3600000)}h)`);
}

/**
 * Get current state of auto-evaluator
 */
export function getAutoEvaluatorState(): AutoEvaluatorState {
  return { ...state };
}
