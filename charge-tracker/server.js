const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const PORT = 8006;

app.use(cors());
app.use(express.json());

// 打开 SQLite 数据库
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

// ✅ 手动获取北京时间（CST+8）
function getCSTDateTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000; // 转 UTC
  const cst = new Date(utc + 8 * 3600 * 1000); // UTC+8

  const Y = cst.getFullYear();
  const M = String(cst.getMonth() + 1).padStart(2, '0');
  const D = String(cst.getDate()).padStart(2, '0');
  const h = String(cst.getHours()).padStart(2, '0');
  const m = String(cst.getMinutes()).padStart(2, '0');
  const s = String(cst.getSeconds()).padStart(2, '0');

  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

function getCSTDate() {
  return getCSTDateTime().slice(0, 10); // YYYY-MM-DD
}

// 插入充电事件
app.post("/charge", (req, res) => {
  const localTime = getCSTDateTime();

  db.run(`INSERT INTO charges (timestamp) VALUES (?)`, [localTime], function(err) {
    if (err) return res.status(500).json({ success: false, error: err.message });
    console.log("检测到充电事件:", localTime);
    res.json({ success: true, id: this.lastID, time: localTime });
  });
});

// 查询所有充电事件
app.get("/charges", (req, res) => {
  db.all(`SELECT * FROM charges ORDER BY id DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json(rows);
  });
});

// 最近7天每日充电次数
app.get("/stats/weekly", (req, res) => {
  const today = new Date();
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    last7Days.push(`${Y}-${M}-${D}`);
  }

  db.all(`SELECT timestamp FROM charges ORDER BY timestamp ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const dailyCounts = {};
    rows.forEach(r => {
      const day = r.timestamp.slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    const result = last7Days.map(day => ({
      day,
      count: dailyCounts[day] || 0
    }));

    res.json(result);
  });
});

// 过去一年每日充电次数，用于热力图
app.get("/stats/yearly", (req, res) => {
  const today = new Date();
  const yearAgo = new Date(today);
  yearAgo.setFullYear(today.getFullYear() - 1);

  const days = [];
  for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, '0');
    const D = String(d.getDate()).padStart(2, '0');
    days.push(`${Y}-${M}-${D}`);
  }

  db.all(`SELECT timestamp FROM charges ORDER BY timestamp ASC`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    const dailyCounts = {};
    rows.forEach(r => {
      const day = r.timestamp.slice(0, 10);
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    const data = days.map(day => [day, dailyCounts[day] || 0]);
    res.json(data);
  });
});

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
