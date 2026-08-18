const Database = require("better-sqlite3");

const dbPaths = [
  "E:/Workspace/AI-Project/ArcRift/data/NowledgeMem.db",
  "E:/Workspace/AI-Project/ArcRift/backend/ChronosMind.db",
  "D:/ComputerTool/AI-tool/ArcRift/backend/ChronosMind.db"
];

for (const p of dbPaths) {
  try {
    const db = new Database(p);
    
    // Set most recent memories to future ISO strings so they rank at the very top
    const t0 = new Date(Date.now() + 1000 * 3600).toISOString();
    const t1 = new Date(Date.now() + 1000 * 3000).toISOString();
    const t2 = new Date(Date.now() + 1000 * 2000).toISOString();
    const t3 = new Date(Date.now() + 1000 * 1000).toISOString();

    db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE title LIKE '%原生独立桌面窗口与 CM%'").run(t0, t0);
    db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE title LIKE '%ArcRift 原生独立 Windows%'").run(t1, t1);
    db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE title LIKE '%ArcRift 原生桌面图标与内置%'").run(t2, t2);
    db.prepare("UPDATE memories SET createdAt = ?, updatedAt = ? WHERE title LIKE '%ArcRift 本地生产环境安装%'").run(t3, t3);

    const top = db.prepare("SELECT title, createdAt FROM memories ORDER BY createdAt DESC LIMIT 5").all();
    console.log(`\nTop 5 memories in ${p}:`);
    top.forEach((m, idx) => console.log(` ${idx + 1}. [${m.createdAt}] ${m.title}`));
    db.close();
  } catch (err) {
    console.error(`Failed on ${p}:`, err.message);
  }
}
