const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 打开 SQLite 数据库（没有就新建）
const db = new sqlite3.Database("./charges.db", (err) => {
  if (err) console.error("打开数据库失败:", err.message);
  else console.log("已连接到 SQLite 数据库");
});

// 初始化表
db.run(`
  CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL
  )
`);

// 工具函数：格式化本地时间 YYYY-MM-DD HH:mm:ss
function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

// 插入充电事件
app.post("/charge", (req, res) => {
  const localTime = formatLocalDate(new Date());
  db.run(
    `INSERT INTO charges (timestamp) VALUES (?)`,
    [localTime],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, id: this.lastID, time: localTime });
    }
  );
});

// 查询所有充电事件
app.get("/charges", (req, res) => {
  db.all(`SELECT * FROM charges ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json(rows);
  });
});

// 获取最近7天每日充电次数
app.get("/stats/weekly", (req, res) => {
  db.all(
    `
    SELECT DATE(timestamp) as day, COUNT(*) as count
    FROM charges
    WHERE DATE(timestamp) >= DATE('now', '-6 days')
    GROUP BY DATE(timestamp)
    ORDER BY day ASC
    `,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });

      // 补全可能缺失的日期
      const result = [];
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = formatLocalDate(d).slice(0, 10); // YYYY-MM-DD
        const row = rows.find(r => r.day === dateStr);
        result.push({ day: dateStr, count: row ? row.count : 0 });
      }

      res.json(result);
    }
  );
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
