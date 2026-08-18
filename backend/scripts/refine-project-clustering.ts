import Database from "better-sqlite3";
import path from "path";

function refineDatabase(dbPath: string) {
  console.log(`\nRefining database: ${dbPath}`);
  const db = new Database(dbPath);

  // Ensure sessions table exists with columns
  const sessions = [
    { id: "ArcRift", projectName: "ArcRift (AI 记忆工作台)", platform: "desktop" },
    { id: "WechatBot", projectName: "WechatBot (微信 AI 机器人)", platform: "service" },
    { id: "BeBeBus", projectName: "BeBeBus (Android 客户端)", platform: "mobile" },
    { id: "MoodyMusic", projectName: "MoodyMusic (音乐项目)", platform: "mobile" },
    { id: "StockAnalysis", projectName: "StockAnalysis (股票量化分析)", platform: "quant" },
    { id: "NotionAI", projectName: "NotionAI (Notion 知识库集成)", platform: "cloud" },
    { id: "Workflow", projectName: "通用工作流与编码准则", platform: "standards" },
    { id: "AndroidDev", projectName: "Android 核心技术沉淀", platform: "android" },
  ];

  const now = new Date().toISOString();
  const insertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (id, projectName, platform, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const s of sessions) {
    insertSession.run(s.id, s.projectName, s.platform, now, now);
  }

  // Load all memories
  const memories = db.prepare("SELECT id, title, content, labels, sessionId FROM memories").all() as any[];
  console.log(`Found ${memories.length} memories to classify.`);

  const updateMemory = db.prepare(`
    UPDATE memories 
    SET sessionId = ?, labels = ?
    WHERE id = ?
  `);

  let updatedCount = 0;

  for (const m of memories) {
    const title = m.title || "";
    const content = m.content || "";
    const text = `${title} ${content}`.toLowerCase();

    let targetSession = "ArcRift";
    let newLabels: string[] = [];

    if (text.includes("wechat") || text.includes("微信机器人") || title.includes("微信")) {
      targetSession = "WechatBot";
      newLabels = ["WechatBot", "AI-Robot", "Architecture"];
    } else if (text.includes("bebebus")) {
      targetSession = "BeBeBus";
      newLabels = ["BeBeBus", "Android", "NetworkHeader"];
    } else if (text.includes("moodymusic")) {
      targetSession = "MoodyMusic";
      newLabels = ["MoodyMusic", "Android", "JetpackCompose"];
    } else if (text.includes("daily_stock_analysis") || text.includes("股票")) {
      targetSession = "StockAnalysis";
      newLabels = ["StockAnalysis", "Deployment", "ModelLayering"];
    } else if (text.includes("notion")) {
      targetSession = "NotionAI";
      newLabels = ["NotionAI", "InlineDatabase", "Skills"];
    } else if (text.includes("jetpack navigation") || title.includes("navigation 3")) {
      targetSession = "AndroidDev";
      newLabels = ["AndroidDev", "Navigation3", "Architecture"];
    } else if (
      title.includes("先调研") ||
      title.includes("old-coder") ||
      title.includes("编码准则") ||
      title.includes("Untitled Memory")
    ) {
      targetSession = "Workflow";
      newLabels = ["Workflow", "Standards", "BestPractice"];
    } else {
      targetSession = "ArcRift";
      newLabels = ["ArcRift"];
      if (title.includes("MCP") || title.includes("P0")) newLabels.push("MCP");
      if (title.includes("桌面") || title.includes("Electron")) newLabels.push("Desktop");
      if (title.includes("SQLite") || title.includes("存储")) newLabels.push("SQLite");
      if (title.includes("Release") || title.includes("安装包")) newLabels.push("Release");
      if (title.includes("知识树") || title.includes("知识图谱")) newLabels.push("KnowledgeGraph");
    }

    updateMemory.run(targetSession, JSON.stringify(newLabels), m.id);
    updatedCount++;
    console.log(`[${targetSession}] ${title.slice(0, 32)}... -> labels: ${JSON.stringify(newLabels)}`);
  }

  // Update session triple/memory counts
  for (const s of sessions) {
    const countRow = db.prepare("SELECT count(*) as c FROM memories WHERE sessionId = ?").get(s.id) as any;
    db.prepare("UPDATE sessions SET tripleCount = ? WHERE id = ?").run(countRow?.c || 0, s.id);
  }

  // Remove empty default-session if no memories remain in it
  db.prepare("DELETE FROM sessions WHERE id = 'default-session' AND (SELECT count(*) FROM memories WHERE sessionId = 'default-session') = 0").run();

  console.log(`Successfully classified ${updatedCount} memories into structured projects!`);
  db.close();
}

async function main() {
  const devDb = path.resolve(__dirname, "../ChronosMind.db");
  const prodDb = "D:/ComputerTool/AI-tool/ArcRift/backend/ChronosMind.db";

  if (require("fs").existsSync(devDb)) refineDatabase(devDb);
  if (require("fs").existsSync(prodDb)) refineDatabase(prodDb);
}

main().catch(console.error);
