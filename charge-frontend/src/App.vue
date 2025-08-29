<template>
  <div class="container">
    <h1>充电次数统计</h1>
    <button @click="loadToday">刷新今日数据</button>
    <p>今日插电次数：<b>{{ todayCount }}</b></p>

    <div ref="chartTodayRef" class="chart"></div>

    <h2>最近一周充电次数</h2>
    <div ref="chartWeekRef" class="chart"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import * as echarts from "echarts";
import axios from "axios";

const todayCount = ref(0);
const chartTodayRef = ref(null);
const chartWeekRef = ref(null);
let chartToday = null;
let chartWeek = null;

// 加载今日数据
async function loadToday() {
  try {
    const res = await axios.get("http://localhost:3000/stats/today");
    todayCount.value = res.data.today;
    drawTodayChart(todayCount.value);
  } catch (err) {
    console.error("获取今日数据失败", err);
  }
}

// 绘制今日柱状图
function drawTodayChart(value) {
  if (!chartToday) chartToday = echarts.init(chartTodayRef.value);
  chartToday.setOption({
    title: { text: "今日充电次数", left: "center" },
    xAxis: { type: "category", data: ["今天"] },
    yAxis: { type: "value" },
    series: [{ data: [value], type: "bar" }]
  });
}

// 加载最近一周数据
async function loadWeekly() {
  try {
    const res = await axios.get("http://localhost:3000/stats/weekly");
    const days = res.data.map(r => r.day.slice(5)); // MM-DD
    const counts = res.data.map(r => r.count);
    drawWeekChart(days, counts);
  } catch (err) {
    console.error("获取一周数据失败", err);
  }
}

// 绘制一周折线图
function drawWeekChart(days, counts) {
  if (!chartWeek) chartWeek = echarts.init(chartWeekRef.value);
  chartWeek.setOption({
    title: { text: "最近一周充电次数", left: "center" },
    xAxis: { type: "category", data: days },
    yAxis: { type: "value" },
    series: [{ data: counts, type: "line", smooth: true }]
  });
}

onMounted(() => {
  loadToday();
  loadWeekly();
});
</script>

<style>
.container { max-width: 600px; margin: auto; text-align: center; }
.chart { width: 100%; height: 400px; margin-top: 20px; }
</style>
