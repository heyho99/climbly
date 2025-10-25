import { api } from '../api.js';

export async function DashboardView() {
  let summary = null; 
  let laggards = [];
  try { summary = await api.dashboardSummary(); } catch {} // bffの/dashboard/summary
  try { laggards = await api.laggingTasks(); } catch {} // bffの/dashboard/lagging_tasks

  return `
  <div class="row">
    <div class="col">
      <div class="card">
        <h3>サマリ</h3>
        ${summary ? `
          <div class="row">
            <div class="col"><div class="kpi">${summary.active_tasks ?? '-'}</div><div class="helper">進行中タスク</div></div>
            <div class="col"><div class="kpi">${summary.completed_tasks_total ?? '-'}</div><div class="helper">累計完了</div></div>
            <div class="col"><div class="kpi">${summary.completed_tasks_month ?? '-'}</div><div class="helper">今月完了</div></div>
            <div class="col"><div class="kpi">${summary.work_time_month ?? '-'}</div><div class="helper">今月作業時間</div></div>
          </div>
        ` : '<div class="helper">サマリ取得に失敗しました</div>'}
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
