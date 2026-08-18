const Database = require('better-sqlite3');
const db = new Database('./ChronosMind.db');

console.log('=== MEMORIES SCHEMA ===');
console.log(db.prepare("PRAGMA table_info(memories)").all());

console.log('\n=== ALL MEMORIES ===');
const rows = db.prepare("SELECT id, title, sessionId, unit_type, category, importance, createdAt FROM memories").all();
console.log(JSON.stringify(rows, null, 2));
