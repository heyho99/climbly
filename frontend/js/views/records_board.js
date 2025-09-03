import { api } from '../api.js';

// カンバン風: タスクごとにカラムを並べ、各タスクのrecord_worksをカード表示
export async function RecordsBoardView(params = {}) {
  const { from, to, taskId } = params;

  let data = { tasks: [] };
  try {
    data = await api.listRecordsByTask({ from_: from, to, task_id: taskId });
  } catch (e) {
    console.error('Failed to load records by task', e);
  }
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];

  const columnHtml = tasks.map(t => `
    <div class="kanban-column">
      <div class="kanban-column__header">
        <div class="kanban-column__title">${t.task_title || `Task #${t.task_id}`}</div>
        <div class="kanban-column__meta">${(t.records || []).length} 件</div>
      </div>
      <div class="kanban-column__body">
        ${(t.records || []).map(r => `
          <div class="kanban-card">
            <div class="kanban-card__row"><span class="badge">${new Date(r.start_at).toLocaleDateString()}</span></div>
            <div class="kanban-card__row small">${new Date(r.start_at).toLocaleTimeString()} - ${new Date(r.end_at).toLocaleTimeString()}</div>
            <div class="kanban-card__row">進捗: ${r.progress_value ?? ''} / 時間: ${r.work_time ?? ''} 分</div>
            ${r.note ? `<div class="kanban-card__note">${r.note}</div>` : ''}
            <div class="kanban-card__actions">
              <button class="btn btn-xs" data-edit="${r.record_work_id}">編集</button>
              <button class="btn btn-xs btn-danger" data-del="${r.record_work_id}">削除</button>
            </div>
          </div>
        `).join('')}
        ${!(t.records || []).length ? '<div class="helper">記録がありません</div>' : ''}
      </div>
      <div class="kanban-column__footer">
        <button class="btn btn-sm" data-add-record="${t.task_id}">+ 実績追加</button>
      </div>
    </div>
  `).join('');

  // 簡易スタイル（既存のmain.cssに依存しつつ最小限のクラスで構成）
  const style = `
    <style>
      .kanban { display: flex; gap: 12px; overflow-x: auto; padding: 8px; }
      .kanban-column { min-width: 280px; background: #f8fafc; color:#111827; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; flex-direction: column; }
      .kanban-column__header { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; display:flex; justify-content: space-between; align-items: center; }
      .kanban-column__title { font-weight: 600; color:#111827; }
      .kanban-column__meta { color:#6b7280; font-size: 12px; }
      .kanban-column__body { padding: 8px; display:flex; flex-direction: column; gap: 8px; }
      .kanban-card { background: #ffffff; color:#111827; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; }
      .kanban-card__row.small { color:#4b5563; font-size: 12px; }
      .kanban-card__note { margin-top: 4px; color:#1f2937; font-size: 13px; white-space: pre-wrap; }
      .kanban-card__actions { display:flex; gap:6px; margin-top: 6px; }
      .kanban-column__footer { padding: 8px; border-top: 1px solid #f0f0f0; }
      .badge { display:inline-block; background:#eef2ff; color:#3730a3; border-radius: 9999px; padding:2px 8px; font-size:12px; }
    </style>
  `;

  return `
  ${style}
  <div class="card">
    <div style="display:flex; justify-content: space-between; align-items:center;">
      <h2>実績記録（タスク別）</h2>
      <div class="muted">${tasks.length} タスク</div>
    </div>
    <div class="kanban">
      ${columnHtml || '<div class="helper">表示するタスクがありません</div>'}
    </div>
  </div>`;
}
