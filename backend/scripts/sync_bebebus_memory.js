const Database = require('better-sqlite3');
const db = new Database('d:/Devs/ArcRift/backend/ChronosMind.db');

const memory = {
  id: 'mem_1e974df6-244f-48f4-9611-d68fb47a91c9',
  sessionId: 'BeBeBus',
  title: 'BeBeBus Android 合并 master 至 feature/het_seat 与新设备蓝牙双通道兼容总结',
  content: `【项目分支合并里程碑】：成功将 master（1.3.0 线上新代码）合并至 feature/het_seat，并完整保留太空舱 AI 版（小金盾 AI 版）的全套新特性代码。

【关键冲突处置与架构融合总结】：
1. 老设备详情与通用模块（AstronomerDetailsFragment、SpaceCapsuleDetailsFragment、Mine 模块、在线帮助、弹窗优化）：直接 Accept Master 吸收线上最新修复。
2. 网络底层架构（ProRequest、NoHttpRequestImpl）：保留 Application Context 传参支持，确保 ViewModel 网络请求解耦且防内存泄露，并融合 Master 的 mCancelSign。
3. 蓝牙协议与多设备分发（BlueToothUtil）：
   - 保留新设备专属 UUID（AI_TERRELLA_SERVICE_UUID: 0000fff0..., WRITE: 0000fff1..., NOTIFY: 0000fff2...）。
   - 连接与发现服务时对 type == 2 进行动态 UUID 校验与绑定。
   - 在 dispatchTerrellaData 中对 type == 2 进行分流，直接走 dispatchRawData 分发原始字节流给 AiBleChannel / AiBleProtocol，避免被老太空舱的 0x04 协议误解析。
4. 首页与生命周期（DeviceFragment）：
   - 补充 SpaceCapsuleAiDetailsFragment 加载与点击卡片 openDeviceDetail 分发。
   - 增加 AI 设备蓝牙被动断开时的拦截逻辑，由 4G/MQTT 通道无缝保活托管。
5. 路由与清单：
   - 完整保留 RoutePathCommon 及 Manifest 中 SpaceCapsuleAi 相关的 4 个 Activity 注册。`,
  importance: '0.95',
  category: 'Merge',
  tags: JSON.stringify(['BeBeBus', 'android', 'git-merge', 'bluetooth', 'architecture']),
  source: 'mcp',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  unit_type: 'decision',
  labels: JSON.stringify(['BeBeBus', 'android', 'git-merge', 'bluetooth']),
  claim_status: 'asserted',
  is_latest: 1,
  source_app: 'Antigravity',
  temporal_context: 'timeless'
};

const stmt = db.prepare(`
  INSERT OR REPLACE INTO memories (
    id, sessionId, title, content, importance, category, tags, source,
    createdAt, updatedAt, unit_type, labels, claim_status, evolves_from_id,
    evolves_relation, is_latest, source_app, temporal_context
  ) VALUES (
    @id, @sessionId, @title, @content, @importance, @category, @tags, @source,
    @createdAt, @updatedAt, @unit_type, @labels, @claim_status, null,
    null, @is_latest, @source_app, @temporal_context
  )
`);

stmt.run(memory);
console.log('Successfully inserted into ChronosMind.db with sessionId: BeBeBus');

// Verify
const count = db.prepare("SELECT count(*) as c FROM memories WHERE sessionId='BeBeBus'").get();
console.log('Total BeBeBus memories in ChronosMind.db:', count);
