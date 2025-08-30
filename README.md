使用方法：

1. 配置iPhone快捷指令

    URL：https://api.charge.wsss.fun/charge
    方法：POST
    触发时机：连接电源时

2. 查看统计数据

    所有记录：https://api.charge.wsss.fun/charges
    最近7天：https://api.charge.wsss.fun/stats/weekly
    年度数据：https://api.charge.wsss.fun/stats/yearly

3. 监控服务状态

    健康检查：https://api.charge.wsss.fun/health
    时间测试：https://api.charge.wsss.fun/time-test

📱 iPhone快捷指令建议设置：

    打开快捷指令APP
    创建新的自动化
    选择"充电器" → "已连接"
    添加"获取URL内容"操作
    URL设置为：https://api.charge.wsss.fun/charge
    方法：POST
    保存并启用

现在每次您给iPhone充电时，都会自动记录准确的北京时间！🚀📱⚡


1. **iPhone 端触发器**
    
    - 利用快捷指令（Shortcuts），在“插入充电器”动作发生时，自动发送一个 HTTP 请求到你的后端。
        
    - 请求内容很简单，比如：`POST /charge`，Body 里带上 `{"timestamp": "2025-08-29T23:00:00Z"}`。
        
2. **后端（Node.js 轻量化实现）**
    
    - 提供一个 REST API，接收请求并写入数据库。
        
    - 再提供一个查询接口，例如：
        
        - 今日充电次数
            
        - 历史统计（按天/周/月）
            
3. **前端（Vue3）**
    
    - 展示统计数据：柱状图、折线图、日历热力图。
        
    - 简单 UI 就行，主要是数据可视化。

### 数据库选型讨论

这里的数据量其实非常小，每天就几十条记录（就算天天插拔也撑死 200 次）。核心操作是 **插入一条事件** + **按时间聚合查询**。

- **MySQL**：
    
    - 优点：查询按天统计很自然，`GROUP BY DATE(timestamp)` 就能搞定。
        
    - 缺点：要建表，跑个 MySQL 服务，配置稍显重量。
        
- **MongoDB**：
    
    - 优点：插入事件超轻松，直接 `insertOne`。聚合查询可以用 `$group`。
        
    - 缺点：时间聚合稍微麻烦点，不如 SQL 那么直观。
        
- **超轻量选项**（推荐）：
    
    - 用 **SQLite**（嵌入式数据库）。
        
    - Node 直接依赖一个文件，连独立数据库服务都不用开。数据量小，完全够用。
        
    - 查询也支持标准 SQL，统计数据简洁。
      
### 技术架构

- **后端**：Express（超轻量）
    
    - `POST /charge` → 写入 `timestamp`
        
    - `GET /stats?day=2025-08-29` → 返回当天次数
        
    - `GET /stats/weekly` → 返回一周内每天的次数
        
- **数据库**：SQLite（轻到飞起，适合这种玩具项目）
    
- **前端**：Vue3 + ECharts（画统计图）
┌────────────────────┐
│      iPhone        │
│  (快捷指令触发)   │
│ 插入充电器 → POST  │
│ http://server/charge│
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│      Node.js        │
│  (Express 后端)    │
│ - 接收 POST /charge │
│ - 写入 SQLite 数据库 │
│ - 提供 GET /stats   │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│      SQLite        │
│ (charge.db 文件)  │
│ - 存储充电事件      │
│ - 支持 SQL 查询     │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│      Vue3 前端      │
│ - 调用 GET /stats   │
│ - 显示今日/周/月数据 │
│ - 使用 ECharts 图表 │
└────────────────────┘

开发工具：
- VS Code：前后端开发统一使用
- 浏览器 Devtools + Vue Devtools：前端调试
- DB Browser for SQLite：数据库查看
- Postman/REST Client：接口调试（可选）


