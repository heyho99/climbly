// タスク一覧ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';

export async function TasksView() {
  let data = { items: [] };
  try { data = await api.listTasks({ page: 1, per_page: 50 }); } catch {}
  const items = Array.isArray(data) ? data : (data.items || []);

  return `
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h2>タスク一覧</h2>
      <button class="btn" id="btn-new-task">新規作成</button>
    </div>
    <table class="table">
      <thead><tr><th>名称</th><th>期間</th><th>カテゴリ</th><th>目標時間</th><th></th></tr></thead>
      <tbody>
        ${items.map(t => `
          <tr>
            <td>${t.task_name}</td>
            <td>${t.start_at ? new Date(t.start_at).toLocaleDateString() : ''} - ${t.end_at ? new Date(t.end_at).toLocaleDateString() : ''}</td>
            <td>${t.category || ''}</td>
            <td>${t.target_time ?? ''}</td>
            <td><button class="btn secondary" data-edit="${t.task_id}">編集</button>
                <button class="btn danger" data-del="${t.task_id}">削除</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${!items.length ? '<div class="helper">タスクがありません</div>' : ''}
  </div>`;
}

document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'btn-new-task') {
    e.preventDefault();
    navigateTo('/tasks/new');
  }
  const editId = e.target && e.target.getAttribute && e.target.getAttribute('data-edit');
  if (editId) { navigateTo(`/tasks/${editId}`); }

  const delId = e.target && e.target.getAttribute && e.target.getAttribute('data-del');
  if (delId) {
    if (!confirm('削除しますか？')) return;
    try { await api.deleteTask(delId); location.reload(); } catch (err) { alert(err.message); }
  }
});
