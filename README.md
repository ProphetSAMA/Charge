# iPhone 充电记录追踪器 📱⚡

一个基于 Node.js + SQLite 的 iPhone 充电事件记录系统，通过 iPhone 快捷指令自动记录每次充电时间，支持统计分析和可视化。

## 🌟 功能特色

- ⚡ **自动记录**：通过 iPhone 快捷指令自动检测充电事件
- 🕐 **精确时区**：自动处理时区转换，确保记录准确的北京时间
- 📊 **统计分析**：提供每日、每周、年度充电统计
- 🔥 **热力图数据**：支持 GitHub 风格的年度充电热力图
- 🐳 **Docker 部署**：一键部署，开箱即用
- 🚀 **轻量高效**：基于 SQLite，无需复杂数据库配置
- 🌐 **RESTful API**：标准化接口，易于集成和扩展

## 📋 目录

- [快速开始](#快速开始)
- [项目文件](#项目文件)
- [API 接口](#api-接口)
- [iPhone 快捷指令配置](#iphone-快捷指令配置)
- [部署指南](#部署指南)
- [数据统计](#数据统计)
- [故障排除](#故障排除)

## 🚀 快速开始

### Docker 部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd charge-tracker

# 构建镜像
docker build -t charge-tracker .

# 启动容器
docker run -d \
  --name charge-tracker \
  --restart unless-stopped \
  -p 8006:8006 \
  -v $(pwd)/data:/app/data \
  charge-tracker

# 查看运行状态
docker logs -f charge-tracker
```

### 本地开发

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 或开发模式
npm run dev
```

## 📁 项目文件

### package.json

```json name=package.json
{
  "name": "charge-tracker",
  "version": "1.0.0",
  "description": "iPhone充电记录追踪器",
  "main": "charge_api.js",
  "scripts": {
    "start": "node charge_api.js",
    "dev": "nodemon charge_api.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["iphone", "charging", "tracker", "sqlite", "express"],
  "author": "ProphetSAMA",
  "license": "MIT"
}
```

### Dockerfile

```dockerfile name=Dockerfile
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装tzdata包
RUN apk add --no-cache tzdata

# 设置时区环境变量
ENV TZ=Asia/Shanghai

# 设置时区链接
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 复制package文件
COPY package*.json ./

# 安装依赖
RUN npm install --production

# 复制源代码
COPY . .

# 创建数据目录并设置权限
RUN mkdir -p /app/data && chmod 755 /app/data

# 暴露端口
EXPOSE 8006

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8006/health || exit 1

# 启动应用
CMD ["node", "charge_api.js"]
```

### 主程序文件

```javascript name=charge_api.js
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
```

### Docker Compose 配置

```yaml name=docker-compose.yml
version: '3.8'

services:
  charge-tracker:
    build: .
    container_name: charge-tracker
    restart: unless-stopped
    ports:
      - "8006:8006"
    volumes:
      - ./data:/app/data
    environment:
      - TZ=Asia/Shanghai
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8006/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Nginx 反向代理配置

```nginx name=nginx.conf
server {
    listen 80;
    server_name api.charge.wsss.fun;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.charge.wsss.fun;
    
    # SSL 证书配置
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # 安全头
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # 代理配置
    location / {
        proxy_pass http://localhost:8006;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 超时设置
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }
    
    # 健康检查接口
    location /health {
        proxy_pass http://localhost:8006/health;
        access_log off;
    }
}
```

## 📡 API 接口

### 记录充电事件
```http
POST /charge
```

**响应示例：**
```json
{
  "success": true,
  "id": 1,
  "time": "2025-08-30 19:06:57",
  "utc_reference": "2025-08-30T11:06:57.254Z"
}
```

### 查询充电记录
```http
GET /charges
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "timestamp": "2025-08-30 19:06:57"
    }
  ],
  "total": 1,
  "current_china_time": "2025-08-30 19:07:04"
}
```

### 最近7天统计
```http
GET /stats/weekly
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "day": "2025-08-24",
      "count": 3
    },
    {
      "day": "2025-08-25",
      "count": 2
    }
  ]
}
```

### 年度统计数据
```http
GET /stats/yearly
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    ["2025-08-30", 5],
    ["2025-08-29", 3]
  ]
}
```

### 健康检查
```http
GET /health
```

### 时间测试
```http
GET /time-test
```

## 📱 iPhone 快捷指令配置

### 1. 创建自动化

1. 打开 iPhone **快捷指令** APP
2. 点击底部 **自动化** 标签
3. 点击右上角 **+** 号
4. 选择 **创建个人自动化**

### 2. 设置触发条件

1. 滚动找到 **充电器**
2. 选择 **已连接**
3. 点击 **下一步**

### 3. 添加操作

1. 点击 **添加操作**
2. 搜索并选择 **获取 URL 内容**
3. 配置如下：
   - **URL**: `https://api.charge.wsss.fun/charge`
   - **方法**: `POST`
   - **标头**: `Content-Type: application/json`

### 4. 完成设置

1. 点击 **下一步**
2. **关闭** "运行前询问"
3. 点击 **完成**

### 快捷指令导入配置

```json name=shortcut-config.json
{
  "name": "充电记录",
  "description": "自动记录iPhone充电事件",
  "trigger": {
    "type": "charger",
    "event": "connected"
  },
  "actions": [
    {
      "type": "get_url_contents",
      "url": "https://api.charge.wsss.fun/charge",
      "method": "POST",
      "headers": {
        "Content-Type": "application/json"
      }
    }
  ],
  "ask_before_running": false
}
```

## 🐳 部署指南

### 环境要求

- **Node.js**: >= 18.0
- **Docker**: >= 20.0 (可选)
- **系统**: Linux/macOS/Windows

### 一键部署脚本

```bash name=deploy.sh
#!/bin/bash

# 一键部署脚本
set -e

echo "🚀 开始部署充电记录追踪器..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 停止现有容器
echo "🛑 停止现有容器..."
docker stop charge-tracker 2>/dev/null || true
docker rm charge-tracker 2>/dev/null || true

# 构建新镜像
echo "🔨 构建Docker镜像..."
docker build -t charge-tracker:latest .

# 启动容器
echo "▶️ 启动容器..."
docker run -d \
  --name charge-tracker \
  --restart unless-stopped \
  -p 8006:8006 \
  -v $(pwd)/data:/app/data \
  charge-tracker:latest

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 健康检查
echo "🔍 执行健康检查..."
if curl -f http://localhost:8006/health > /dev/null 2>&1; then
    echo "✅ 部署成功！服务运行在 http://localhost:8006"
    echo "📖 查看日志: docker logs -f charge-tracker"
else
    echo "❌ 健康检查失败，请检查日志: docker logs charge-tracker"
    exit 1
fi
```

### PM2 部署配置

```javascript name=ecosystem.config.js
module.exports = {
  apps: [{
    name: 'charge-tracker',
    script: 'charge_api.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 8006,
      TZ: 'Asia/Shanghai'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
```

### SystemD 服务配置

```ini name=charge-tracker.service
[Unit]
Description=iPhone Charge Tracker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/charge-tracker
ExecStart=/usr/bin/node charge_api.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=TZ=Asia/Shanghai

[Install]
WantedBy=multi-user.target
```

## 📊 数据统计

### 数据库结构

```sql name=schema.sql
-- 充电记录表
CREATE TABLE IF NOT EXISTS charges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,  -- 格式: YYYY-MM-DD HH:MM:SS
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_charges_timestamp ON charges(timestamp);
CREATE INDEX IF NOT EXISTS idx_charges_date ON charges(substr(timestamp, 1, 10));
```

### 数据可视化示例

```python name=visualization.py
import requests
import matplotlib.pyplot as plt
import pandas as pd
from datetime import datetime, timedelta

def fetch_charging_data():
    """获取充电数据"""
    response = requests.get('https://api.charge.wsss.fun/charges')
    return response.json()['data']

def create_weekly_chart():
    """创建周统计图表"""
    response = requests.get('https://api.charge.wsss.fun/stats/weekly')
    data = response.json()['data']
    
    days = [item['day'] for item in data]
    counts = [item['count'] for item in data]
    
    plt.figure(figsize=(12, 6))
    plt.bar(days, counts, color='skyblue')
    plt.title('最近7天充电次数统计')
    plt.xlabel('日期')
    plt.ylabel('充电次数')
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.savefig('weekly_charging.png')
    plt.show()

def create_heatmap():
    """创建年度热力图"""
    response = requests.get('https://api.charge.wsss.fun/stats/yearly')
    data = response.json()['data']
    
    # 转换为DataFrame
    df = pd.DataFrame(data, columns=['date', 'count'])
    df['date'] = pd.to_datetime(df['date'])
    
    # 创建热力图数据
    # 这里可以使用seaborn或matplotlib创建类似GitHub的热力图
    
if __name__ == '__main__':
    create_weekly_chart()
```

## 🔧 故障排除

### 常见问题诊断脚本

```bash name=diagnose.sh
#!/bin/bash

echo "🔍 充电追踪器诊断工具"
echo "=========================="

# 检查Docker状态
echo "📦 Docker状态:"
docker ps | grep charge-tracker || echo "❌ 容器未运行"

# 检查端口
echo -e "\n🔌 端口状态:"
netstat -tlnp | grep 8006 || echo "❌ 端口8006未监听"

# 检查健康状态
echo -e "\n🏥 健康检查:"
curl -s http://localhost:8006/health | jq . || echo "❌ 健康检查失败"

# 检查日志
echo -e "\n📋 最新日志:"
docker logs --tail 10 charge-tracker 2>/dev/null || echo "❌ 无法获取日志"

# 检查数据库
echo -e "\n💾 数据库状态:"
if [ -f "./data/charges.db" ]; then
    echo "✅ 数据库文件存在"
    ls -lh ./data/charges.db
else
    echo "❌ 数据库文件不存在"
fi

# 网络测试
echo -e "\n🌐 网络测试:"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8006/health | grep 200 && echo " ✅ 本地访问正常" || echo " ❌ 本地访问失败"
```

### 日志分析脚本

```bash name=log-analysis.sh
#!/bin/bash

echo "📊 充电记录日志分析"
echo "==================="

# 统计今日充电次数
TODAY=$(date '+%Y-%m-%d')
TODAY_COUNT=$(docker logs charge-tracker 2>/dev/null | grep "充电事件已记录" | grep "$TODAY" | wc -l)
echo "今日充电次数: $TODAY_COUNT"

# 最近充电时间
LAST_CHARGE=$(docker logs charge-tracker 2>/dev/null | grep "充电事件已记录" | tail -1)
echo "最近充电: $LAST_CHARGE"

# 错误统计
ERROR_COUNT=$(docker logs charge-tracker 2>/dev/null | grep -i error | wc -l)
echo "错误次数: $ERROR_COUNT"

# 服务重启次数
RESTART_COUNT=$(docker logs charge-tracker 2>/dev/null | grep "服务启动成功" | wc -l)
echo "重启次数: $RESTART_COUNT"
```

### 数据备份脚本

```bash name=backup.sh
#!/bin/bash

BACKUP_DIR="./backups"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/charges_backup_$DATE.db"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 备份数据库
if [ -f "./data/charges.db" ]; then
    cp "./data/charges.db" "$BACKUP_FILE"
    echo "✅ 数据库已备份到: $BACKUP_FILE"
    
    # 压缩备份文件
    gzip "$BACKUP_FILE"
    echo "✅ 备份文件已压缩: $BACKUP_FILE.gz"
    
    # 清理7天前的备份
    find "$BACKUP_DIR" -name "*.gz" -mtime +7 -delete
    echo "✅ 已清理7天前的备份文件"
else
    echo "❌ 数据库文件不存在，无法备份"
fi
```

## 📈 扩展功能

### 数据导出功能

```javascript name=export-extension.js
// 添加到主程序中的数据导出接口

// 导出CSV格式数据
app.get("/export/csv", (req, res) => {
  try {
    db.all(`SELECT * FROM charges ORDER BY timestamp DESC`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      // 生成CSV内容
      let csv = "ID,时间\n";
      rows.forEach(row => {
        csv += `${row.id},${row.timestamp}\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=charging_data.csv');
      res.send(csv);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出JSON格式数据
app.get("/export/json", (req, res) => {
  try {
    db.all(`SELECT * FROM charges ORDER BY timestamp DESC`, [], (err, rows) => {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      
      const exportData = {
        export_time: getChinaDateTime(),
        total_records: rows.length,
        data: rows
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=charging_data.json');
      res.json(exportData);
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Web管理界面

```html name=admin.html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>充电记录管理</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 20px 0; padding: 20px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; }
        .stat-item { text-align: center; }
        .stat-number { font-size: 2em; font-weight: bold; color: #007AFF; }
        button { background: #007AFF; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        button:hover { background: #0056B3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>📱 iPhone充电记录管理</h1>
        
        <div class="card">
            <h2>📊 统计概览</h2>
            <div class="stats" id="stats">
                <!-- 统计数据将在这里动态加载 -->
            </div>
        </div>
        
        <div class="card">
            <h2>📈 最近7天趋势</h2>
            <canvas id="weeklyChart" width="400" height="200"></canvas>
        </div>
        
        <div class="card">
            <h2>📋 最新记录</h2>
            <div id="recentRecords">
                <!-- 最新记录将在这里显示 -->
            </div>
            <button onclick="exportData('csv')">导出CSV</button>
            <button onclick="exportData('json')">导出JSON</button>
        </div>
    </div>

    <script>
        // API基础URL
        const API_BASE = window.location.origin;
        
        // 加载统计数据
        async function loadStats() {
            try {
                const response = await fetch(`${API_BASE}/charges`);
                const data = await response.json();
                
                const today = new Date().toISOString().slice(0, 10);
                const todayCount = data.data.filter(record => 
                    record.timestamp.startsWith(today.replace(/-/g, '-'))
                ).length;
                
                document.getElementById('stats').innerHTML = `
                    <div class="stat-item">
                        <div class="stat-number">${data.total}</div>
                        <div>总充电次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${todayCount}</div>
                        <div>今日充电次数</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number">${data.current_china_time}</div>
                        <div>当前时间</div>
                    </div>
                `;
            } catch (error) {
                console.error('加载统计数据失败:', error);
            }
        }
        
        // 加载周趋势图
        async function loadWeeklyChart() {
            try {
                const response = await fetch(`${API_BASE}/stats/weekly`);
                const data = await response.json();
                
                const ctx = document.getElementById('weeklyChart').getContext('2d');
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.data.map(item => item.day),
                        datasets: [{
                            label: '充电次数',
                            data: data.data.map(item => item.count),
                            borderColor: '#007AFF',
                            backgroundColor: 'rgba(0, 122, 255, 0.1)',
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    stepSize: 1
                                }
                            }
                        }
                    }
                });
            } catch (error) {
                console.error('加载趋势图失败:', error);
            }
        }
        
        // 加载最新记录
        async function loadRecentRecords() {
            try {
                const response = await fetch(`${API_BASE}/charges`);
                const data = await response.json();
                
                const html = data.data.slice(0, 10).map(record => 
                    `<div>ID: ${record.id} - ${record.timestamp}</div>`
                ).join('');
                
                document.getElementById('recentRecords').innerHTML = html;
            } catch (error) {
                console.error('加载最新记录失败:', error);
            }
        }
        
        // 导出数据
        function exportData(format) {
            window.open(`${API_BASE}/export/${format}`, '_blank');
        }
        
        // 页面加载时初始化
        window.onload = function() {
            loadStats();
            loadWeeklyChart();
            loadRecentRecords();
            
            // 每30秒更新一次数据
            setInterval(() => {
                loadStats();
                loadRecentRecords();
            }, 30000);
        };
    </script>
</body>
</html>
```

## 📄 许可证

```text name=LICENSE
MIT License

Copyright (c) 2025 ProphetSAMA

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 👨‍💻 作者

**ProphetSAMA**

- GitHub: [@ProphetSAMA](https://github.com/ProphetSAMA)
- 项目创建时间：2025-08-30 00:32:16 (UTC+8)
- 最后更新：2025-08-30 19:15:44 (UTC+8)

---

⭐ 如果这个项目对您有帮助，请给个 Star！

🐛 发现问题？欢迎提交 [Issue](https://github.com/ProphetSAMA/charge-tracker/issues)

🚀 想要贡献代码？欢迎提交 [Pull Request](https://github.com/ProphetSAMA/charge-tracker/pulls)
