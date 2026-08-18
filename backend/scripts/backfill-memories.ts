import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPaths = [
  path.resolve(__dirname, "../../data/NowledgeMem.db"),
  path.resolve(__dirname, "../../data/ArcRift.db"),
  path.resolve(__dirname, "../ArcRift.db"),
];

const memories = [
  {
    id: "mem_a520c2c5",
    sessionId: "BeBeBus",
    title: "音频播放进度重置机制与内存状态残留修复",
    content: "AudioAppStore 等全局内存单例，在业务上下文（如 storyId、sessionId）发生变更时，必须显式清空衍生计算状态（如 _playbackProgress、lastMqttPosSec），避免新曲目继承旧曲目的内存驻留进度。",
    importance: 0.9,
    category: "BugFix",
    unit_type: "context",
    labels: JSON.stringify(["audio", "playback", "state-management", "AudioAppStore"]),
    tags: JSON.stringify(["audio", "playback", "state-management", "AudioAppStore"]),
    claim_status: "asserted",
    source: "antigravity",
    source_app: "Google Antigravity",
    temporal_context: "timeless",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mem_c74cf5d5",
    sessionId: "BeBeBus",
    title: "播放列表分页页码残留与模式切换数据错位修复",
    content: "任何在列表已发生分页加载（currentPage > 1）后发起的新模式切换、重渲染或下拉刷新，必须强制重置 currentPage = 1 与 isEnd = false，并通过协程 Job 取消未决请求，防止旧请求乱序覆盖全量数据。",
    importance: 0.9,
    category: "BugFix",
    unit_type: "context",
    labels: JSON.stringify(["audio", "pagination", "concurrency", "AudioListViewModel"]),
    tags: JSON.stringify(["audio", "pagination", "concurrency", "AudioListViewModel"]),
    claim_status: "asserted",
    source: "antigravity",
    source_app: "Google Antigravity",
    temporal_context: "timeless",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mem_2500309d",
    sessionId: "BeBeBus",
    title: "悬浮播放条点击事件向下穿透导致数据错位",
    content: "放置于页面顶层的自定义悬浮组件（如 FloatingPlayerView / BlurView），根容器、文本及封面图等均需配置 isClickable = true 并消费点击事件，防止 Touch 事件穿透到底层列表卡片触发误操作。",
    importance: 0.85,
    category: "UI/UX",
    unit_type: "context",
    labels: JSON.stringify(["ui", "touch-events", "FloatingPlayerView", "BlurView"]),
    tags: JSON.stringify(["ui", "touch-events", "FloatingPlayerView", "BlurView"]),
    claim_status: "asserted",
    source: "antigravity",
    source_app: "Google Antigravity",
    temporal_context: "timeless",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "mem_0add1dfa",
    sessionId: "BeBeBus",
    title: "专辑顶部全部播放三态控制状态机与播控协议修复",
    content: "播控组件须精准区分首次进页从头播 (playAudio)、播放中暂停 (playOrSuspend flag=2) 与暂停后原点恢复 (playOrSuspend flag=1)，统一通过 MQTT 回调与全局 Flow 驱动 UI 图标与电平同步。",
    importance: 0.95,
    category: "Protocol",
    unit_type: "context",
    labels: JSON.stringify(["audio", "state-machine", "play-control", "MQTT"]),
    tags: JSON.stringify(["audio", "state-machine", "play-control", "MQTT"]),
    claim_status: "asserted",
    source: "antigravity",
    source_app: "Google Antigravity",
    temporal_context: "timeless",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

for (const targetPath of dbPaths) {
  if (!fs.existsSync(path.dirname(targetPath))) {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  const db = new Database(targetPath);

  // Ensure sessions table exists & session is created
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      projectName TEXT NOT NULL,
      platform TEXT,
      summary TEXT,
      tripleCount INTEGER DEFAULT 0,
      topicCount INTEGER DEFAULT 0,
      hasFullChat INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      externalChatId TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      category TEXT DEFAULT 'Note',
      unit_type TEXT DEFAULT 'context',
      labels TEXT,
      tags TEXT,
      claim_status TEXT DEFAULT 'asserted',
      evolves_from_id TEXT,
      evolves_relation TEXT,
      is_latest INTEGER DEFAULT 1,
      source TEXT DEFAULT 'manual',
      source_app TEXT,
      temporal_context TEXT DEFAULT 'timeless',
      createdAt TEXT,
      updatedAt TEXT
    );
    CREATE TABLE IF NOT EXISTS working_memory (
      sessionId TEXT PRIMARY KEY,
      briefing TEXT,
      focusAreas TEXT,
      activeDecisions TEXT,
      blockers TEXT,
      lastGeneratedAt TEXT,
      updatedAt TEXT
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_memories USING fts5(
      memory_id UNINDEXED,
      title,
      content,
      labels,
      tokenize='porter'
    );
  `);

  db.prepare(`
    INSERT OR IGNORE INTO sessions (id, projectName, platform, createdAt, updatedAt)
    VALUES ('BeBeBus', 'BeBeBus', 'default', datetime('now'), datetime('now'))
  `).run();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO memories (
      id, sessionId, title, content, importance, category,
      unit_type, labels, tags, claim_status, source, source_app,
      temporal_context, createdAt, updatedAt
    ) VALUES (
      @id, @sessionId, @title, @content, @importance, @category,
      @unit_type, @labels, @tags, @claim_status, @source, @source_app,
      @temporal_context, @createdAt, @updatedAt
    )
  `);

  for (const m of memories) {
    insert.run(m);
    try {
      db.prepare("INSERT OR REPLACE INTO fts_memories (memory_id, title, content, labels) VALUES (?, ?, ?, ?)").run(
        m.id,
        m.title,
        m.content,
        m.labels
      );
    } catch {}
  }

  const wm = {
    sessionId: "BeBeBus",
    briefing: "近期完成了音频播放器状态机、分页加载竞态防抖、顶层悬浮组件触摸穿透以及专辑全部播放协议改造等核心修复。",
    focusAreas: JSON.stringify(["音频播控状态重置", "列表分页防抖与竞态处理", "UI 悬浮组件事件消费", "MQTT 播控三态同步"]),
    activeDecisions: JSON.stringify(["AudioAppStore 上下文变更时强制清空进度", "列表切换时重置 currentPage=1 并取消未决协程", "悬浮组件统一 consumes 点击事件"]),
    blockers: JSON.stringify([]),
    lastGeneratedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT OR REPLACE INTO working_memory (sessionId, briefing, focusAreas, activeDecisions, blockers, lastGeneratedAt, updatedAt)
    VALUES (@sessionId, @briefing, @focusAreas, @activeDecisions, @blockers, @lastGeneratedAt, @updatedAt)
  `).run(wm);

  console.log(`Successfully populated ${memories.length} memories into ${targetPath}`);
}
