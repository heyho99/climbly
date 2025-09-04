import { api } from '../api.js';

// UTC日時をローカルタイムゾーンでdatetime-local形式に変換
function formatDateForInput(utcDateString) {
  const date = new Date(utcDateString);
  // ローカルタイムゾーンでの年月日時分を取得
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export async function RecordsView() {
  let data = { items: [] };
  try { data = await api.listRecords({ page:1, per_page:50 }); } catch {}
  const items = Array.isArray(data) ? data : (data.items || []);

  return `
  <div class="card">
    <h2>実績記録</h2>
    <table class="table">
      <thead><tr><th>タスク</th><th>開始</th><th>終了</th><th>進捗</th><th>作業時間(分)</th><th>操作</th></tr></thead>
      <tbody>
        ${items.map(r => `
          <tr>
            <td>${r.task_title || r.task_name || r.task_id}</td>
            <td>${r.start_at ? new Date(r.start_at).toLocaleString() : ''}</td>
            <td>${r.end_at ? new Date(r.end_at).toLocaleString() : ''}</td>
            <td>${r.progress_value ?? ''}</td>
            <td>${r.work_time ?? ''}</td>
            <td>
              <button class="btn btn-xs" data-edit-record="${r.record_work_id || r.id}">編集</button>
              <button class="btn btn-xs btn-danger" data-del-record="${r.record_work_id || r.id}">削除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ${!items.length ? '<div class="helper">記録がありません</div>' : ''}
    <div id="modal-root"></div>
  </div>`;
}

// 実績ページのイベントハンドラーを設定する関数
export function setupRecordsEvents() {
  // 編集ボタン
  document.querySelectorAll('[data-edit-record]').forEach(btn => {
    btn.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const recordId = e.target.dataset.editRecord;
      
      try {
        // APIから既存レコードの情報を取得
        const existingRecord = await api.getRecord(recordId);
        showRecordFormModal({ 
          mode: 'edit', 
          recordId,
          record: existingRecord,
          onSubmit: (data) => editRecord(recordId, data) 
        });
      } catch (error) {
        console.error('Failed to fetch record:', error);
        alert('実績データの取得に失敗しました: ' + error.message);
      }
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

// 実績編集処理
async function editRecord(recordId, data) {
  try {
    await api.updateRecord(recordId, data);
    alert('実績が更新されました');
    // ページを再描画（リロードの代わりに現在のページを再レンダリング）
    const currentPath = location.hash.replace(/^#/, '');
    location.hash = '#' + currentPath; // ルーターのhashchangeをトリガー
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
    // ページを再描画（リロードの代わりに現在のページを再レンダリング）
    const currentPath = location.hash.replace(/^#/, '');
    location.hash = '#' + currentPath; // ルーターのhashchangeをトリガー
  } catch (e) {
    console.error('Failed to delete record', e);
    alert('実績の削除に失敗しました: ' + e.message);
  }
}

// 実績追加・編集用モーダル
export function showRecordFormModal({ mode, taskId, recordId, record = {}, onSubmit }) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    console.error('Modal root not found');
    return;
  }
  
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="modal" style="background: var(--card); color: var(--text); border: 1px solid #1c2550; border-radius: 12px; padding: 24px; width: 90%; max-width: 500px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="margin-top: 0; margin-bottom: 16px; color: var(--text);">${mode === 'add' ? '実績追加' : '実績編集'}</h3>
        <form id="record-form">
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--text);">開始日時</label>
            <input type="datetime-local" name="start_at" value="${record.start_at ? formatDateForInput(record.start_at) : ''}" required style="width: 100%; padding: 8px; border: 1px solid #273061; border-radius: 4px; background: #0b1230; color: var(--text);">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--text);">終了日時</label>
            <input type="datetime-local" name="end_at" value="${record.end_at ? formatDateForInput(record.end_at) : ''}" required style="width: 100%; padding: 8px; border: 1px solid #273061; border-radius: 4px; background: #0b1230; color: var(--text);">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--text);">進捗値</label>
            <input type="number" name="progress_value" value="${record.progress_value || ''}" min="0" step="0.1" style="width: 100%; padding: 8px; border: 1px solid #273061; border-radius: 4px; background: #0b1230; color: var(--text);">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--text);">作業時間（分）</label>
            <input type="number" name="work_time" value="${record.work_time || ''}" min="0" style="width: 100%; padding: 8px; border: 1px solid #273061; border-radius: 4px; background: #0b1230; color: var(--text);">
          </div>
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 4px; font-weight: 600; color: var(--text);">メモ</label>
            <textarea name="note" rows="3" style="width: 100%; padding: 8px; border: 1px solid #273061; border-radius: 4px; resize: vertical; background: #0b1230; color: var(--text);">${record.note || ''}</textarea>
          </div>
          <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button type="button" id="cancel-btn" style="padding: 8px 16px; border: 1px solid #273061; background: #273061; color: var(--text); border-radius: 4px; cursor: pointer;">キャンセル</button>
            <button type="submit" style="padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer;">${mode === 'add' ? '追加' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  document.getElementById('record-form').onsubmit = (e) => {
    e.preventDefault();
    const form = e.target;
    
    // datetime-localの値をタイムゾーン付きISO文字列に変換
    const startDate = new Date(form.start_at.value);
    const endDate = new Date(form.end_at.value);
    
    const data = {
      start_at: startDate.toISOString(), // UTC形式で送信
      end_at: endDate.toISOString(),     // UTC形式で送信
      progress_value: form.progress_value.value ? Number(form.progress_value.value) : null,
      work_time: form.work_time.value ? Number(form.work_time.value) : null,
      note: form.note.value.trim() || null,
    };
    onSubmit(data);
    modalRoot.innerHTML = '';
  };
  
  document.getElementById('cancel-btn').onclick = () => {
    modalRoot.innerHTML = '';
  };
  
  // モーダル背景クリックで閉じる
  document.querySelector('.modal-overlay').onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      modalRoot.innerHTML = '';
    }
  };
}

// 削除確認モーダル
export function showDeleteConfirmModal({ onConfirm }) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) {
    console.error('Modal root not found');
    return;
  }
  
  modalRoot.innerHTML = `
    <div class="modal-overlay" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;">
      <div class="modal" style="background: var(--card); color: var(--text); border: 1px solid #1c2550; border-radius: 12px; padding: 24px; width: 90%; max-width: 400px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <h3 style="margin-bottom: 16px; color: var(--danger); margin-top: 0;">実績の削除</h3>
        <p style="margin-bottom: 24px; color: var(--muted);">この実績を削除してもよろしいですか？<br>この操作は取り消せません。</p>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
          <button id="cancel-delete-btn" style="padding: 8px 16px; border: 1px solid #273061; background: #273061; color: var(--text); border-radius: 4px; cursor: pointer;">キャンセル</button>
          <button id="confirm-delete-btn" style="padding: 8px 16px; background: var(--danger); color: white; border: none; border-radius: 4px; cursor: pointer;">削除</button>
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('confirm-delete-btn').onclick = () => {
    onConfirm();
    modalRoot.innerHTML = '';
  };
  
  document.getElementById('cancel-delete-btn').onclick = () => {
    modalRoot.innerHTML = '';
  };
  
  // モーダル背景クリックで閉じる
  document.querySelector('.modal-overlay').onclick = (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      modalRoot.innerHTML = '';
    }
  };
}
