<template>
  <div class="app">
    <h1>⚡ 充电统计 ⚡</h1>
    <button @click="refreshData">刷新数据</button>

    <div class="today">
      今日充电次数: 
      <span class="animated-number" :class="{ loading: isLoadingNumber }">
        {{ isLoadingNumber ? '' : displayCount }}
      </span>
      <div v-if="isLoadingNumber" class="loading-dots"></div>
    </div>

    <!-- 热力图容器 - 骨架屏 -->
    <div class="heatmap-wrapper">
      <div class="grid-wrapper">
        <!-- 首次加载时显示骨架屏 -->
        <div v-if="isInitialLoading" class="skeleton-heatmap">
          <div class="skeleton-grid">
            <div 
              v-for="n in 371" 
              :key="`skeleton-${n}`"
              class="skeleton-cell"
            ></div>
          </div>
        </div>
        
        <!-- 实际热力图 -->
        <div v-else class="heatmap-grid" :class="{ refreshing: isRefreshing }">
          <div
            v-for="(item, index) in heatmapData"
            :key="item.date"
            class="cell"
            :class="'level-' + getLevel(item.count)"
            :title="item.date + ': ' + item.count + ' 次'"
          ></div>
        </div>
      </div>
      
      <!-- 刷新指示器 -->
      <div v-if="isRefreshing" class="refresh-indicator">
        <span class="refresh-icon">🔄</span>
        <span>正在更新...</span>
      </div>
    </div>
    
    <!-- 添加调试信息 -->
    <div class="debug-info" v-if="debugMode">
      <h3>调试信息</h3>
      <p>总记录数: {{ totalRecords }}</p>
      <p>最后更新: {{ lastUpdate }}</p>
      <p>API状态: {{ apiStatus }}</p>
      <p>首次加载: {{ isInitialLoading ? '是' : '否' }}</p>
      <p>刷新中: {{ isRefreshing ? '是' : '否' }}</p>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, watch } from "vue";

export default {
  name: "App",
  setup() {
    const todayCount = ref(0);
    const displayCount = ref(0);
    const isInitialLoading = ref(true); // 首次加载状态
    const isRefreshing = ref(false); // 刷新状态
    const isLoadingNumber = ref(true); // 数字加载状态
    const heatmapData = ref([]);
    const monthLabels = ref([]);
    const totalRecords = ref(0);
    const lastUpdate = ref('');
    const apiStatus = ref('未连接');
    const debugMode = ref(false);
    const hasLoadedOnce = ref(false); // 是否已经加载过一次

    const getLocalDateStr = (date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };

    // 数字动画函数
    const animateNumber = (targetValue, duration = 1000) => {
      const startValue = displayCount.value;
      const difference = targetValue - startValue;
      const startTime = Date.now();

      const updateNumber = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = Math.round(startValue + difference * easeOutQuart);
        
        displayCount.value = currentValue;

        if (progress < 1) {
          requestAnimationFrame(updateNumber);
        }
      };

      requestAnimationFrame(updateNumber);
    };

    // 监听todayCount变化，触发动画
    watch(todayCount, (newValue, oldValue) => {
      if (newValue !== oldValue) {
        animateNumber(newValue);
      }
    });

    const refreshData = async (isManual = false) => {
      try {
        console.log('开始获取数据...');
        
        // 判断是首次加载还是刷新
        if (!hasLoadedOnce.value) {
          isInitialLoading.value = true;
          isLoadingNumber.value = true;
        } else {
          // 已经加载过，这是刷新操作
          isRefreshing.value = true;
          if (isManual) {
            // 手动刷新时也显示数字加载动画
            isLoadingNumber.value = true;
          }
        }
        
        apiStatus.value = '连接中...';
        
        const res = await fetch("https://api.charge.wsss.fun/charges");
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        
        const responseData = await res.json();
        console.log('API响应数据:', responseData);
        
        if (!responseData.success) {
          throw new Error(responseData.error || 'API返回失败状态');
        }
        
        if (!Array.isArray(responseData.data)) {
          console.error('API返回的data不是数组:', responseData.data);
          throw new Error('API返回数据格式错误');
        }
        
        apiStatus.value = '连接成功';
        lastUpdate.value = new Date().toLocaleString('zh-CN');
        totalRecords.value = responseData.data.length;
        
        processData(responseData.data);
        
        // 延迟处理，让动画更自然
        setTimeout(() => {
          if (!hasLoadedOnce.value) {
            // 首次加载完成
            isInitialLoading.value = false;
            hasLoadedOnce.value = true;
          }
          
          isRefreshing.value = false;
          isLoadingNumber.value = false;
        }, hasLoadedOnce.value ? 300 : 800); // 首次加载稍微长一点
        
      } catch (e) {
        console.error("获取数据失败:", e);
        apiStatus.value = `连接失败: ${e.message}`;
        
        // 错误时也要重置状态
        if (!hasLoadedOnce.value) {
          heatmapData.value = [];
          todayCount.value = 0;
          displayCount.value = 0;
          totalRecords.value = 0;
          isInitialLoading.value = false;
          hasLoadedOnce.value = true;
        }
        
        isRefreshing.value = false;
        isLoadingNumber.value = false;
      }
    };

    const processData = (chargesData) => {
      try {
        console.log('开始处理数据:', chargesData);
        
        if (!Array.isArray(chargesData)) {
          console.error('传入的数据不是数组:', chargesData);
          return;
        }
        
        const dailyCounts = {};
        
        chargesData.forEach((item, index) => {
          console.log(`处理第${index + 1}条记录:`, item);
          
          if (!item || !item.timestamp) {
            console.warn(`第${index + 1}条记录缺少timestamp:`, item);
            return;
          }
          
          const date = item.timestamp.slice(0, 10);
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        });
        
        console.log('每日统计结果:', dailyCounts);

        const today = new Date();
        const yearAgo = new Date(today);
        yearAgo.setFullYear(today.getFullYear() - 1);

        const data = [];
        const months = [];
        let lastMonth = null;
        let colIndex = 1;
        
        for (let d = new Date(yearAgo); d <= today; d.setDate(d.getDate() + 1)) {
          const dateStr = getLocalDateStr(d);
          const count = dailyCounts[dateStr] || 0;
          
          data.push({ 
            date: dateStr, 
            count: count, 
            day: d.getDay() 
          });

          const month = d.toLocaleString('default', { month: 'short' });
          if (d.getDate() === 1) {
            months.push({ name: month, position: colIndex });
          }

          if (d.getDay() === 6) colIndex++;
        }

        console.log(`生成热力图数据: ${data.length} 天`);
        console.log('今日日期:', getLocalDateStr(today));
        console.log('今日充电次数:', dailyCounts[getLocalDateStr(today)] || 0);

        heatmapData.value = data;
        monthLabels.value = months;
        todayCount.value = dailyCounts[getLocalDateStr(today)] || 0;
        
      } catch (error) {
        console.error('处理数据时出错:', error);
        heatmapData.value = [];
        todayCount.value = 0;
      }
    };

    const getLevel = (count) => {
      if (count === 0) return 0;
      if (count <= 2) return 1;
      if (count <= 5) return 2;
      if (count <= 10) return 3;
      return 4;
    };

    const addChargeRecord = async () => {
      try {
        const res = await fetch("https://api.charge.wsss.fun/charge", {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const result = await res.json();
        console.log('添加充电记录结果:', result);
        
        if (result.success) {
          setTimeout(() => refreshData(true), 1000); // 手动刷新
        }
      } catch (error) {
        console.error('添加充电记录失败:', error);
      }
    };

    // 手动刷新
    const manualRefresh = () => {
      refreshData(true);
    };

    onMounted(() => {
      console.log('组件挂载完成，开始获取数据');
      refreshData(false); // 首次加载
      
      // 每30秒自动刷新（静默刷新）
      setInterval(() => {
        refreshData(false); // 自动刷新，不是手动刷新
      }, 30000);
    });

    return { 
      todayCount,
      displayCount,
      isInitialLoading,
      isRefreshing,
      isLoadingNumber,
      heatmapData, 
      monthLabels, 
      refreshData: manualRefresh, // 绑定手动刷新函数
      getLevel,
      totalRecords,
      lastUpdate,
      apiStatus,
      debugMode,
      addChargeRecord
    };
  },
};
</script>

<style>
/* 整体 body 深色 */
body {
  margin: 0;
  padding: 0;
  background-color: #0d1117;
  color: #c9d1d9;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* app 容器保持居中 */
.app {
  padding: 20px;
  max-width: 960px;
  margin: 0 auto;
}

h1 {
  text-align: center;
  margin-bottom: 30px;
  color: #c9d1d9;
  font-size: 2.5rem;
}

/* 按钮风格 */
button {
  padding: 8px 16px;
  margin: 0 8px 20px 0;
  cursor: pointer;
  background-color: #161b22;
  border: 1px solid #30363d;
  color: #c9d1d9;
  border-radius: 6px;
  transition: all 0.2s;
  font-size: 14px;
}

button:hover {
  background-color: #21262d;
  border-color: #8b949e;
}

button:active {
  background-color: #262c36;
}

/* 今日充电次数 */
.today {
  font-size: 20px;
  margin-bottom: 30px;
  color: #c9d1d9;
  text-align: center;
  padding: 15px;
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 60px;
}

/* 动画数字样式 */
.animated-number {
  color: #39d353;
  font-size: 24px;
  font-weight: 700;
  display: inline-block;
  min-width: 40px;
  text-align: center;
  transition: all 0.3s ease;
  text-shadow: 0 0 10px rgba(57, 211, 83, 0.3);
}

.animated-number.loading {
  min-width: 60px;
}

/* 加载动画点点点 */
.loading-dots {
  display: inline-block;
  width: 40px;
  text-align: left;
  color: #39d353;
  font-size: 24px;
  font-weight: 700;
}

.loading-dots::after {
  content: '⚡';
  animation: loadingDots 1.5s infinite;
}

@keyframes loadingDots {
  0% {
    content: '⚡';
    opacity: 0.3;
  }
  25% {
    content: '⚡⚡';
    opacity: 0.6;
  }
  50% {
    content: '⚡⚡⚡';
    opacity: 1;
  }
  75% {
    content: '⚡⚡';
    opacity: 0.6;
  }
  100% {
    content: '⚡';
    opacity: 0.3;
  }
}

/* 热力图容器 */
.heatmap-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #1D2530FF;
  border: 1px solid #30363d;
  border-radius: 8px;
  position: relative;
}

.grid-wrapper {
  width: 100%;
  display: flex;
  justify-content: center;
}

/* 刷新指示器 */
.refresh-indicator {
  position: absolute;
  top: 10px;
  right: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #8b949e;
  background-color: rgba(13, 17, 23, 0.8);
  padding: 4px 8px;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.refresh-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 骨架屏热力图 */
.skeleton-heatmap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.skeleton-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 14px;
  grid-template-rows: repeat(7, 14px);
  gap: 4px;
}

.skeleton-cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: #21262d;
  animation: skeletonPulse 1.5s ease-in-out infinite;
}

/* 骨架屏脉动动画 */
@keyframes skeletonPulse {
  0% {
    opacity: 0.3;
    background-color: #21262d;
  }
  50% {
    opacity: 0.6;
    background-color: #30363d;
  }
  100% {
    opacity: 0.3;
    background-color: #21262d;
  }
}

/* 实际热力图 */
.heatmap-grid {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 14px;
  grid-template-rows: repeat(7, 14px);
  gap: 4px;
  animation: fadeIn 0.5s ease-in;
  transition: opacity 0.3s ease;
}

.heatmap-grid.refreshing {
  opacity: 0.7;
}

/* 淡入动画 */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 热力图格子 */
.cell {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background-color: #161b22;
  transition: all 0.2s ease-in-out;
  border: 1px solid #21262d;
}

/* 热力等级颜色 */
.cell.level-0 { 
  background-color: #161b22; 
  border-color: #21262d;
}
.cell.level-1 { 
  background-color: #0e4429; 
  border-color: #006d32;
}
.cell.level-2 { 
  background-color: #006d32; 
  border-color: #26a641;
}
.cell.level-3 { 
  background-color: #26a641; 
  border-color: #39d353;
}
.cell.level-4 { 
  background-color: #39d353; 
  border-color: #56d364;
}

/* 悬停效果优化 */
.cell:hover {
  transform: scale(1.3);
  cursor: pointer;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
  z-index: 10;
  position: relative;
}

/* 调试信息样式 */
.debug-info {
  margin-top: 30px;
  padding: 15px;
  background-color: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
}

.debug-info h3 {
  margin: 0 0 10px 0;
  color: #f0883e;
}

.debug-info p {
  margin: 5px 0;
  color: #8b949e;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .app {
    padding: 10px;
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .today {
    flex-direction: column;
    gap: 15px;
  }
  
  .animated-number {
    font-size: 28px;
  }
  
  .heatmap-grid,
  .skeleton-grid {
    grid-auto-columns: 12px;
    grid-template-rows: repeat(7, 12px);
    gap: 3px;
  }
  
  .cell,
  .skeleton-cell {
    width: 12px;
    height: 12px;
  }
  
  .refresh-indicator {
    position: static;
    margin-top: 10px;
    align-self: center;
  }
}
</style>