const Database = require('../node_modules/better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, '../ArcRift.db'));

const bebebusTriples = [
  {
    sessionId: 'BeBeBus',
    subject: 'AiMqttOtaChannel',
    subjectType: 'Tech',
    relation: 'uses_method',
    object: 'triggerUpgradeTask',
    objectType: 'Tech'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'triggerUpgradeTask',
    subjectType: 'Tech',
    relation: 'changed_to',
    object: 'postBodyAsync (POST Body)',
    objectType: 'Architecture'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'POST /api/v2/device/ota/start',
    subjectType: 'Concept',
    relation: 'requires_body',
    object: 'deviceId JSON',
    objectType: 'Rule'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'BeBeBus Hardware Protocol',
    subjectType: 'Architecture',
    relation: 'uses_mqtt_cmd',
    object: 'cmd=2020 (CMD_OTA_PROGRESS)',
    objectType: 'Tech'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'CMD_OTA_PROGRESS',
    subjectType: 'Tech',
    relation: 'reports_error',
    object: 'errorCode 12 (安装校验失败)',
    objectType: 'Gotcha'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'CMD_OTA_PROGRESS',
    subjectType: 'Tech',
    relation: 'reports_error',
    object: 'errorCode 8 (目标版本未升高)',
    objectType: 'Gotcha'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'OTA Process',
    subjectType: 'Concept',
    relation: 'eliminates',
    object: '15s 假成功超时等待',
    objectType: 'Rule'
  },
  {
    sessionId: 'BeBeBus',
    subject: 'Retry Button',
    subjectType: 'Tech',
    relation: 'fixes_defect',
    object: '白色字体残留Bug',
    objectType: 'Rule'
  }
];

const insert = db.prepare(`
  INSERT INTO facts (sessionId, subject, subjectType, relation, object, objectType, timestamp)
  VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
`);

const insertMany = db.transaction((triples) => {
  for (const t of triples) {
    insert.run(t.sessionId, t.subject, t.subjectType, t.relation, t.object, t.objectType);
  }
});

insertMany(bebebusTriples);

db.prepare(`UPDATE sessions SET tripleCount = ? WHERE id = 'BeBeBus'`).run(bebebusTriples.length);

console.log('Successfully inserted', bebebusTriples.length, 'triples into facts for BeBeBus');
