// 日次作業時間グラフ（ダッシュボード用・計画と実績を表示）
// API: initDashboardPlanChart({ el, planItems, recordItems })
// - el: チャートを描画するDOM要素
// - planItems: [{ target_date, total_time_plan }]
// - recordItems: [{ target_date, total_work_time }]

export function initDashboardPlanChart({ el, planItems = [], recordItems = [] }) {
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
    if ((!planItems || planItems.length === 0) && (!recordItems || recordItems.length === 0)) {
      el.innerHTML = '<div class="helper">データがありません</div>';
      return;
    }
    
    // ECharts 初期化
    const chart = echarts.init(el);
    el._echarts = chart;
    
    // 全ての日付を取得してソート
    const allDates = new Set();
    planItems.forEach(d => allDates.add(d.target_date));
    recordItems.forEach(d => allDates.add(d.target_date));
    const dates = Array.from(allDates).sort();
    
    // 計画データをマップに変換
    const planMap = {};
    planItems.forEach(d => {
        planMap[d.target_date] = Number(d.total_time_plan || 0);
    });
    
    // 実績データをマップに変換
    const recordMap = {};
    recordItems.forEach(d => {
        recordMap[d.target_date] = Number(d.total_work_time || 0);
    });
    
    // 各日付の値を取得（累積計算なし）
    const planValues = dates.map(date => planMap[date] || 0);
    const recordValues = dates.map(date => recordMap[date] || 0);
    
    // グラフオプション
    const option = {
        tooltip: { 
            trigger: 'axis',
            formatter: function(params) {
                let result = params[0].name + '<br/>';
                params.forEach(param => {
                    result += param.marker + param.seriesName + ': ' + param.value + '分<br/>';
                });
                return result;
            }
        },
        legend: {
            data: ['計画時間', '実績時間'],
            top: 5
        },
        grid: { 
            left: 60, 
            right: 30, 
            top: 50, 
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
            name: '作業時間(分)', 
            min: 0,
            minInterval: 1
        },
        series: [
            {
                name: '計画時間',
                type: 'line',
                smooth: false,
                symbol: 'circle',
                symbolSize: 6,
                data: planValues,
                areaStyle: { 
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(79, 70, 229, 0.2)' },
                            { offset: 1, color: 'rgba(79, 70, 229, 0.05)' }
                        ]
                    }
                },
                lineStyle: {
                    color: 'rgba(79, 70, 229, 1)',
                    width: 2
                },
                itemStyle: {
                    color: 'rgba(79, 70, 229, 1)'
                }
            },
            {
                name: '実績時間',
                type: 'line',
                smooth: false,
                symbol: 'circle',
                symbolSize: 6,
                data: recordValues,
                areaStyle: { 
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: 'rgba(16, 185, 129, 0.2)' },
                            { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
                        ]
                    }
                },
                lineStyle: {
                    color: 'rgba(16, 185, 129, 1)',
                    width: 2
                },
                itemStyle: {
                    color: 'rgba(16, 185, 129, 1)'
                }
            }
        ]
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
