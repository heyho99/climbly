// タスク状態の円グラフ（ダッシュボード用）
// API: initTaskStatusPieChart({ el, activeCount, laggingCount })
// - el: チャートを描画するDOM要素
// - activeCount: 進行中タスク数
// - laggingCount: 遅延タスク数

export function initTaskStatusPieChart({ el, activeCount = 0, laggingCount = 0 }) {
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
    if (activeCount === 0) {
      el.innerHTML = '<div style="padding:20px; text-align:center; color:#999;">進行中タスクがありません</div>';
      return;
    }
    
    const onTrackCount = Math.max(0, activeCount - laggingCount);
    
    const chart = echarts.init(el);
    
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: '{b}: {c}件 ({d}%)'
        },
        legend: {
            orient: 'horizontal',
            bottom: 0,
            left: 'center'
        },
        series: [
            {
                name: 'タスク状態',
                type: 'pie',
                radius: ['40%', '70%'],  // ドーナツグラフ
                center: ['50%', '45%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: true,
                    position: 'center',
                    formatter: function() {
                        return `進行中\n${activeCount}件`;
                    },
                    fontSize: 16,
                    fontWeight: 'bold'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 18,
                        fontWeight: 'bold'
                    }
                },
                labelLine: {
                    show: false
                },
                data: [
                    { 
                        value: laggingCount, 
                        name: '遅延', 
                        itemStyle: { color: '#ff4d4f' }
                    },
                    { 
                        value: onTrackCount, 
                        name: '順調', 
                        itemStyle: { color: '#52c41a' }
                    }
                ]
            }
        ]
    };
    
    chart.setOption(option);
    
    // クリーンアップ関数を保存
    el._destroyChart = () => {
        try {
            chart.dispose();
        } catch (e) {
            console.error('Chart dispose error:', e);
        }
    };
    el._echarts = chart;
    
    // ウィンドウリサイズ対応
    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    
    // クリーンアップ時にリスナーも削除
    const originalDestroy = el._destroyChart;
    el._destroyChart = () => {
        window.removeEventListener('resize', resizeHandler);
        originalDestroy();
    };
}
