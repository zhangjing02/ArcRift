/**
 * services/claims-checker.ts
 *
 * Implements Claim Checking & Timeline Review Governance for Nowledge Mem / ArcRift:
 * 1. checkClaims: pre-flight validation of statements against knowledge base
 * 2. Timeline Review Inbox: list, create, and resolve conflict reviews
 */

import { getSqlite } from "./sqlite";
import { memoryStore } from "./storage";
import { v4 as uuidv4 } from "uuid";

export interface ClaimConflict {
  claim_text: string;
  matched_memory_id: string;
  matched_memory_title: string;
  matched_unit_type: string;
  matched_claim_status: string;
  is_deprecated_or_superseded: boolean;
  conflict_reason: string;
  risk_level: "high" | "medium" | "low";
  recommended_action: string;
}

export interface ClaimsCheckResult {
  text_length: number;
  claims_extracted: number;
  has_conflicts: boolean;
  conflicts_count: number;
  conflicts: ClaimConflict[];
  summary: string;
}

export interface TimelineReviewItem {
  id: string;
  space_id: string;
  memory_a_id: string;
  memory_b_id: string;
  conflict_type: string;
  conflict_reason: string;
  evidence_a?: string;
  evidence_b?: string;
  suggested_action: string;
  status: "pending" | "resolved" | "dismissed";
  resolution_action?: string;
  resolution_note?: string;
  created_at: string;
  resolved_at?: string;
}

export class ClaimsCheckerService {
  private get db() {
    return getSqlite();
  }

  /**
   * Pre-flight claim checking: inspect draft statements against active and historical memories
   */
  async checkClaims(options: {
    text: string;
    space_id?: string;
    confidence_threshold?: number;
  }): Promise<ClaimsCheckResult> {
    const { text, space_id = "default", confidence_threshold = 0.5 } = options;

    if (!text || !text.trim()) {
      return {
        text_length: 0,
        claims_extracted: 0,
        has_conflicts: false,
        conflicts_count: 0,
        conflicts: [],
        summary: "No text provided to analyze.",
      };
    }

    // 1. Split text into individual declarative claim sentences
    const rawSentences = text
      .split(/[。！？\n\r\.\!\?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8); // Ignore trivial fragments

    const conflicts: ClaimConflict[] = [];

    // 2. Query knowledge base for each statement
    for (const sentence of rawSentences) {
      const matches = await memoryStore.searchMemories({
        query: sentence,
        spaceId: space_id,
        limit: 3,
        confidenceThreshold: confidence_threshold,
      });

      for (const m of matches) {
        let isConflict = false;
        let reason = "";
        let risk: "high" | "medium" | "low" = "low";
        let recAction = "";

        // Conflict Case 1: Match against superseded or deprecated memory
        if (m.isLatest === false || m.claimStatus === "deprecated") {
          isConflict = true;
          reason = `Claim references information from deprecated/superseded memory (${m.title}).`;
          risk = "high";
          recAction = `Verify with newer active decisions. Supreseded ID: ${m.id}`;
        }
        // Conflict Case 2: Match against disputed/challenged memory
        else if (m.claimStatus === "disputed" || m.evolvesRelation === "challenges") {
          isConflict = true;
          reason = `Claim matches a contested memory under dispute (${m.title}).`;
          risk = "medium";
          recAction = `Check latest consensus or conduct timeline review.`;
        }

        if (isConflict) {
          conflicts.push({
            claim_text: sentence,
            matched_memory_id: m.id,
            matched_memory_title: m.title,
            matched_unit_type: m.unitType,
            matched_claim_status: m.claimStatus || "asserted",
            is_deprecated_or_superseded: m.isLatest === false || m.claimStatus === "deprecated",
            conflict_reason: reason,
            risk_level: risk,
            recommended_action: recAction,
          });
        }
      }
    }

    const hasConflicts = conflicts.length > 0;
    const summary = hasConflicts
      ? `Identified ${conflicts.length} potential conflict(s) across ${rawSentences.length} analyzed statements.`
      : `All ${rawSentences.length} analyzed statements align cleanly with verified knowledge.`;

    return {
      text_length: text.length,
      claims_extracted: rawSentences.length,
      has_conflicts: hasConflicts,
      conflicts_count: conflicts.length,
      conflicts,
      summary,
    };
  }

  /**
   * List pending or resolved timeline reviews
   */
  async listReviews(options: {
    space_id?: string;
    status?: "pending" | "resolved" | "dismissed" | "all";
    limit?: number;
  } = {}): Promise<TimelineReviewItem[]> {
    const { space_id, status = "pending", limit = 20 } = options;

    let sql = "SELECT * FROM timeline_reviews WHERE 1=1";
    const params: any[] = [];

    if (space_id && space_id !== "all") {
      sql += " AND sessionId = ?";
      params.push(space_id);
    }
    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    sql += " ORDER BY createdAt DESC LIMIT ?";
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({
      id: r.id,
      space_id: r.sessionId,
      memory_a_id: r.memory_a_id,
      memory_b_id: r.memory_b_id,
      conflict_type: r.conflict_type,
      conflict_reason: r.conflict_reason,
      evidence_a: r.evidence_a,
      evidence_b: r.evidence_b,
      suggested_action: r.suggested_action,
      status: r.status,
      resolution_action: r.resolution_action,
      resolution_note: r.resolution_note,
      created_at: r.createdAt,
      resolved_at: r.resolvedAt,
    }));
  }

  /**
   * Create a new timeline conflict review
   */
  async createReview(data: {
    space_id?: string;
    memory_a_id: string;
    memory_b_id: string;
    conflict_type?: string;
    conflict_reason: string;
    evidence_a?: string;
    evidence_b?: string;
    suggested_action?: string;
  }): Promise<TimelineReviewItem> {
    const id = `rev_${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();
    const spaceId = data.space_id || "default";

    this.db.prepare(`
      INSERT INTO timeline_reviews (
        id, sessionId, memory_a_id, memory_b_id, conflict_type,
        conflict_reason, evidence_a, evidence_b, suggested_action,
        status, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      id,
      spaceId,
      data.memory_a_id,
      data.memory_b_id,
      data.conflict_type || "contradiction",
      data.conflict_reason,
      data.evidence_a || null,
      data.evidence_b || null,
      data.suggested_action || "keep_newer_as_latest",
      now
    );

    return {
      id,
      space_id: spaceId,
      memory_a_id: data.memory_a_id,
      memory_b_id: data.memory_b_id,
      conflict_type: data.conflict_type || "contradiction",
      conflict_reason: data.conflict_reason,
      evidence_a: data.evidence_a,
      evidence_b: data.evidence_b,
      suggested_action: data.suggested_action || "keep_newer_as_latest",
      status: "pending",
      created_at: now,
    };
  }

  /**
   * Resolve a timeline conflict review
   */
  async resolveReview(data: {
    review_id: string;
    action: "keep_newer_as_latest" | "keep_older_as_latest" | "keep_both_linked" | "dismiss";
    custom_note?: string;
  }): Promise<{ success: boolean; review_id: string; action: string; message: string }> {
    const { review_id, action, custom_note } = data;

    const row = this.db.prepare("SELECT * FROM timeline_reviews WHERE id = ?").get(review_id) as any;
    if (!row) {
      throw new Error(`Timeline review '${review_id}' not found`);
    }

    const now = new Date().toISOString();

    // Execute business actions based on resolution
    if (action === "keep_newer_as_latest") {
      // Set memory_a (older) as superseded/not latest, keep memory_b as latest
      this.db.prepare("UPDATE memories SET is_latest = 0, claim_status = 'deprecated' WHERE id = ?").run(row.memory_a_id);
      this.db.prepare("UPDATE memories SET is_latest = 1, claim_status = 'asserted' WHERE id = ?").run(row.memory_b_id);
    } else if (action === "keep_older_as_latest") {
      // Keep memory_a as latest, deprecate memory_b
      this.db.prepare("UPDATE memories SET is_latest = 1, claim_status = 'asserted' WHERE id = ?").run(row.memory_a_id);
      this.db.prepare("UPDATE memories SET is_latest = 0, claim_status = 'deprecated' WHERE id = ?").run(row.memory_b_id);
    } else if (action === "keep_both_linked") {
      // Link them together with challenges relation
      await memoryStore.addRelation({
        sourceMemoryId: row.memory_a_id,
        targetMemoryId: row.memory_b_id,
        relationType: "challenges",
        reason: custom_note || "Maintained as co-existing contrasting views during review",
        bidirectional: true,
      });
    }

    // Mark review record as resolved/dismissed
    const status = action === "dismiss" ? "dismissed" : "resolved";
    this.db.prepare(`
      UPDATE timeline_reviews SET
        status = ?,
        resolution_action = ?,
        resolution_note = ?,
        resolvedAt = ?
      WHERE id = ?
    `).run(status, action, custom_note || null, now, review_id);

    return {
      success: true,
      review_id,
      action,
      message: `Review '${review_id}' resolved with action '${action}'.`,
    };
  }
}

export const claimsChecker = new ClaimsCheckerService();
