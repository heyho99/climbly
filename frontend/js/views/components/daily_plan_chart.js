// Apache ECharts を使った日次計画チャート（作成画面向けMVP）
// API: initDailyPlanChart({ el, items, onChange })
// - el: チャートを描画するDOM要素
// - items: [{ target_date, work_plan_value, time_plan_value }]
// - onChange(updatedItems): 点編集後に呼ばれるコールバック

export function initDailyPlanChart({ el, items, onChange }) {
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
      return data.map(d => Number(d[key] || 0));
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

    function render() {
      const option = {
        tooltip: { trigger: 'axis' },
        legend: { data: ['Work %', 'Time'] },
        grid: { left: 40, right: 40, top: 30, bottom: 60 },
        dataZoom: [
          { type: 'inside', xAxisIndex: 0 },
          { type: 'slider', xAxisIndex: 0 }
        ],
        xAxis: { type: 'category', boundaryGap: false, data: toXAxis() },
        yAxis: [
          { type: 'value', name: 'Work %', min: 0, max: 100, minInterval: 1 },
          { type: 'value', name: 'Time', min: 0, minInterval: 1 }
        ],
        series: [
          { name: 'Work %', type: 'line', yAxisIndex: 0, smooth: false, symbol: 'circle', symbolSize: 8, data: toSeriesData('work_plan_value') },
          { name: 'Time', type: 'line', yAxisIndex: 1, smooth: false, symbol: 'triangle', symbolSize: 8, data: toSeriesData('time_plan_value') }
        ]
      };
      chart.setOption(option);
    }

    // クリックで値編集（対象系列ごとにプロンプト）
    chart.off('click');
    chart.on('click', (params) => {
      if (dragMoved) { dragMoved = false; return; } // 直前にドラッグしていた場合はクリック編集を抑制
      if (!params || typeof params.dataIndex !== 'number') return;
      const idx = params.dataIndex;
      const seriesName = params.seriesName;
      let key = null;
      if (seriesName === 'Work %') key = 'work_plan_value';
      else if (seriesName === 'Time') key = 'time_plan_value';
      if (!key) return;

      const oldVal = Number(data[idx][key] || 0);
      const input = window.prompt(`${seriesName} を入力 (${data[idx].target_date})`, String(oldVal));
      if (input == null) return; // cancel
      const newValRaw = Number(input);
      if (!Number.isFinite(newValRaw) || newValRaw < 0) return;
      const newVal = key === 'work_plan_value' ? clamp(newValRaw, 0, 100) : clamp(newValRaw, 0, undefined);

      data[idx][key] = newVal;
      render();
      try { onChange && onChange(data.map(x => ({ ...x }))); } catch {}
    });

    // --- ドラッグ編集 ---
    const zr = chart.getZr();
    // 系列上での開始（優先）
    chart.off('mousedown');
    chart.on('mousedown', (params) => {
      if (!params || params.componentType !== 'series') return;
      if (typeof params.dataIndex !== 'number') return;
      const idx = params.dataIndex;
      const seriesName = params.seriesName;
      let key = null; let yAxisIndex = 0;
      if (seriesName === 'Work %') { key = 'work_plan_value'; yAxisIndex = 0; }
      else if (seriesName === 'Time') { key = 'time_plan_value'; yAxisIndex = 1; }
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

      // どちらの系列が近いかを判定
      const label = data[nearestIdx].target_date;
      const yWork = Number(data[nearestIdx].work_plan_value || 0);
      const yTime = Number(data[nearestIdx].time_plan_value || 0);
      let pyWork = null, pyTime = null;
      try { pyWork = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [label, yWork]); } catch {}
      try { pyTime = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 1 }, [label, yTime]); } catch {}
      const yPix = pt[1];
      const dWork = pyWork ? Math.abs(pyWork[1] - yPix) : Infinity;
      const dTime = pyTime ? Math.abs(pyTime[1] - yPix) : Infinity;
      let key = null; let yAxisIndex = 0;
      if (dWork <= dTime) { key = 'work_plan_value'; yAxisIndex = 0; }
      else { key = 'time_plan_value'; yAxisIndex = 1; }

      dragging = { index: nearestIdx, key, yAxisIndex };
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
        yVal = dragging.key === 'work_plan_value' ? clamp(yVal, 0, 100) : clamp(yVal, 0, undefined);
        // 反映
        data[dragging.index][dragging.key] = yVal;
        // 対象シリーズのみ更新（軽量）: 両系列のデータを一括更新
        const workData = toSeriesData('work_plan_value');
        const timeData = toSeriesData('time_plan_value');
        chart.setOption({ series: [ { data: workData }, { data: timeData } ] }, false, false);
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