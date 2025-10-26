// 累積作業時間予定グラフ（ダッシュボード用・読み取り専用）
// API: initDashboardPlanChart({ el, items })
// - el: チャートを描画するDOM要素
// - items: [{ target_date, total_time_plan }]

export function initDashboardPlanChart({ el, items }) {
    if (!el) return;
    
    // 既存のインスタンスがあれば破棄
    if (el._destroyChart) {
      try { el._destroyChart(); } catch {}
      el._destroyChart = null;
    } else if (el._echarts) {
      try { el._echarts.dispose(); } catch {}
      el._echarts = null;
    }
    
    // データがない場合
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="helper">計画データがありません</div>';
      return;
    }
    
    // ECharts 初期化
    const chart = echarts.init(el);
    el._echarts = chart;
    
    // データ変換
    const dates = items.map(d => d.target_date);
    const values = items.map(d => Number(d.total_time_plan || 0));
    
    // グラフオプション
    const option = {
        tooltip: { 
            trigger: 'axis',
            formatter: '{b}<br/>計画時間: {c}分'
        },
        grid: { 
            left: 60, 
            right: 30, 
            top: 30, 
            bottom: 60 
        },
        dataZoom: [
            { type: 'inside', xAxisIndex: 0 },
            { type: 'slider', xAxisIndex: 0, height: 20 }
        ],
        xAxis: { 
            type: 'category', 
            boundaryGap: false, 
            data: dates 
        },
        yAxis: { 
            type: 'value', 
            name: '計画時間(分)', 
            min: 0,
            minInterval: 1
        },
        series: [{
            name: '計画時間',
            type: 'line',
            smooth: false,
            symbol: 'circle',
            symbolSize: 6,
            data: values,
            areaStyle: { 
                color: {
                    type: 'linear',
                    x: 0, y: 0, x2: 0, y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(58, 77, 233, 0.3)' },
                        { offset: 1, color: 'rgba(58, 77, 233, 0.05)' }
                    ]
                }
            },
            lineStyle: {
                color: 'rgba(58, 77, 233, 1)',
                width: 2
            },
            itemStyle: {
                color: 'rgba(58, 77, 233, 1)'
            }
        }]
    };
    
    chart.setOption(option);
    
    // リサイズ対応
    function handleResize() { 
        try { chart.resize(); } catch {} 
    }
    window.addEventListener('resize', handleResize);
    
    // 破棄処理
    el._destroyChart = () => {
        window.removeEventListener('resize', handleResize);
        try { chart.dispose(); } catch {}
        el._echarts = null;
    };
}
