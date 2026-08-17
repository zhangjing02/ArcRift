const Database = require('../node_modules/better-sqlite3');
const path = require('path');
const db = new Database(path.resolve(__dirname, '../ArcRift.db'));

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

const factsCount = db.prepare('SELECT count(*) as c FROM facts').get();
console.log('facts count:', factsCount);

const factsRows = db.prepare('SELECT * FROM facts LIMIT 10').all();
console.log('facts rows:', factsRows);
