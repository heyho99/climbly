// タスク作成/編集ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { initDailyPlanChart } from './components/daily_plan_chart.js';


export async function TaskFormView({ mode, id }) {
  let task = null;
  let dailyPlans = [];
  if (mode === 'edit') {
    try {
      const res = await api.getTask(id);
      task = res?.task || null;
      dailyPlans = Array.isArray(res?.daily_plans) ? res.daily_plans : [];
    } catch {}
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
      <div class="row" style="margin:8px 0; gap:8px; align-items:center;">
        <button class="btn secondary" type="button" id="equalize">均等配分</button>
        <span style="font-size:12px;color:#666;">開始日〜終了日、目標時間に基づき計算します。必要に応じて後で編集予定。</span>
      </div>
      <div id="preview" style="display:none; margin:8px 0;">
        <div style="font-weight:bold; margin-bottom:4px;">日次計画プレビュー</div>
        <div id="preview-sum" style="margin-bottom:4px; font-size:13px;"></div>
        <div id="daily-plan-chart" style="width:100%;height:360px;margin-bottom:8px;"></div>
        <div class="table-wrapper">
          <table class="table" id="preview-table">
            <thead><tr><th>日付</th><th>作業(%)</th><th>時間</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn" type="submit">${mode==='edit'?'更新':'作成'}</button>
        <button class="btn secondary" type="button" id="cancel">キャンセル</button>
      </div>
      <div id="task-error" class="alert" style="display:none; margin-top:8px;"></div>
      ${mode==='edit' ? `<script id="initial-plans" type="application/json">${JSON.stringify(dailyPlans||[])}</script>` : ''}
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
  return { payload, start_date, end_date };
}



document.addEventListener('submit', async (e) => {
  const form = e.target.closest('#task-form');
  if (!form) return;
  e.preventDefault();
  const errBox = document.getElementById('task-error');
  errBox.style.display = 'none';
  const mode = form.dataset.mode;
  const id = form.dataset.id;
  const { payload } = collectForm(form);

  try {
    if (mode === 'edit') {
      const items = form._planItems || [];
      const vErr = validateBeforeSubmit(payload, items);
      if (vErr) throw new Error(vErr);
      await api.updateTaskWithPlans(id, payload, items);
    } else {
      const items = form._planItems || [];
      // 送信前バリデーション
      const vErr = validateBeforeSubmit(payload, items);
      if (vErr) throw new Error(vErr);
      await api.createTaskWithPlans(payload, items);
    }
    navigateTo('/tasks');
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

// 画面描画完了イベントで、編集モードなら初期プレビューとグラフを表示
window.addEventListener('app:rendered', () => {
  const form = document.getElementById('task-form');
  if (!form) return;
  if (form.dataset.mode !== 'edit') return;
  if (form._initializedPreview) return;
  const script = document.getElementById('initial-plans');
  if (!script) return;
  let items = [];
  try { items = JSON.parse(script.textContent || '[]'); } catch {}
  if (!Array.isArray(items) || items.length === 0) { form._initializedPreview = true; return; }
  form._planItems = items;
  const fd = new FormData(form);
  const target = Number(fd.get('target_time') || 0);
  renderPreview(items, target);
  const el = document.getElementById('daily-plan-chart');
  if (el) {
    initDailyPlanChart({
      el,
      items,
      onChange(updated) {
        form._planItems = updated;
        // 最新の目標時間で再計算表示
        const fd2 = new FormData(form);
        const tgt = Number(fd2.get('target_time') || 0);
        renderPreview(updated, tgt);
      }
    });
  }
  form._initializedPreview = true;
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cancel') {
    e.preventDefault();
    navigateTo('/tasks');
  }
  
  if (e.target && e.target.id === 'equalize') {
    e.preventDefault();
    const form = document.getElementById('task-form');
    if (!form) return;
    const { payload, start_date, end_date } = collectForm(form);
    const errBox = document.getElementById('task-error');
    errBox.style.display = 'none';
    const items = buildEqualizedItems(start_date, end_date, Number(payload.target_time||0));
    if (typeof items === 'string') {
      // エラーメッセージを返す場合
      errBox.textContent = items;
      errBox.style.display = 'block';
      return;
    }
    form._planItems = items; // フォームインスタンスに保持
    renderPreview(items, Number(payload.target_time||0));

    // ECharts を初期化し、点編集結果をフォームに反映
    const el = document.getElementById('daily-plan-chart');
    if (el) {
      initDailyPlanChart({
        el,
        items,
        onChange(updated) {
          form._planItems = updated;
          // 合計表示を更新（テーブルも更新しておく）
          renderPreview(updated, Number(payload.target_time||0));
        }
      });
    }
  }
});

// 均等配分で日次計画を作成
function buildEqualizedItems(start_date, end_date, target_time) {
  if (!start_date || !end_date) return '開始日と終了日は必須です。';
  const sd = new Date(start_date);
  const ed = new Date(end_date);
  if (isNaN(sd) || isNaN(ed)) return '日付の形式が不正です。';
  if (ed < sd) return '終了日は開始日以降である必要があります。';
  if (target_time < 0) return '目標時間は0以上を指定してください。';
  const days = Math.floor((ed - sd) / (24*3600*1000)) + 1;
  if (days <= 0) return '期間が不正です。';

  // 作業%は100を日数で整数割り、余りは前方に+1
  const baseW = Math.floor(100 / days);
  let remW = 100 - baseW * days;
  const baseT = Math.floor(target_time / days);
  let remT = target_time - baseT * days;

  const items = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(sd.getTime() + i * 24*3600*1000);
    const dateStr = d.toISOString().slice(0,10);
    const w = baseW + (remW > 0 ? 1 : 0);
    if (remW > 0) remW--;
    const t = baseT + (remT > 0 ? 1 : 0);
    if (remT > 0) remT--;
    items.push({ target_date: dateStr, work_plan_value: w, time_plan_value: t });
  }
  return items;
}

function renderPreview(items, target_time) {
  const p = document.getElementById('preview');
  const tbody = document.querySelector('#preview-table tbody');
  const sumBox = document.getElementById('preview-sum');
  if (!p || !tbody || !sumBox) return;
  tbody.innerHTML = items.map(it => `<tr><td>${it.target_date}</td><td style="text-align:right;">${it.work_plan_value}</td><td style="text-align:right;">${it.time_plan_value}</td></tr>`).join('');
  const sumW = items.reduce((a,b)=>a+Number(b.work_plan_value||0),0);
  const sumT = items.reduce((a,b)=>a+Number(b.time_plan_value||0),0);
  sumBox.textContent = `合計: 作業 ${sumW}% / 時間 ${sumT}（目標 ${target_time}）`;
  p.style.display = 'block';
}

function validateBeforeSubmit(payload, items) {
  // 必須
  if (!payload.start_at || !payload.end_at) return '開始日と終了日は必須です。';
  const sd = new Date(payload.start_at);
  const ed = new Date(payload.end_at);
  if (ed < sd) return '終了日は開始日以降である必要があります。';
  if (payload.target_time < 0) return '目標時間は0以上を指定してください。';
  if (!items || items.length === 0) return '均等配分を押して日次計画を作成してください。';
  // 合計チェック
  const sumW = items.reduce((a,b)=>a+Number(b.work_plan_value||0),0);
  const sumT = items.reduce((a,b)=>a+Number(b.time_plan_value||0),0);
  if (sumW !== 100) return '作業(%)の合計が100になっていません。';
  if (sumT !== Number(payload.target_time||0)) return '時間の合計が目標時間と一致していません。';
  return '';
}
