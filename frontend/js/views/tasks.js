// タスク一覧ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { initDailyPlanChart } from './components/daily_plan_chart.js';

export async function TasksView() {
  let data = { items: [] };
  try { data = await api.listTasks({ page: 1, per_page: 50, include_daily_plans: true }); } catch {}
  const items = Array.isArray(data) ? data : (data.items || []);

  // ステータス表示用の関数
  const getStatusBadge = (status) => {
    const statusMap = {
      'active': '<span class="badge badge-success">アクティブ</span>',
      'completed': '<span class="badge badge-info">完了</span>',
      'paused': '<span class="badge badge-warning">一時停止</span>',
      'cancelled': '<span class="badge badge-danger">キャンセル</span>'
    };
    return statusMap[status] || '<span class="badge badge-secondary">不明</span>';
  };

  return `
  <div class="tasks-container">
    <div class="tasks-header">
      <h2>タスク一覧</h2>
      <button class="btn" id="btn-new-task">新規作成</button>
    </div>
    
    ${!items.length ? '<div class="helper">タスクがありません</div>' : ''}
    
    <div class="tasks-list">
      ${items.map(t => `
        <div class="task-card" data-task-id="${t.task_id}">
          <div class="task-card-header">
            <h3 class="task-name">${t.task_name}</h3>
            <div class="task-actions">
              <button class="btn secondary" data-edit-task="${t.task_id}">編集</button>
              <button class="btn danger" data-del-task="${t.task_id}">削除</button>
            </div>
          </div>
          
          <div class="task-info">
            <div class="task-info-item">
              <span class="label">期間:</span>
              <span>${t.start_at ? new Date(t.start_at).toLocaleDateString() : ''} - ${t.end_at ? new Date(t.end_at).toLocaleDateString() : ''}</span>
            </div>
            <div class="task-info-item">
              <span class="label">カテゴリ:</span>
              <span>${t.category || ''}</span>
            </div>
            <div class="task-info-item">
              <span class="label">ステータス:</span>
              ${getStatusBadge(t.status)}
            </div>
            <div class="task-info-item">
              <span class="label">目標時間:</span>
              <span>${t.target_time ?? ''}時間</span>
            </div>
          </div>
          
          <div class="task-charts">
            <div class="chart-section">
              <h4>作業進捗予定 (Work %)</h4>
              <div class="chart-container" id="chart-work-${t.task_id}" style="height: 150px;"></div>
            </div>
            <div class="chart-section">
              <h4>時間予定 (Time)</h4>
              <div class="chart-container" id="chart-time-${t.task_id}" style="height: 150px;"></div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

// タスクページのイベントハンドラーを設定する関数
export async function setupTasksEvents() {
  // 新規作成ボタン
  const newTaskBtn = document.getElementById('btn-new-task');
  if (newTaskBtn) {
    newTaskBtn.onclick = (e) => {
      e.preventDefault();
      navigateTo('/tasks/new');
    };
  }

  // 編集ボタン
  document.querySelectorAll('[data-edit-task]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const editId = e.target.getAttribute('data-edit-task');
      if (editId) {
        navigateTo(`/tasks/${editId}`);
      }
    };
  });

  // 削除ボタン
  document.querySelectorAll('[data-del-task]').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delId = e.target.getAttribute('data-del-task');
      if (delId) {
        if (!confirm('削除しますか？')) return;
        try { 
          await api.deleteTask(delId); 
          location.reload(); 
        } catch (err) { 
          alert(err.message); 
        }
      }
    };
  });

  // グラフの初期化
  // 各タスクカードからdaily_plansを取得してグラフを描画
  let data = { items: [] };
  try { 
    data = await api.listTasks({ page: 1, per_page: 50, include_daily_plans: true }); 
  } catch (err) {
    console.error('Failed to load tasks for charts:', err);
    return;
  }
  const items = Array.isArray(data) ? data : (data.items || []);

  items.forEach(task => {
    if (!task || !task.task_id) {
      console.warn('Invalid task object:', task);
      return;
    }
    
    const dailyPlans = task.daily_plans || [];
    
    // 作業進捗予定グラフ
    const workChartEl = document.getElementById(`chart-work-${task.task_id}`);
    if (workChartEl && dailyPlans.length > 0) {
      try {
        initDailyPlanChart({
          el: workChartEl,
          items: dailyPlans,
          series: ['work_plan'],
          readOnly: true
        });
      } catch (err) {
        console.error(`Failed to init work chart for task ${task.task_id}:`, err);
      }
    }
    
    // 時間予定グラフ
    const timeChartEl = document.getElementById(`chart-time-${task.task_id}`);
    if (timeChartEl && dailyPlans.length > 0) {
      try {
        initDailyPlanChart({
          el: timeChartEl,
          items: dailyPlans,
          series: ['time_plan'],
          readOnly: true
        });
      } catch (err) {
        console.error(`Failed to init time chart for task ${task.task_id}:`, err);
      }
    }
  });
}
