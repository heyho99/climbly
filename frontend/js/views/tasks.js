// タスク一覧ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { initDailyPlanChart } from './components/daily_plan_chart.js';

const STATUS_DEFINITIONS = {
  active: { label: 'アクティブ', badgeClass: 'badge-success' },
  completed: { label: '完了', badgeClass: 'badge-info' },
  paused: { label: '一時停止', badgeClass: 'badge-warning' },
  cancelled: { label: 'キャンセル', badgeClass: 'badge-danger' },
};

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 予定と実績データをマージする
 * @param {Array} plans - daily_plans配列
 * @param {Array} actuals - daily_actuals配列
 * @returns {Array} マージされたデータ
 */
function mergePlanAndActual(plans, actuals) {
  const dateMap = new Map();
  
  // 予定データを追加
  (plans || []).forEach(p => {
    dateMap.set(p.target_date, {
      target_date: p.target_date,
      work_plan_value: p.work_plan_value || 0,
      time_plan_value: p.time_plan_value || 0,
      work_actual_value: 0,
      time_actual_value: 0
    });
  });
  
  // 実績データを追加
  (actuals || []).forEach(a => {
    const existing = dateMap.get(a.target_date);
    if (existing) {
      existing.work_actual_value = a.work_actual_value || 0;
      existing.time_actual_value = a.time_actual_value || 0;
    } else {
      dateMap.set(a.target_date, {
        target_date: a.target_date,
        work_plan_value: 0,
        time_plan_value: 0,
        work_actual_value: a.work_actual_value || 0,
        time_actual_value: a.time_actual_value || 0
      });
    }
  });
  
  // 日付順にソート
  return Array.from(dateMap.values()).sort((a, b) => 
    a.target_date.localeCompare(b.target_date)
  );
}

export async function TasksView() {
  let data = { items: [] };
  try { data = await api.listTasks({ page: 1, per_page: 50, include_daily_plans: true, include_actuals: true }); } catch {}
  const items = Array.isArray(data) ? data : (data.items || []);

  // ステータス表示用の関数
  const getStatusBadge = (status) => {
    const def = STATUS_DEFINITIONS[status];
    if (!def) {
      return '<span class="badge badge-secondary">不明</span>';
    }
    return `<span class="badge ${def.badgeClass}">${def.label}</span>`;
  };

  const categoryOptions = Array.from(new Set(items.map(t => t.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ja'));
  const statusOptions = Object.entries(STATUS_DEFINITIONS);

  return `
  <div class="tasks-container">
    <div class="tasks-header">
      <h2>タスク一覧</h2>
      <div class="tasks-header-actions">
        <button type="button" class="btn secondary" id="btn-expand-all">すべて展開</button>
        <button type="button" class="btn secondary" id="btn-collapse-all">すべて折りたたむ</button>
        <button class="btn" id="btn-new-task">新規作成</button>
      </div>
    </div>

    <div class="tasks-filters">
      <div class="tasks-filter-group">
        <label for="filter-category">カテゴリ</label>
        <select id="filter-category">
          <option value="">すべて</option>
          ${categoryOptions.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('')}
        </select>
      </div>
      <div class="tasks-filter-group">
        <label for="filter-status">ステータス</label>
        <select id="filter-status">
          <option value="">すべて</option>
          ${statusOptions.map(([value, def]) => `<option value="${value}">${escapeHtml(def.label)}</option>`).join('')}
        </select>
      </div>
    </div>
    
    ${!items.length ? '<div class="helper">タスクがありません</div>' : ''}
    <div class="helper hidden" id="tasks-filter-empty">該当するタスクがありません</div>
    
    <div class="tasks-list">
      ${items.map(t => {
        const summary = t.summary_today || {};
        const timePlanToday = summary.time_plan_cumulative ?? 0;
        const timeActualToday = summary.time_actual_cumulative ?? 0;
        const workPlanToday = summary.work_plan_cumulative ?? 0;
        const workActualToday = summary.work_actual_cumulative ?? 0;
        const isDelayed = t.status === 'active' && workPlanToday > workActualToday;
        return `
        <div class="task-card${isDelayed ? ' delayed' : ''}" data-task-id="${t.task_id}">
          <div class="task-card-header">
            <div class="task-header-main">
              <h3 class="task-name">${t.task_name}</h3>
              ${isDelayed ? '<span class="badge badge-danger badge-delay">遅延</span>' : ''}
            </div>
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
            <div class="task-info-item">
              <span class="label">予定時間(今日まで):</span>
              <span>${timePlanToday}時間</span>
            </div>
            <div class="task-info-item">
              <span class="label">実績時間(今日まで):</span>
              <span>${timeActualToday}時間</span>
            </div>
            <div class="task-info-item">
              <span class="label">予定進捗(今日まで):</span>
              <span>${workPlanToday}%</span>
            </div>
            <div class="task-info-item">
              <span class="label">実績進捗(今日まで):</span>
              <span>${workActualToday}%</span>
            </div>
          </div>
          
          <div class="task-charts">
            <div class="task-charts-header">
              <button
                type="button"
                class="task-chart-toggle"
                data-task-toggle="${t.task_id}"
                aria-expanded="false"
              >
                グラフを表示
              </button>
            </div>
            <div class="task-charts-body collapsed" data-task-charts="${t.task_id}">
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
        </div>
      `;
      }).join('')}
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

  const categorySelect = document.getElementById('filter-category');
  const statusSelect = document.getElementById('filter-status');
  const filterEmptyMessage = document.getElementById('tasks-filter-empty');

  const expandAllBtn = document.getElementById('btn-expand-all');
  if (expandAllBtn) {
    expandAllBtn.onclick = (e) => {
      e.preventDefault();
      expandAllCharts();
    };
  }

  const collapseAllBtn = document.getElementById('btn-collapse-all');
  if (collapseAllBtn) {
    collapseAllBtn.onclick = (e) => {
      e.preventDefault();
      collapseAllCharts();
    };
  }

  if (categorySelect) {
    categorySelect.addEventListener('change', () => {
      applyFilters().catch(err => console.error('Failed to apply category filter:', err));
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      applyFilters().catch(err => console.error('Failed to apply status filter:', err));
    });
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

  const chartState = new Map();
  let tasksResponse = null;

  async function ensureTaskData() {
    if (tasksResponse) return tasksResponse;
    try {
      const data = await api.listTasks({ page: 1, per_page: 50, include_daily_plans: true, include_actuals: true });
      tasksResponse = Array.isArray(data) ? data : (data.items || []);
    } catch (err) {
      console.error('Failed to load tasks for charts:', err);
      tasksResponse = [];
    }
    return tasksResponse;
  }

  function buildCharts(task) {
    if (!task || !task.task_id) return;

    const dailyPlans = task.daily_plans || [];
    const dailyActuals = task.daily_actuals || [];

    const mergedData = mergePlanAndActual(dailyPlans, dailyActuals);
    if (mergedData.length === 0) {
      return;
    }

    const workChartEl = document.getElementById(`chart-work-${task.task_id}`);
    if (workChartEl) {
      try {
        initDailyPlanChart({
          el: workChartEl,
          items: mergedData,
          series: ['work_plan', 'work_actual'],
          readOnly: true
        });
      } catch (err) {
        console.error(`Failed to init work chart for task ${task.task_id}:`, err);
      }
    }

    const timeChartEl = document.getElementById(`chart-time-${task.task_id}`);
    if (timeChartEl) {
      try {
        initDailyPlanChart({
          el: timeChartEl,
          items: mergedData,
          series: ['time_plan', 'time_actual'],
          readOnly: true
        });
      } catch (err) {
        console.error(`Failed to init time chart for task ${task.task_id}:`, err);
      }
    }

    chartState.set(String(task.task_id), { initialized: true, expanded: true });
  }

  function destroyCharts(taskId) {
    const workChartEl = document.getElementById(`chart-work-${taskId}`);
    if (workChartEl && workChartEl._destroyChart) {
      try { workChartEl._destroyChart(); } catch {}
    }
    const timeChartEl = document.getElementById(`chart-time-${taskId}`);
    if (timeChartEl && timeChartEl._destroyChart) {
      try { timeChartEl._destroyChart(); } catch {}
    }
    chartState.set(taskId, { initialized: false, expanded: false });
  }

  function handleToggle(button) {
    const taskId = button.getAttribute('data-task-toggle');
    if (!taskId) return;

    const body = document.querySelector(`[data-task-charts="${taskId}"]`);
    if (!body) return;

    const currentState = chartState.get(taskId) || { initialized: false, expanded: false };
    const willExpand = !currentState.expanded;

    if (willExpand) {
      body.classList.remove('collapsed');
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'グラフを隠す';

      requestAnimationFrame(async () => {
        const tasks = await ensureTaskData();
        const targetTask = tasks.find(t => String(t.task_id) === String(taskId));
        if (!targetTask) return;

        if (!currentState.initialized) {
          buildCharts(targetTask);
          chartState.set(taskId, { initialized: true, expanded: true });
        } else {
          window.dispatchEvent(new Event('resize'));
          chartState.set(taskId, { ...currentState, expanded: true });
        }
      });
    } else {
      body.classList.add('collapsed');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'グラフを表示';
      destroyCharts(taskId);
    }
  }

  function expandAllCharts() {
    document.querySelectorAll('.task-chart-toggle').forEach(btn => {
      const taskId = btn.getAttribute('data-task-toggle');
      const card = btn.closest('.task-card');
      if (!card || card.classList.contains('hidden')) return;
      if (!taskId) return;
      const state = chartState.get(taskId) || { initialized: false, expanded: false };
      if (!state.expanded) {
        handleToggle(btn);
      }
    });
  }

  function collapseAllCharts() {
    document.querySelectorAll('.task-chart-toggle').forEach(btn => {
      const taskId = btn.getAttribute('data-task-toggle');
      const card = btn.closest('.task-card');
      if (!card || card.classList.contains('hidden')) return;
      if (!taskId) return;
      const state = chartState.get(taskId) || { initialized: false, expanded: false };
      if (state.expanded) {
        handleToggle(btn);
      }
    });
  }

  async function applyFilters() {
    const selectedCategory = categorySelect ? categorySelect.value : '';
    const selectedStatus = statusSelect ? statusSelect.value : '';
    const tasks = await ensureTaskData();
    const taskMap = new Map(tasks.map(t => [String(t.task_id), t]));
    const cards = document.querySelectorAll('.task-card');

    let anyVisible = false;

    cards.forEach(card => {
      const taskId = card.getAttribute('data-task-id');
      const task = taskMap.get(String(taskId));
      let visible = true;

      if (selectedCategory && (!task || (task.category || '') !== selectedCategory)) {
        visible = false;
      }
      if (visible && selectedStatus && (!task || (task.status || '') !== selectedStatus)) {
        visible = false;
      }

      card.classList.toggle('hidden', !visible);

      if (!visible && taskId) {
        const toggleBtn = card.querySelector('.task-chart-toggle');
        const chartsBody = card.querySelector('[data-task-charts]');
        if (chartsBody) {
          chartsBody.classList.add('collapsed');
        }
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.textContent = 'グラフを表示';
        }
        destroyCharts(taskId);
      }

      if (visible) {
        anyVisible = true;
      }
    });

    if (filterEmptyMessage) {
      const hasTasks = cards.length > 0;
      filterEmptyMessage.classList.toggle('hidden', !hasTasks || anyVisible);
    }
  }

  document.querySelectorAll('.task-chart-toggle').forEach(btn => {
    btn.addEventListener('click', () => handleToggle(btn));
    const taskId = btn.getAttribute('data-task-toggle');
    if (taskId && !chartState.has(taskId)) {
      chartState.set(taskId, { initialized: false, expanded: false });
    }
  });

  await applyFilters();

  // 初期表示中のグラフを生成
  const tasks = await ensureTaskData();
  tasks.forEach(task => {
    const body = document.querySelector(`[data-task-charts="${task.task_id}"]`);
    if (body && !body.classList.contains('collapsed')) {
      buildCharts(task);
    }
  });
}
