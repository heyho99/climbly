import { api } from '../api.js';
import { showRecordFormModal, showDeleteConfirmModal } from './records.js';

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
              <button class="btn btn-xs" data-edit-record="${r.record_work_id}">編集</button>
              <button class="btn btn-xs btn-danger" data-del-record="${r.record_work_id}">削除</button>
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
    <div id="modal-root"></div>
  </div>`;
}

// イベントハンドラを設定する関数
export function setupRecordsBoardEvents() {
  // 実績追加ボタン
  document.querySelectorAll('[data-add-record]').forEach(btn => {
    btn.onclick = (e) => {
      const taskId = e.target.dataset.addRecord;
      showRecordFormModal({ 
        mode: 'add', 
        taskId,
        onSubmit: (data) => addRecord(taskId, data) 
      });
    };
  });

  // 編集ボタン
  document.querySelectorAll('[data-edit-record]').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const recordId = e.target.dataset.editRecord;
      // 既存レコードの情報を取得してモーダルを表示
      const existingRecord = findRecordById(recordId);
      showRecordFormModal({ 
        mode: 'edit', 
        recordId,
        record: existingRecord,
        onSubmit: (data) => editRecord(recordId, data) 
      });
    };
  });

  // 削除ボタン
  document.querySelectorAll('[data-del-record]').forEach(btn => {
    btn.onclick = (e) => {
      const recordId = e.target.dataset.delRecord;
      showDeleteConfirmModal({ 
        onConfirm: () => deleteRecord(recordId) 
      });
    };
  });
}

// 実績追加処理
async function addRecord(taskId, data) {
  try {
    console.log('Adding record:', { taskId, ...data });
    await api.createRecord({ task_id: taskId, ...data });
    alert('実績が追加されました');
    // ページを再読み込みして最新データを表示
    location.reload();
  } catch (e) {
    console.error('Failed to add record', e);
    alert('実績の追加に失敗しました: ' + e.message);
  }
}

// 実績編集処理
async function editRecord(recordId, data) {
  try {
    console.log('Editing record:', { recordId, ...data });
    await api.updateRecord(recordId, data);
    alert('実績が更新されました');
    // ページを再読み込みして最新データを表示
    location.reload();
  } catch (e) {
    console.error('Failed to edit record', e);
    alert('実績の更新に失敗しました: ' + e.message);
  }
}

// 実績削除処理
async function deleteRecord(recordId) {
  try {
    await api.deleteRecord(recordId);
    alert('実績が削除されました');
    // ページを再読み込みして最新データを表示
    location.reload();
  } catch (e) {
    console.error('Failed to delete record', e);
    alert('実績の削除に失敗しました: ' + e.message);
  }
}

// レコードIDから既存レコードを検索する関数
function findRecordById(recordId) {
  const allRecords = [];
  const tasks = document.querySelectorAll('.kanban-column');
  tasks.forEach(taskColumn => {
    const records = taskColumn.querySelectorAll('.kanban-card');
    records.forEach(recordCard => {
      const editBtn = recordCard.querySelector('[data-edit-record]');
      if (editBtn && editBtn.dataset.editRecord === recordId) {
        // カードの内容を解析して既存データを抽出
        const rows = recordCard.querySelectorAll('.kanban-card__row');
        const dateText = rows[0]?.querySelector('.badge')?.textContent || '';
        const timeText = rows[1]?.textContent || '';
        const progressTimeText = rows[2]?.textContent || '';
        const noteElement = recordCard.querySelector('.kanban-card__note');
        
        // テキストから値を抽出（簡易版）
        const progressMatch = progressTimeText.match(/進捗: ([^/]*)/);
        const timeMatch = progressTimeText.match(/時間: ([^分]*)/);
        
        return {
          start_at: '', // 実際のAPIでは正確な日時データが必要
          end_at: '',
          progress_value: progressMatch ? progressMatch[1].trim() : '',
          work_time: timeMatch ? timeMatch[1].trim() : '',
          note: noteElement ? noteElement.textContent : ''
        };
      }
    });
  });
  
  // 実際のAPIでは recordId でレコードを取得
  return {
    start_at: '',
    end_at: '',
    progress_value: '',
    work_time: '',
    note: ''
  };
}
