const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8006;

app.use(cors());
app.use(express.json());

// 确保数据目录存在
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log("创建数据目录:", dataDir);
}

// 数据库路径
const dbPath = path.join(dataDir, "charges.db");

// 打开 SQLite 数据库
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("打开数据库失败:", err.message);
    process.exit(1);
  } else {
    console.log("已连接到 SQLite 数据库:", dbPath);
  }
});

// 初始化表
db.run(`
  CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL
  )
`, (err) => {
  if (err) {
    console.error("创建表失败:", err.message);
    process.exit(1);
  } else {
    console.log("数据库表初始化完成");
  }
});

// ✅ 绝对确保中国时间正确的函数
function getChinaDateTime() {
  // 获取当前UTC时间戳
  const nowUTC = new Date();
  const utcTimestamp = nowUTC.getTime();
  
  // 中国时区偏移：UTC+8 = 8小时 = 8*60*60*1000毫秒
  const CHINA_TIMEZONE_OFFSET = 8 * 60 * 60 * 1000;
  
  // 计算中国时间戳
  const chinaTimestamp = utcTimestamp + CHINA_TIMEZONE_OFFSET;
  
  // 创建中国时间对象
  const chinaTime = new Date(chinaTimestamp);
  
  // 格式化为字符串（使用UTC方法避免本地时区影响）
  const year = chinaTime.getUTCFullYear();
  const month = String(chinaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(chinaTime.getUTCDate()).padStart(2, '0');
  const hour = String(chinaTime.getUTCHours()).padStart(2, '0');
  const minute = String(chinaTime.getUTCMinutes()).padStart(2, '0');
  const second = String(chinaTime.getUTCSeconds()).padStart(2, '0');
  
  const result = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  
  // 调试输出
  console.log(`UTC时间戳: ${utcTimestamp}`);
  console.log(`中国时间戳: ${chinaTimestamp}`);
  console.log(`UTC时间: ${nowUTC.toISOString()}`);
  console.log(`计算的中国时间: ${result}`);
  
  return result;
}

// 插入充电事件
app.post("/charge", (req, res) => {
  try {
    const chinaTime = getChinaDateTime();
    
    console.log('=== 充电事件记录 ===');
    console.log(`插入时间: ${chinaTime}`);

    db.run(`INSERT INTO charges (timestamp) VALUES (?)`, [chinaTime], function(err) {
      if (err) {
        console.error("插入数据失败:", err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
      
      console.log(`✅ 充电事件已记录 - ID: ${this.lastID}, 时间: ${chinaTime}`);
      
      res.json({ 
        success: true, 
        id: this.lastID, 
        time: chinaTime,
        utc_reference: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error("处理充电事件失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 查询所有充电事件
app.get("/charges", (req, res) => {
  try {
    db.all(`SELECT * FROM charges ORDER BY id DESC LIMIT 100`, [], (err, rows) => {
      if (err) {
        console.error("查询数据失败:", err.message);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({
        success: true,
        data: rows,
        total: rows.length,
        current_china_time: getChinaDateTime(),
        current_utc_time: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error("查询充电事件失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 最近7天统计
app.get("/stats/weekly", (req, res) => {
  try {
    // 获取最近7天的日期列表（基于中国时间）
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const baseTime = new Date();
      const chinaTimestamp = baseTime.getTime() + (8 * 60 * 60 * 1000);
      const chinaDate = new Date(chinaTimestamp);
      chinaDate.setUTCDate(chinaDate.getUTCDate() - i);
      
      const dateStr = `${chinaDate.getUTCFullYear()}-${String(chinaDate.getUTCMonth() + 1).padStart(2, '0')}-${String(chinaDate.getUTCDate()).padStart(2, '0')}`;
      last7Days.push(dateStr);
    }

    db.all(`SELECT timestamp FROM charges ORDER BY timestamp ASC`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      const dailyCounts = {};
      rows.forEach(row => {
        const day = row.timestamp.slice(0, 10); // 提取日期部分
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      const result = last7Days.map(day => ({
        day,
        count: dailyCounts[day] || 0
      }));

      res.json({
        success: true,
        data: result,
        current_china_time: getChinaDateTime()
      });
    });
  } catch (error) {
    console.error("周统计失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 年度统计
app.get("/stats/yearly", (req, res) => {
  try {
    db.all(`SELECT timestamp FROM charges ORDER BY timestamp ASC`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }

      const dailyCounts = {};
      rows.forEach(row => {
        const day = row.timestamp.slice(0, 10);
        dailyCounts[day] = (dailyCounts[day] || 0) + 1;
      });

      // 转换为热力图需要的格式
      const data = Object.entries(dailyCounts).map(([date, count]) => [date, count]);

      res.json({
        success: true,
        data: data,
        current_china_time: getChinaDateTime()
      });
    });
  } catch (error) {
    console.error("年统计失败:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 健康检查
app.get("/health", (req, res) => {
  const now = new Date();
  res.json({
    status: "healthy",
    server_utc_time: now.toISOString(),
    server_local_time: now.toString(),
    calculated_china_time: getChinaDateTime(),
    timezone_env: process.env.TZ || 'not_set',
    uptime_seconds: Math.floor(process.uptime())
  });
});

// 时间测试接口
app.get("/time-test", (req, res) => {
  const now = new Date();
  const chinaTime = getChinaDateTime();
  
  res.json({
    utc_iso: now.toISOString(),
    utc_timestamp: now.getTime(),
    china_calculated: chinaTime,
    china_should_be: `${now.toISOString().slice(0, 11)}${String(now.getUTCHours() + 8).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`,
    offset_hours: 8,
    calculation_method: 'UTC_timestamp + 8_hours_in_milliseconds'
  });
});

// 错误处理
process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  process.exit(1);
});

// 优雅关闭
function gracefulShutdown() {
  console.log('正在关闭服务器...');
  if (db) {
    db.close((err) => {
      if (err) console.error('关闭数据库失败:', err);
      else console.log('数据库已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 启动服务器
const server = app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 充电记录服务启动成功');
  console.log(`📡 监听端口: ${PORT}`);
  console.log(`🕐 UTC时间: ${new Date().toISOString()}`);
  console.log(`🇨🇳 中国时间: ${getChinaDateTime()}`);
  console.log(`🆔 进程ID: ${process.pid}`);
  console.log('=================================');
});

server.on('error', (err) => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});