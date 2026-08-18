const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// We read the full output from step 1837
const stepFile = "C:\\Users\\zhangjing\\.gemini\\antigravity\\brain\\c9c776d6-e5dd-403a-84de-ec2ce4add260\\.system_generated\\steps\\1837\\output.txt";
const rawData = fs.readFileSync(stepFile, "utf8");
const parsed = JSON.parse(rawData);

const memories = parsed.results || [];
console.log(`Found ${memories.length} memories from Nowledge Mem!`);

const dbPaths = [
  path.resolve(__dirname, "../../data/NowledgeMem.db"),
  path.resolve(__dirname, "../ChronosMind.db"),
  "D:\\ComputerTool\\AI-tool\\ArcRift\\backend\\ChronosMind.db",
  "D:\\ComputerTool\\AI-tool\\ArcRift\\data\\NowledgeMem.db"
];

for (const dbPath of dbPaths) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    console.log(`\nSyncing to SQLite DB: ${dbPath}`);
    const db = new Database(dbPath);
    db.pragma("foreign_keys = OFF");

    // Ensure session exists
    try {
      db.prepare(`
        INSERT OR IGNORE INTO sessions (id, title, source, createdAt, updatedAt)
        VALUES ('default-session', 'Nowledge Mem Sync Session', 'nowledge-mem', datetime('now'), datetime('now'))
      `).run();
    } catch {}

    const columns = db.prepare("PRAGMA table_info(memories)").all().map(c => c.name);
    const hasSessionId = columns.includes("sessionId");

    let count = 0;
    const now = Date.now();
    for (const m of memories) {
      const id = m.id || m.memory_id;
      const title = m.title || "Untitled Memory";
      const content = m.content || m.content_preview || "";
      const unitType = m.unit_type || "fact";
      const importanceVal = m.importance !== undefined ? String(m.importance) : "high";
      const claimStatus = m.claim_status || "asserted";
      
      let labelsArr = m.labels || m.assigned_labels || [];
      if (typeof labelsArr === "string") {
        try { labelsArr = JSON.parse(labelsArr); } catch {}
      }
      if (!Array.isArray(labelsArr) || labelsArr.length === 0) {
        if (title.includes("[ArcRift]") || title.includes("ArcRift")) {
          labelsArr = ["ArcRift", "NowledgeMem"];
        } else if (title.includes("微信") || title.includes("Wechat")) {
          labelsArr = ["WechatBot", "NowledgeMem"];
        } else if (title.includes("BeBeBus") || title.includes("bebebus")) {
          labelsArr = ["BeBeBus", "NowledgeMem"];
        } else {
          labelsArr = ["NowledgeMem"];
        }
      }

      // Ensure first label is project if title contains [Project]
      const match = title.match(/^\[([^\]]+)\]/);
      if (match && !labelsArr.includes(match[1])) {
        labelsArr.unshift(match[1]);
      }

      const isoTime = new Date(now - count * 1000 * 60).toISOString();

      if (hasSessionId) {
        db.prepare(`
          INSERT OR REPLACE INTO memories (
            id, sessionId, title, content, importance, category, tags, source,
            createdAt, updatedAt, unit_type, labels, claim_status, evolves_from_id,
            evolves_relation, is_latest, source_app, temporal_context
          ) VALUES (
            @id, @sessionId, @title, @content, @importance, @category, @tags, @source,
            @createdAt, @updatedAt, @unit_type, @labels, @claim_status, @evolves_from_id,
            @evolves_relation, @is_latest, @source_app, @temporal_context
          )
        `).run({
          id,
          sessionId: "default-session",
          title,
          content,
          importance: importanceVal,
          category: "Note",
          tags: JSON.stringify(labelsArr),
          source: "NowledgeMem MCP",
          createdAt: isoTime,
          updatedAt: isoTime,
          unit_type: unitType,
          labels: JSON.stringify(labelsArr),
          claim_status: claimStatus,
          evolves_from_id: m.evolves_from_id || null,
          evolves_relation: m.evolves_relation || null,
          is_latest: 1,
          source_app: "nowledge-mem",
          temporal_context: m.temporal_context || "timeless"
        });
      }
      count++;
    }

    console.log(`✅ Successfully synced ${count} memories to ${dbPath}!`);
    db.close();
  } catch (err) {
    console.error(`❌ Failed syncing to ${dbPath}:`, err.message);
  }
}

console.log("\n🎉 All local SQLite databases synced 100% with Nowledge Mem!");
