<template>
  <div class="container">
    <h1>充电次数统计</h1>
    <button @click="loadToday">刷新今日数据</button>
    <p>今日插电次数：<b>{{ todayCount }}</b></p>

    <div ref="chartRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as echarts from "echarts";
import axios from "axios";

const todayCount = ref(0);
const chartRef = ref(null);
let chartInstance = null;

// 加载今日数据
async function loadToday() {
  try {
    const res = await axios.get("http://localhost:3000/stats/today");
    todayCount.value = res.data.today;
    drawChart(todayCount.value);
  } catch (err) {
    console.error("获取数据失败", err);
  }
}

function drawChart(value) {
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value);
  }
  const option = {
    title: {
      text: "今日充电次数",
      left: "center"
    },
    xAxis: {
      type: "category",
      data: ["今天"]
    },
    yAxis: {
      type: "value"
    },
    series: [
      {
        data: [value],
        type: "bar"
      }
    ]
  };
  chartInstance.setOption(option);
}

onMounted(() => {
  loadToday();
});
</script>

<style>
.container {
  max-width: 600px;
  margin: auto;
  text-align: center;
}
.chart {
  width: 100%;
  height: 400px;
  margin-top: 20px;
}
</style>
