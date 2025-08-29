<template>
  <div class="app">
    <h1>⚡ 充电统计</h1>
    
    <button @click="refreshData">刷新数据</button>

    <!-- 今日充电次数 -->
    <div class="today">
      今日充电次数: {{ todayCount }}
    </div>

    <!-- 近一周折线图 -->
    <div ref="weeklyChart" class="chart"></div>

    <!-- GitHub 风格热力日历 -->
    <div ref="heatmapChart" class="chart"></div>
  </div>
</template>

<script>
import * as echarts from "echarts";
import axios from "axios";

export default {
  name: "App",
  data() {
    return {
      todayCount: 0,
      weeklyData: [],
      yearlyData: []
    };
  },
  methods: {
    // 获取本地今天日期 YYYY-MM-DD
    getTodayStr() {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    },

    // 刷新按钮统一调用
    async refreshData() {
      await this.fetchWeekly();
      await this.fetchYearly();
    },

    // 拉取近7天数据
    async fetchWeekly() {
      try {
        const res = await axios.get("http://localhost:3000/stats/weekly");
        this.weeklyData = res.data;

        const todayStr = this.getTodayStr();
        const todayRow = this.weeklyData.find(d => d.day === todayStr);
        this.todayCount = todayRow ? todayRow.count : 0;

        this.renderWeeklyChart();
      } catch (e) {
        console.error("获取近7天数据失败:", e);
      }
    },

    renderWeeklyChart() {
      const chart = echarts.init(this.$refs.weeklyChart);
      const option = {
        title: { text: '近7天充电次数' },
        xAxis: { type: 'category', data: this.weeklyData.map(d => d.day) },
        yAxis: { type: 'value' },
        series: [{
          data: this.weeklyData.map(d => d.count),
          type: 'line',
          smooth: true,
          areaStyle: {}
        }]
      };
      chart.setOption(option);
    },

    // 拉取过去一年数据
    async fetchYearly() {
      try {
        const res = await axios.get("http://localhost:3000/charges");
        const dailyCounts = {};
        res.data.forEach(r => {
          const day = r.timestamp.slice(0, 10);
          dailyCounts[day] = (dailyCounts[day] || 0) + 1;
        });

        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);

        const calendarData = [];
        for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().slice(0, 10);
          calendarData.push([dayStr, dailyCounts[dayStr] || 0]);
        }

        this.yearlyData = calendarData;
        this.renderHeatmapChart();
      } catch (e) {
        console.error("获取过去一年数据失败:", e);
      }
    },

    renderHeatmapChart() {
      const chart = echarts.init(this.$refs.heatmapChart);
      const option = {
        title: { text: '过去一年充电热力图' },
        tooltip: {},
        visualMap: {
          min: 0,
          max: Math.max(...this.yearlyData.map(d => d[1])),
          inRange: { color: ['#eeeeee', '#3399ff'] }
        },
        calendar: {
          range: [new Date().getFullYear()],
          cellSize: ['20', '20']
        },
        series: [{
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: this.yearlyData
        }]
      };
      chart.setOption(option);
    }
  },
  mounted() {
    this.refreshData(); // 初次加载数据
  }
};
</script>

<style scoped>
.app {
  font-family: Arial, sans-serif;
  padding: 20px;
}
.chart {
  width: 100%;
  height: 300px;
  margin-top: 20px;
}
.today {
  font-size: 20px;
  margin-bottom: 20px;
}
button {
  padding: 6px 12px;
  margin-bottom: 20px;
  cursor: pointer;
}
</style>
