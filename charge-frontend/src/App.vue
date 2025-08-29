<template>
  <div class="app">
    <h1>⚡ 充电统计 ⚡</h1>
    <button @click="refreshData">刷新数据</button>

    <div class="today">今日充电次数: {{ todayCount }}</div>

    <div class="heatmap-wrapper">
      <div class="grid-wrapper">
        <!-- 热力图格子 -->
        <div class="heatmap-grid">
          <div
            v-for="(item, index) in heatmapData"
            :key="item.date"
            class="cell"
            :class="'level-' + getLevel(item.count)"
            :title="item.date + ': ' + item.count + ' 次'"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from "vue";

export default {
  name: "App",
  setup() {
    const todayCount = ref(0);
    const heatmapData = ref([]);
    const monthLabels = ref([]);

    const getLocalDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    const refreshData = async () => {
      try {
        const res = await fetch("http://localhost:3000/charges");
        const rawData = await res.json();
        processData(rawData);
      } catch (e) {
        console.error("获取数据失败:", e);
      }
    };

    const processData = (rawData) => {
      // 统计每天次数
      const dailyCounts = {};
      rawData.forEach(item => {
        const date = item.timestamp.slice(0, 10); // 本地时间字符串
        dailyCounts[date] = (dailyCounts[date] || 0) + 1;
      });

      const today = new Date();
      const yearAgo = new Date(today);
      yearAgo.setFullYear(today.getFullYear() - 1);

      const data = [];
      const months = [];
      let lastMonth = null;
      let colIndex = 1; // grid-column 从 1 开始
      for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = getLocalDateStr(d);
        data.push({ date: dateStr, count: dailyCounts[dateStr] || 0, day: d.getDay() });

        // 记录月份的列位置（每月第一天）
        const month = d.toLocaleString('default', { month: 'short' });
        if (d.getDate() === 1) {
          months.push({ name: month, position: colIndex });
        }

        // 每周递增列索引，周日为7
        if (d.getDay() === 6) colIndex++;
      }

      heatmapData.value = data;
      monthLabels.value = months;
      todayCount.value = dailyCounts[getLocalDateStr(today)] || 0;
    };

    const getLevel = (count) => {
      if (count === 0) return 0;
      if (count <= 2) return 1;
      if (count <= 5) return 2;
      if (count <= 10) return 3;
      return 4;
    };

    onMounted(() => {
      refreshData();
    });

    return { todayCount, heatmapData, monthLabels, refreshData, getLevel };
  },
};
</script>

<style>
/* 整体 body 深色 */
body {
  margin: 0;
  padding: 0;
  background-color: #0d1117; /* GitHub 深色模式背景 */
  color: #c9d1d9;            /* 默认文字颜色 */
  font-family: Arial, sans-serif;
}

/* app 容器保持居中 */
.app {
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

/* 按钮风格 */
button {
  padding: 6px 12px;
  margin-bottom: 20px;
  cursor: pointer;
  background-color: #161b22;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 6px;
  transition: all 0.2s;
}
button:hover {
  background-color: #21262d;
}

/* 今日充电次数 */
.today {
  font-size: 20px;
  margin-bottom: 20px;
  color: #c9d1d9;
}

/* 热力图容器 */
.heatmap-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.heatmap-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 14px;
  grid-template-rows: repeat(7, 14px);
  gap: 4px;
}

/* 热力图格子 */
.cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: #161b22; /* 空白格背景 */
  transition: all 0.2s ease-in-out;
}

/* 热力等级颜色 */
.cell.level-1 { background-color: #0c4424; }
.cell.level-2 { background-color: #006d32; }
.cell.level-3 { background-color: #26a641; }
.cell.level-4 { background-color: #39d353; }

/* 悬停效果优化 */
.cell:hover {
  transform: scale(1.2);
  cursor: pointer;
  /* GitHub 深色模式 hover glow */
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.4);
  z-index: 10;
}
</style>
