// タスク作成/編集ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';


export async function TaskFormView({ mode, id }) {
  let task = null;
  if (mode === 'edit') {
    try { const res = await api.getTask(id); task = res?.task || null; } catch {}
  }

  const initial = task || { task_name:'', task_content:'', category:'study', start_at:'', end_at:'', target_time:0, comment:'' };

  return `
  <div class="card">
    <h2>タスク${mode === 'edit' ? '編集' : '作成'}</h2>
    <form id="task-form" data-mode="${mode}" data-id="${id||''}">
      <label>名称</label>
      <input name="task_name" value="${escapeHtml(initial.task_name)}" required />
      <label>説明</label>
      <textarea name="task_content" rows="4">${escapeHtml(initial.task_content||'')}</textarea>
      <div class="row">
        <div class="col">
          <label>カテゴリ</label>
          <select name="category">
            ${['study','creation','other'].map(c => `<option value="${c}" ${initial.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="col">
          <label>開始日</label>
          <input type="date" name="start_date" value="${initial.start_at ? toDate(initial.start_at) : ''}" />
        </div>
        <div class="col">
          <label>終了日</label>
          <input type="date" name="end_date" value="${initial.end_at ? toDate(initial.end_at) : ''}" />
        </div>
      </div>
      <label>目標時間</label>
      <input type="number" name="target_time" value="${initial.target_time||0}" min="0" />
      <label>コメント</label>
      <textarea name="comment" rows="2">${escapeHtml(initial.comment||'')}</textarea>
      <div class="alert helper">（未実装）作成時に日次計画の均等割りを自動生成できます。</div>
      <label><input type="checkbox" name="auto_plan" checked /> 日次計画を均等割りで自動生成</label>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn" type="submit">${mode==='edit'?'更新':'作成'}</button>
        <button class="btn secondary" type="button" id="cancel">キャンセル</button>
      </div>
      <div id="task-error" class="alert" style="display:none; margin-top:8px;"></div>
    </form>
  </div>`;
}

// 日付をYYYY-MM-DD形式に変換する関数
function toDate(dt) { try { return new Date(dt).toISOString().slice(0,10); } catch { return ''; } }

// HTML特殊文字をエスケープ（サニタイズ）し、その値を出力する関数
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])); }

// フォームの値を取得する関数
function collectForm(form) {
  const fd = new FormData(form);
  const start_date = fd.get('start_date');
  const end_date = fd.get('end_date');
  const payload = {
    task_name: fd.get('task_name'),
    task_content: fd.get('task_content') || '',
    category: fd.get('category') || 'other',
    start_at: start_date ? new Date(start_date).toISOString() : null,
    end_at: end_date ? new Date(end_date).toISOString() : null,
    target_time: Number(fd.get('target_time') || 0),
    comment: fd.get('comment') || '',
  };
  const autoPlan = fd.get('auto_plan') === 'on';
  return { payload, autoPlan };
}



document.addEventListener('submit', async (e) => {
  const form = e.target.closest('#task-form');
  if (!form) return;
  e.preventDefault();
  const errBox = document.getElementById('task-error');
  errBox.style.display = 'none';
  const mode = form.dataset.mode;
  const id = form.dataset.id;
  const { payload, autoPlan } = collectForm(form);

  try {
    if (mode === 'edit') {
      await api.updateTask(id, payload);
    } else {
      const body = autoPlan ? { ...payload, allow_auto_distribution: true } : payload;
      await api.createTask(body);
    }
    navigateTo('/tasks');
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cancel') {
    e.preventDefault();
    navigateTo('/tasks');
  }
});
