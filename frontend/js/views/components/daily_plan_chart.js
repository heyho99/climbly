// Apache ECharts を使った日次計画チャート（作成画面向けMVP）
// API: initDailyPlanChart({ el, items, onChange, series, readOnly })
// - el: チャートを描画するDOM要素
// - items: [{ target_date, work_plan_value, work_actual_value, time_plan_value, time_actual_value }]
// - onChange(updatedItems): 点編集後に呼ばれるコールバック
// - series: 表示する系列の配列 ['work_plan', 'work_actual', 'time_plan', 'time_actual']（デフォルト: ['work_plan', 'time_plan']）
// - readOnly: true の場合、編集機能を無効化（デフォルト: false）

export function initDailyPlanChart({ el, items, onChange, series = ['work_plan', 'time_plan'], readOnly = false }) {
    if (!el) return;
    // 既存のインスタンスがあれば安全に破棄（イベント/リスナーも含めて）
    if (el._destroyChart) {
      try { el._destroyChart(); } catch {}
      el._destroyChart = null;
    } else if (el._echarts) {
      try { el._echarts.dispose(); } catch {}
      el._echarts = null;
    }
    // ディープコピーしてローカルで編集
    let data = (items || []).map(x => ({ ...x }));

    // ECharts 初期化
    const chart = echarts.init(el);
    el._echarts = chart;

    // ドラッグ編集の状態
    let dragging = null; // { index, key, yAxisIndex }
    let dragMoved = false;
    let lastRender = 0;

    function toSeriesData(key) {
      return data.map(d => {
        const value = d[key];
        if (value == null) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      });
    }
    function toXAxis() {
      return data.map(d => d.target_date);
    }

    function clamp(val, min, max) {
      if (!Number.isFinite(val)) return min;
      if (min != null && val < min) return min;
      if (max != null && val > max) return max;
      return val;
    }

    // 系列設定
    const seriesConfig = {
      work_plan: { 
        name: 'Work Plan %', 
        yAxisIndex: 0, 
        dataKey: 'work_plan_value',
        color: '#4CAF50',
        lineStyle: { type: 'solid' },
        symbol: 'circle'
      },
      work_actual: { 
        name: 'Work Actual %', 
        yAxisIndex: 0, 
        dataKey: 'work_actual_value',
        color: '#2196F3',
        lineStyle: { type: 'dashed' },
        symbol: 'circle'
      },
      time_plan: { 
        name: 'Time Plan', 
        yAxisIndex: 1, 
        dataKey: 'time_plan_value',
        color: '#FF9800',
        lineStyle: { type: 'solid' },
        symbol: 'triangle'
      },
      time_actual: { 
        name: 'Time Actual', 
        yAxisIndex: 1, 
        dataKey: 'time_actual_value',
        color: '#F44336',
        lineStyle: { type: 'dashed' },
        symbol: 'triangle'
      }
    };

    function render() {
      // 使用されているyAxisを判定
      const useWorkAxis = series.some(s => s.startsWith('work_'));
      const useTimeAxis = series.some(s => s.startsWith('time_'));

      // yAxis設定（使用されている軸のみ）
      const yAxisConfig = [];
      let workAxisIndex = -1;
      let timeAxisIndex = -1;
      
      if (useWorkAxis) {
        workAxisIndex = yAxisConfig.length;
        yAxisConfig.push({ type: 'value', name: 'Work %', min: 0, max: 100, minInterval: 1 });
      }
      if (useTimeAxis) {
        timeAxisIndex = yAxisConfig.length;
        yAxisConfig.push({ type: 'value', name: 'Time', min: 0, minInterval: 1 });
      }
      // yAxisが1つもない場合はダミーを追加
      if (yAxisConfig.length === 0) {
        yAxisConfig.push({ type: 'value' });
      }

      // 指定された系列のみを構築（yAxisIndexを動的に設定）
      const activeSeries = series.map(key => {
        const config = seriesConfig[key];
        if (!config) return null;
        
        // 実際のyAxisIndexを決定
        let actualYAxisIndex = 0;
        if (key.startsWith('work_')) {
          actualYAxisIndex = workAxisIndex >= 0 ? workAxisIndex : 0;
        } else if (key.startsWith('time_')) {
          actualYAxisIndex = timeAxisIndex >= 0 ? timeAxisIndex : 0;
        }
        
        return {
          name: config.name,
          type: 'line',
          yAxisIndex: actualYAxisIndex,
          smooth: false,
          symbol: config.symbol,
          symbolSize: 8,
          data: toSeriesData(config.dataKey),
          itemStyle: { color: config.color },
          lineStyle: config.lineStyle,
          connectNulls: false
        };
      }).filter(s => s !== null);

      // legend用の名前リスト
      const legendData = activeSeries.map(s => s.name);

      const option = {
        tooltip: { trigger: 'axis' },
        legend: { data: legendData },
        grid: { left: 40, right: 40, top: 30, bottom: 60 },
        dataZoom: [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0 }
        ],
        xAxis: { 
          type: 'category', 
          boundaryGap: false, 
          data: toXAxis(),
          splitLine: { show: false }
        },
        yAxis: yAxisConfig.map(axis => ({
          ...axis,
          splitLine: { show: false }
        })),
        series: activeSeries
      };
      chart.setOption(option);
    }

    // クリックで値編集（対象系列ごとにプロンプト）- readOnlyの場合は無効化
    if (!readOnly) {
      chart.off('click');
      chart.on('click', (params) => {
        if (dragMoved) { dragMoved = false; return; } // 直前にドラッグしていた場合はクリック編集を抑制
        if (!params || typeof params.dataIndex !== 'number') return;
        const idx = params.dataIndex;
        const seriesName = params.seriesName;
        
        // 系列名からデータキーを逆引き
        let key = null;
        for (const [seriesKey, config] of Object.entries(seriesConfig)) {
          if (config.name === seriesName) {
            key = config.dataKey;
            break;
          }
        }
        if (!key) return;

        const oldVal = Number(data[idx][key] || 0);
        const input = window.prompt(`${seriesName} を入力 (${data[idx].target_date})`, String(oldVal));
        if (input == null) return; // cancel
        const newValRaw = Number(input);
        if (!Number.isFinite(newValRaw) || newValRaw < 0) return;
        const newVal = key.startsWith('work_') ? clamp(newValRaw, 0, 100) : clamp(newValRaw, 0, undefined);

        data[idx][key] = newVal;
        render();
        try { onChange && onChange(data.map(x => ({ ...x }))); } catch {}
      });
    }

    // --- ドラッグ編集 --- readOnlyの場合は無効化
    if (!readOnly) {
      const zr = chart.getZr();
      // 系列上での開始（優先）
      chart.off('mousedown');
      chart.on('mousedown', (params) => {
        if (!params || params.componentType !== 'series') return;
        if (typeof params.dataIndex !== 'number') return;
        const idx = params.dataIndex;
        const seriesName = params.seriesName;
        
        // 系列名からデータキーを逆引き
        let key = null; let yAxisIndex = 0;
        for (const [seriesKey, config] of Object.entries(seriesConfig)) {
          if (config.name === seriesName) {
            key = config.dataKey;
            yAxisIndex = config.yAxisIndex;
            break;
          }
        }
        if (!key) return;
        dragging = { index: idx, key, yAxisIndex };
        dragMoved = false;
      });
      
      function onDown(e) {
        const pt = [e.offsetX, e.offsetY];
        // グリッド外やデータズームUI上では開始しない
        try {
          if (!chart.containPixel({ gridIndex: 0 }, pt)) return;
        } catch { /* ignore */ }

        // 全x座標を計算して最も近いインデックスを取得
        let nearestIdx = -1; let minDx = Infinity;
        for (let i = 0; i < data.length; i++) {
          try {
            const label = data[i].target_date;
            const xp = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [label, 0]);
            const dx = Math.abs((Array.isArray(xp) ? xp[0] : xp) - pt[0]);
            if (dx < minDx) { minDx = dx; nearestIdx = i; }
          } catch {}
        }
        if (nearestIdx < 0) return;

        // どちらの系列が近いかを判定（アクティブな系列のみ）
        const label = data[nearestIdx].target_date;
        let closestKey = null;
        let closestYAxisIndex = 0;
        let minDist = Infinity;
        
        for (const seriesKey of series) {
          const config = seriesConfig[seriesKey];
          if (!config) continue;
          const yVal = Number(data[nearestIdx][config.dataKey] || 0);
          try {
            const py = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: config.yAxisIndex }, [label, yVal]);
            const dist = py ? Math.abs(py[1] - pt[1]) : Infinity;
            if (dist < minDist) {
              minDist = dist;
              closestKey = config.dataKey;
              closestYAxisIndex = config.yAxisIndex;
            }
          } catch {}
        }
        
        if (!closestKey) return;
        dragging = { index: nearestIdx, key: closestKey, yAxisIndex: closestYAxisIndex };
        dragMoved = false;
      }
      
      function onMove(e) {
        if (!dragging) return;
        dragMoved = true;
        const now = Date.now();
        if (now - lastRender < 30) return; // 簡易スロットル ~33fps
        lastRender = now;
        try {
          const pt = [e.offsetX, e.offsetY];
          // y値に変換（対象yAxis）
          const coord = chart.convertFromPixel({ yAxisIndex: dragging.yAxisIndex, xAxisIndex: 0 }, pt);
          let yVal = Array.isArray(coord) ? coord[1] : coord;
          if (!Number.isFinite(yVal)) return;
          // 常に整数スナップ（ドラッグ中は整数のみ）
          yVal = Math.round(yVal);
          // クリップ
          yVal = dragging.key.startsWith('work_') ? clamp(yVal, 0, 100) : clamp(yVal, 0, undefined);
          // 反映
          data[dragging.index][dragging.key] = yVal;
          // 全系列のデータを更新
          const updatedSeries = series.map(key => {
            const config = seriesConfig[key];
            return { data: toSeriesData(config.dataKey) };
          });
          chart.setOption({ series: updatedSeries }, false, false);
        } catch {}
      }
      
      function onUp() {
        if (!dragging) return;
        const changed = dragMoved;
        dragging = null;
        if (changed) {
          try { onChange && onChange(data.map(x => ({ ...x }))); } catch {}
        }
        // 次のclickでのprompt発火は dragMoved フラグで抑制される
      }
      
      zr.off('mousedown', onDown); zr.on('mousedown', onDown);
      zr.off('mousemove', onMove); zr.on('mousemove', onMove);
      zr.off('mouseup', onUp); zr.on('mouseup', onUp);
      zr.off('globalout', onUp); zr.on('globalout', onUp);
    }

    // 初回描画
    render();

    // リサイズ対応
    function handleResize() { try { chart.resize(); } catch {} }
    window.addEventListener('resize', handleResize);

    // 破棄時
    el._destroyChart = () => {
      window.removeEventListener('resize', handleResize);
      try {
        chart.off('click');
        chart.off('mousedown');
        zr.off('mousedown', onDown);
        zr.off('mousemove', onMove);
        zr.off('mouseup', onUp);
        zr.off('globalout', onUp);
      } catch {}
      try { chart.dispose(); } catch {}
      el._echarts = null;
    };

    // 外部からデータ更新
    el.updateChartData = (nextItems) => {
      data = (nextItems || []).map(x => ({ ...x }));
      render();
    };
}