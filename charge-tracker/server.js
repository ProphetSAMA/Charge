const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
// 端口
const PORT = 3000;

// 使用 JSON body
app.use(express.json());

// 数据库初始化
const dbPath = path.join(__dirname, "charge.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// 插入充电事件
app.post("/charge", (req, res) => {
  db.run(`INSERT INTO charges (timestamp) VALUES (CURRENT_TIMESTAMP)`, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, id: this.lastID });
  });
});

// 今日充电次数
app.get("/stats/today", (req, res) => {
  db.get(
    `
    SELECT COUNT(*) as count 
    FROM charges 
    WHERE DATE(timestamp) = DATE('now', 'localtime')
    `,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ today: row.count });
    }
  );
});

app.listen(PORT, () => {
  console.log(`服务运行在: http://localhost:${PORT}`);
});
