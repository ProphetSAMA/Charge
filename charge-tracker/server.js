const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json());

// 打开 SQLite 数据库（没有就新建）
const db = new sqlite3.Database("./charges.db", (err) => {
  if (err) {
    console.error("打开数据库失败:", err.message);
  } else {
    console.log("已连接到 SQLite 数据库");
  }
});

// 初始化表
db.run(`
  CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL
  )
`);

// 插入充电事件 (直接存本地时间)
app.post("/charge", (req, res) => {
  const now = new Date();
  // 系统本地时间字符串 (yyyy-MM-dd HH:mm:ss 格式)
  const localTime = now.toLocaleString("zh-CN", {
    hour12: false,
  }).replace(/\//g, "-");

  db.run(
    `INSERT INTO charges (timestamp) VALUES (?)`,
    [localTime],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, id: this.lastID, time: localTime });
    }
  );
});

// 查询充电记录 (直接取出，不再转换)
app.get("/charges", (req, res) => {
  db.all(`SELECT * FROM charges ORDER BY id DESC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
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
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // 补全可能缺失的日期（比如某天没有充电事件）
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const dateStr = new Date(Date.now() - i * 86400000)
          .toISOString()
          .slice(0, 10);
        const row = rows.find(r => r.day === dateStr);
        result.push({ day: dateStr, count: row ? row.count : 0 });
      }

      res.json(result);
    }
  );
});


// 启动服务
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
