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

  const initial = task || { task_name:'', task_content:'', category:'study', start_at:'', end_at:'', target_time:0, comment:'', status:'active' };

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
          <label>ステータス</label>
          <select name="status">
            <option value="active" ${initial.status==='active'?'selected':''}>アクティブ</option>
            <option value="completed" ${initial.status==='completed'?'selected':''}>完了</option>
            <option value="paused" ${initial.status==='paused'?'selected':''}>一時停止</option>
            <option value="cancelled" ${initial.status==='cancelled'?'selected':''}>キャンセル</option>
          </select>
        </div>
      </div>
      <div class="row">
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
      <div class="row" style="margin:8px 0; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn secondary" type="button" id="equalize-work">作業計画を均等配分</button>
        <button class="btn secondary" type="button" id="equalize-time">時間計画を均等配分</button>
        <span style="font-size:12px;color:#666;">開始日〜終了日の期間を基準に計算します。必要に応じて後で個別調整してください。</span>
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
    status: fd.get('status') || 'active',
    start_at: start_date ? new Date(start_date).toISOString() : null,
    end_at: end_date ? new Date(end_date).toISOString() : null,
    target_time: Number(fd.get('target_time') || 0),
    comment: fd.get('comment') || '',
  };
  return { payload, start_date, end_date };
}

// タスクフォームページのイベントハンドラーを設定する関数
export function setupTaskFormEvents() {
  // フォーム送信
  const taskForm = document.getElementById('task-form');
  if (taskForm) {
    taskForm.onsubmit = async (e) => {
      e.preventDefault();
      const errBox = document.getElementById('task-error');
      errBox.style.display = 'none';
      const mode = e.target.dataset.mode;
      const id = e.target.dataset.id;
      const { payload } = collectForm(e.target);

      try {
        if (mode === 'edit') {
          const items = e.target._planItems || [];
          const vErr = validateBeforeSubmit(payload, items);
          if (vErr) throw new Error(vErr);
          await api.updateTaskWithPlans(id, payload, items);
        } else {
          const items = e.target._planItems || [];
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
    };
  }

  // キャンセルボタン
  const cancelBtn = document.getElementById('cancel');
  if (cancelBtn) {
    cancelBtn.onclick = (e) => {
      e.preventDefault();
      navigateTo('/tasks');
    };
  }

  const form = document.getElementById('task-form');

  function handleEqualization({ type }) {
    if (!form) return;
    const { payload, start_date, end_date } = collectForm(form);
    const errBox = document.getElementById('task-error');
    errBox.style.display = 'none';

    const skeleton = buildPlanSkeleton(start_date, end_date, form._planItems || []);
    if (typeof skeleton === 'string') {
      errBox.textContent = skeleton;
      errBox.style.display = 'block';
      return;
    }

    let updated;
    if (type === 'work') {
      updated = equalizeWorkPlans(skeleton);
    } else {
      updated = equalizeTimePlans(skeleton, Number(payload.target_time || 0));
    }

    if (typeof updated === 'string') {
      errBox.textContent = updated;
      errBox.style.display = 'block';
      return;
    }

    form._planItems = updated;
    renderPreview(updated, Number(payload.target_time || 0));

    const el = document.getElementById('daily-plan-chart');
    if (el) {
      initDailyPlanChart({
        el,
        items: updated,
        onChange(next) {
          form._planItems = next;
          const fd2 = new FormData(form);
          const tgt = Number(fd2.get('target_time') || 0);
          renderPreview(next, tgt);
        }
      });
    }
  }

  const equalizeWorkBtn = document.getElementById('equalize-work');
  if (equalizeWorkBtn) {
    equalizeWorkBtn.onclick = (e) => {
      e.preventDefault();
      handleEqualization({ type: 'work' });
    };
  }

  const equalizeTimeBtn = document.getElementById('equalize-time');
  if (equalizeTimeBtn) {
    equalizeTimeBtn.onclick = (e) => {
      e.preventDefault();
      handleEqualization({ type: 'time' });
    };
  }

  // 編集モード時の初期化
  if (form && form.dataset.mode === 'edit' && !form._initializedPreview) {
    const script = document.getElementById('initial-plans');
    if (script) {
      let items = [];
      try { items = JSON.parse(script.textContent || '[]'); } catch {}
      if (Array.isArray(items) && items.length > 0) {
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
      }
      form._initializedPreview = true;
    }
  }
}

// 均等配分のための骨組み生成
function buildPlanSkeleton(start_date, end_date, existingItems = []) {
  if (!start_date || !end_date) return '開始日と終了日は必須です。';
  const sd = new Date(start_date);
  const ed = new Date(end_date);
  if (Number.isNaN(sd) || Number.isNaN(ed)) return '日付の形式が不正です。';
  if (ed < sd) return '終了日は開始日以降である必要があります。';

  const days = Math.floor((ed - sd) / (24 * 3600 * 1000)) + 1;
  if (days <= 0) return '期間が不正です。';

  const map = new Map(existingItems.map(it => [it.target_date, it]));
  const skeleton = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(sd.getTime() + i * 24 * 3600 * 1000);
    const dateStr = d.toISOString().slice(0, 10);
    const existing = map.get(dateStr) || {};
    skeleton.push({
      target_date: dateStr,
      work_plan_value: Number(existing.work_plan_value ?? 0),
      time_plan_value: Number(existing.time_plan_value ?? 0)
    });
  }
  return skeleton;
}

function equalizeWorkPlans(items) {
  if (!Array.isArray(items) || items.length === 0) return '期間が正しく設定されていません。';
  const days = items.length;
  const baseW = Math.floor(100 / days);
  let remW = 100 - baseW * days;
  let cumulativeWork = 0;

  return items.map(item => {
    const extra = remW > 0 ? 1 : 0;
    if (remW > 0) remW--;
    cumulativeWork += baseW + extra;
    return {
      ...item,
      work_plan_value: cumulativeWork,
    };
  });
}

function equalizeTimePlans(items, target_time) {
  if (!Array.isArray(items) || items.length === 0) return '期間が正しく設定されていません。';
  if (target_time < 0) return '目標時間は0以上を指定してください。';
  const days = items.length;
  const baseT = Math.floor(target_time / days);
  let remT = target_time - baseT * days;

  return items.map(item => {
    const extra = remT > 0 ? 1 : 0;
    if (remT > 0) remT--;
    return {
      ...item,
      time_plan_value: baseT + extra,
    };
  });
}

function renderPreview(items, target_time) {
  const p = document.getElementById('preview');
  const tbody = document.querySelector('#preview-table tbody');
  const sumBox = document.getElementById('preview-sum');
  if (!p || !tbody || !sumBox) return;
  tbody.innerHTML = items.map(it => `<tr><td>${it.target_date}</td><td style="text-align:right;">${it.work_plan_value}%</td><td style="text-align:right;">${it.time_plan_value}h</td></tr>`).join('');
  
  // 時間の合計計算
  const sumT = items.reduce((a,b)=>a+Number(b.time_plan_value||0),0);
  
  // 作業計画値は累積値なので、最終日の値が最終進捗
  const sortedItems = [...items].sort((a, b) => new Date(a.target_date) - new Date(b.target_date));
  const finalWorkValue = sortedItems[sortedItems.length - 1]?.work_plan_value || 0;
  
  sumBox.textContent = `合計: 作業 ${finalWorkValue}% / 時間 ${sumT}h（目標 ${target_time}h）`;
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
  const sumT = items.reduce((a,b)=>a+Number(b.time_plan_value||0),0);
  
  // 作業計画値は累積値なので、最終日の値が100%であることを確認
  const sortedItems = [...items].sort((a, b) => new Date(a.target_date) - new Date(b.target_date));
  const finalWorkValue = sortedItems[sortedItems.length - 1]?.work_plan_value || 0;
  
  if (finalWorkValue !== 100) return '作業計画の最終累積値が100%になっていません。';
  if (sumT !== Number(payload.target_time||0)) return '時間の合計が目標時間と一致していません。';
  return '';
}
