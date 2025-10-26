import { api } from '../api.js';
import { initDashboardPlanChart } from './components/dashboard_plan_chart.js';

export async function DashboardView() {
  let summary = null; 
  let laggards = [];
  let planData = [];
  
  try { summary = await api.dashboardSummary(); } catch {} // bffの/dashboard/summary
  try { laggards = await api.laggingTasks(); } catch {} // bffの/dashboard/lagging_tasks
  try { planData = await api.dashboardDailyPlanAggregate(); } catch {} // bffの/dashboard/daily_plan_aggregate

  // グラフ初期化（DOM生成後）
  setTimeout(() => {
    const chartEl = document.getElementById('dashboard-plan-chart');
    if (chartEl) {
      initDashboardPlanChart({ el: chartEl, items: planData });
    }
  }, 100);

  return `
  <div class="row">
    <div class="col">
      <div class="card">
        <h3>サマリ</h3>
        ${summary ? `
          <div class="row">
            <div class="col"><div class="kpi">${summary.active_tasks ?? '-'}</div><div class="helper">進行中タスク</div></div>
            <div class="col"><div class="kpi">${summary.completed_tasks_total ?? '-'}</div><div class="helper">累計完了</div></div>
            <div class="col"><div class="kpi">${summary.completed_tasks_this_month ?? '-'}</div><div class="helper">今月完了</div></div>
            <div class="col"><div class="kpi">${summary.work_time_this_month ?? '-'}</div><div class="helper">今月作業時間(分)</div></div>
            <div class="col"><div class="kpi">${summary.work_time_total ?? '-'}</div><div class="helper">累計作業時間(分)</div></div>
          </div>
        ` : '<div class="helper">サマリ取得に失敗しました</div>'}
      </div>
      
      <div class="card">
        <h3>累積作業時間予定</h3>
        <div id="dashboard-plan-chart" style="width:100%; height:300px;"></div>
      </div>
      
      <div class="card">
        <h3>遅延タスク</h3>
        ${laggards && laggards.length ? `
          <table class="table">
            <thead><tr><th>タスク</th><th>差分(進捗/時間)</th></tr></thead>
            <tbody>
              ${laggards.map(t => `<tr><td>${t.task_name}</td><td>${t.progress_gap ?? '-'} / ${t.time_gap ?? '-'}</td></tr>`).join('')}
            </tbody>
          </table>
        ` : '<div class="helper">該当なし</div>'}
      </div>
    </div>
  </div>`;
}
