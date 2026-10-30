import Database from 'better-sqlite3';
const db = new Database(':memory:');
db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
db.prepare('INSERT INTO test DEFAULT VALUES').run();
const row = db.prepare('SELECT * FROM test').get();
console.log('Database test:', row);
