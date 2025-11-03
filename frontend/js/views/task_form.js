// タスク作成/編集ビュー

import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { initDailyPlanChart } from './components/daily_plan_chart.js';

const WEEKDAY_ORDER = [
  { key: 'sun', label: '日', index: 0 },
  { key: 'mon', label: '月', index: 1 },
  { key: 'tue', label: '火', index: 2 },
  { key: 'wed', label: '水', index: 3 },
  { key: 'thu', label: '木', index: 4 },
  { key: 'fri', label: '金', index: 5 },
  { key: 'sat', label: '土', index: 6 },
];

const WEEKDAY_BY_INDEX = WEEKDAY_ORDER.reduce((acc, day) => {
  acc[day.index] = day;
  return acc;
}, {});

const ROLE_LABELS = {
  read: '閲覧',
  write: '更新',
  admin: '管理',
};


export async function TaskFormView({ mode, id }) {
  let task = null;
  let dailyPlans = [];
  let taskAuths = [];
  let currentUser = null;
  let isAdmin = false;
  if (mode === 'edit') {
    try {
      const res = await api.getTask(id);
      task = res?.task || null;
      dailyPlans = Array.isArray(res?.daily_plans) ? res.daily_plans : [];
    } catch {}
    try {
      const me = await api.me();
      currentUser = me || null;
    } catch {}
    try {
      const authRes = await api.listTaskAuths(id);
      taskAuths = Array.isArray(authRes) ? authRes : [];
    } catch {}
    if (currentUser) {
      const uid = Number(currentUser.user_id);
      isAdmin = taskAuths.some(auth => Number(auth.user_id) === uid && auth.task_user_auth === 'admin');
    }
  }

  const initial = task || { task_name:'', task_content:'', category:'study', start_at:'', end_at:'', target_time:0, comment:'', status:'active' };
  const authHelperText = isAdmin
    ? '管理者として他のユーザへ権限を付与・更新できます。'
    : '権限は閲覧のみ可能です（管理者のみ追加・更新ができます）。';
  const authSection = mode === 'edit' ? `
        <div id="task-auth-section" style="margin-top:16px; padding:12px; border:1px solid #e5e7eb; border-radius:6px;">
          <div style="font-weight:bold; margin-bottom:8px;">権限管理</div>
          <p class="helper" style="margin-bottom:8px;">${escapeHtml(authHelperText)}</p>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr><th>ユーザID</th><th>権限</th>${isAdmin ? '<th>操作</th>' : ''}</tr>
              </thead>
              <tbody id="task-auth-table"></tbody>
            </table>
          </div>
          <div id="task-auth-error" class="alert" style="display:none; margin-top:8px;"></div>
          <div id="task-auth-add-container" class="row" style="margin-top:12px; gap:8px; ${isAdmin ? '' : 'display:none;'}">
            <div class="col" style="min-width:160px;">
              <label>ユーザID</label>
              <input type="number" min="1" id="auth-add-user-id" />
            </div>
            <div class="col" style="min-width:160px;">
              <label>付与する権限</label>
              <select id="auth-add-role">
                <option value="read">閲覧</option>
                <option value="write">更新</option>
                <option value="admin">管理</option>
              </select>
            </div>
            <div class="col" style="align-self:flex-end;">
              <button type="button" class="btn secondary" id="auth-add-submit">追加</button>
            </div>
          </div>
        </div>
      ` : '';
  const initialAuthScript = mode === 'edit' ? `<script id="initial-auths" type="application/json">${JSON.stringify(taskAuths || [])}</script>` : '';

  return `
  <div class="card">
    <h2>タスク${mode === 'edit' ? '編集' : '作成'}</h2>
    <form id="task-form" data-mode="${mode}" data-id="${id||''}" data-is-admin="${isAdmin ? '1' : '0'}" data-current-user-id="${currentUser?.user_id ?? ''}">
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
      <div class="auto-plan-settings" style="margin:12px 0; padding:12px; border:1px solid #e5e7eb; border-radius:6px;">
        <div style="font-weight:bold; margin-bottom:8px;">自動計算方式</div>
        <div class="row" style="gap:16px; flex-wrap:wrap; margin-bottom:12px; align-items:center;">
          <label style="display:flex; align-items:center; gap:4px;">
            <input type="radio" name="auto-plan-type" value="equal" checked />
            均等配分
          </label>
          <label style="display:flex; align-items:center; gap:4px;">
            <input type="radio" name="auto-plan-type" value="weekday-weekend" />
            平日/土日
          </label>
          <label style="display:flex; align-items:center; gap:4px;">
            <input type="radio" name="auto-plan-type" value="weekly" />
            曜日ごと
          </label>
        </div>
        <div data-auto-config="weekday-weekend" style="display:none;">
          <div style="font-weight:bold; margin-bottom:4px;">平日/土日設定（割合）</div>
          <div class="row" style="gap:12px; flex-wrap:wrap;">
            <div class="col" style="min-width:160px;">
              <label>平日 割合(%)</label>
              <input type="number" step="0.1" min="0" name="auto-weekday-ratio" value="0" />
            </div>
            <div class="col" style="min-width:160px;">
              <label>土日 割合(%)</label>
              <input type="number" step="0.1" min="0" name="auto-weekend-ratio" value="0" />
            </div>
          </div>
          <p style="font-size:12px; color:#666; margin-top:8px;">入力割合は自動で正規化され、余剰は期間の前半から順番に配分されます。</p>
        </div>
        <div data-auto-config="weekly" style="display:none; margin-top:12px;">
          <div style="font-weight:bold; margin-bottom:8px;">曜日ごとの設定（割合）</div>
          <div class="table-wrapper">
            <table class="table" style="min-width:320px;">
              <thead>
                <tr><th style="width:80px;">曜日</th><th>割合(%)</th></tr>
              </thead>
              <tbody>
                ${WEEKDAY_ORDER.map(day => `
                  <tr>
                    <td>${day.label}</td>
                    <td><input type="number" step="0.1" min="0" name="auto-weekly-ratio-${day.key}" value="0" /></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <p style="font-size:12px; color:#666; margin-top:8px;">曜日ごとの割合は正規化され、余剰は早い日付から順に配分されます。</p>
        </div>
        <p style="font-size:12px;color:#666; margin-top:12px;">自動計算ボタンで選択した方式を適用します。（入力割合は自動調整され、最終的に作業100%と目標時間に一致します。）</p>
      </div>
      <div class="row" style="margin:8px 0; gap:8px; align-items:center; flex-wrap:wrap;">
        <button class="btn secondary" type="button" id="equalize-work">作業計画を自動計算</button>
        <button class="btn secondary" type="button" id="equalize-time">時間計画を自動計算</button>
      </div>
      <div id="preview" style="display:none; margin:8px 0;">
        <div style="font-weight:bold; margin-bottom:4px;">日次計画プレビュー</div>
        <div id="daily-plan-chart" style="width:100%;height:360px;"></div>
      </div>
      ${authSection}
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn" type="submit">${mode==='edit'?'更新':'作成'}</button>
        <button class="btn secondary" type="button" id="cancel">キャンセル</button>
      </div>
      <div id="task-error" class="alert" style="display:none; margin-top:8px;"></div>
      ${mode==='edit' ? `<script id="initial-plans" type="application/json">${JSON.stringify(dailyPlans||[])}</script>` : ''}
      ${initialAuthScript}
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

  if (form) {
    const syncAutoConfigVisibility = () => {
      const type = getAutoPlanType(form);
      const configs = form.querySelectorAll('[data-auto-config]');
      configs.forEach((el) => {
        if (!el) return;
        el.style.display = el.dataset.autoConfig === type ? '' : 'none';
      });
    };
    const autoRadios = form.querySelectorAll('input[name="auto-plan-type"]');
    autoRadios.forEach((radio) => {
      radio.addEventListener('change', syncAutoConfigVisibility);
    });
    syncAutoConfigVisibility();
  }

  function handleEqualization({ type }) {
    if (!form) return;
    const { payload, start_date, end_date } = collectForm(form);
    const fd = new FormData(form);
    const autoType = fd.get('auto-plan-type') || 'equal';
    const targetTime = Number(payload.target_time || 0);
    const errBox = document.getElementById('task-error');
    errBox.style.display = 'none';

    const skeleton = buildPlanSkeleton(start_date, end_date, form._planItems || []);
    if (typeof skeleton === 'string') {
      errBox.textContent = skeleton;
      errBox.style.display = 'block';
      return;
    }

    const ratioWeights = buildAutoPlanWeights(autoType, skeleton, fd);
    if (typeof ratioWeights === 'string') {
      errBox.textContent = ratioWeights;
      errBox.style.display = 'block';
      return;
    }

    let updated;
    if (type === 'work') {
      updated = applyWorkWithWeights(skeleton, ratioWeights);
    } else {
      updated = applyTimeWithWeights(skeleton, ratioWeights, targetTime);
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

  // 権限管理
  if (form && form.dataset.mode === 'edit') {
    const authTable = document.getElementById('task-auth-table');
    const authErrorBox = document.getElementById('task-auth-error');
    const addUserInput = document.getElementById('auth-add-user-id');
    const addRoleSelect = document.getElementById('auth-add-role');
    const addSubmitBtn = document.getElementById('auth-add-submit');
    const isAdmin = form.dataset.isAdmin === '1';
    const taskId = form.dataset.id;
    let authState = [];

    function showAuthError(message) {
      if (!authErrorBox) return;
      if (message) {
        authErrorBox.textContent = message;
        authErrorBox.style.display = 'block';
      } else {
        authErrorBox.textContent = '';
        authErrorBox.style.display = 'none';
      }
    }

    function renderAuthRows() {
      if (!authTable) return;
      const rows = authState.map(auth => {
        const role = auth.task_user_auth;
        const roleLabel = ROLE_LABELS[role] || role;
        if (!isAdmin) {
          return `<tr>
            <td>${escapeHtml(String(auth.user_id))}</td>
            <td>${escapeHtml(roleLabel)}</td>
          </tr>`;
        }
        const options = ['read', 'write', 'admin'].map(opt => `
            <option value="${opt}" ${opt === role ? 'selected' : ''}>${ROLE_LABELS[opt] || opt}</option>
          `).join('');
        return `<tr>
          <td>${escapeHtml(String(auth.user_id))}</td>
          <td>
            <select data-auth-id="${auth.task_auth_id}" class="auth-role-select">
              ${options}
            </select>
          </td>
          <td>
            <button type="button" class="btn danger" data-auth-delete="${auth.task_auth_id}">削除</button>
          </td>
        </tr>`;
      }).join('');
      if (rows) {
        authTable.innerHTML = rows;
      } else {
        const colspan = isAdmin ? 3 : 2;
        authTable.innerHTML = `<tr><td colspan="${colspan}" class="helper">権限が設定されていません。</td></tr>`;
      }
    }

    const initialAuthScript = document.getElementById('initial-auths');
    if (initialAuthScript) {
      try {
        const parsed = JSON.parse(initialAuthScript.textContent || '[]');
        if (Array.isArray(parsed)) authState = parsed;
      } catch {}
    }
    renderAuthRows();

    if (isAdmin && authTable) {
      authTable.addEventListener('change', async (e) => {
        const target = e.target;
        if (!(target instanceof HTMLSelectElement)) return;
        const authId = target.dataset.authId;
        if (!authId) return;
        const newRole = target.value;
        showAuthError('');
        target.disabled = true;
        try {
          const updated = await api.updateTaskAuth(taskId, authId, { task_user_auth: newRole });
          authState = authState.map(item => item.task_auth_id === updated.task_auth_id ? updated : item);
          renderAuthRows();
        } catch (err) {
          showAuthError(err?.message || '権限の更新に失敗しました。');
          target.value = [...authState.filter(item => String(item.task_auth_id) === String(authId))][0]?.task_user_auth || 'read';
        } finally {
          target.disabled = false;
        }
      });

      authTable.addEventListener('click', async (e) => {
        const btn = e.target;
        if (!(btn instanceof HTMLButtonElement)) return;
        const authId = btn.dataset.authDelete;
        if (!authId) return;
        if (!confirm('権限を削除しますか？')) return;
        btn.disabled = true;
        showAuthError('');
        try {
          await api.deleteTaskAuth(taskId, authId);
          authState = authState.filter(item => String(item.task_auth_id) !== String(authId));
          renderAuthRows();
        } catch (err) {
          showAuthError(err?.message || '権限の削除に失敗しました。');
        } finally {
          btn.disabled = false;
        }
      });
    }

    if (isAdmin && addSubmitBtn) {
      addSubmitBtn.onclick = async (e) => {
        e.preventDefault();
        if (!addUserInput || !addRoleSelect) return;
        const userId = Number(addUserInput.value);
        const role = addRoleSelect.value;
        if (!userId || userId <= 0) {
          showAuthError('ユーザIDを正しく入力してください。');
          return;
        }
        showAuthError('');
        addSubmitBtn.disabled = true;
        try {
          const created = await api.createTaskAuth(taskId, { user_id: userId, task_user_auth: role });
          authState = [...authState, created];
          addUserInput.value = '';
          addRoleSelect.value = 'read';
          renderAuthRows();
        } catch (err) {
          showAuthError(err?.message || '権限の追加に失敗しました。');
        } finally {
          addSubmitBtn.disabled = false;
        }
      };
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
  const preview = document.getElementById('preview');
  if (!preview) return;
  preview.style.display = items && items.length ? 'block' : 'none';
}

function validateBeforeSubmit(payload, items) {
  // 必須
  if (!payload.start_at || !payload.end_at) return '開始日と終了日は必須です。';
  const sd = new Date(payload.start_at);
  const ed = new Date(payload.end_at);
  if (ed < sd) return '終了日は開始日以降である必要があります。';
  if (payload.target_time < 0) return '目標時間は0以上を指定してください。';
  if (!items || items.length === 0) return '自動計算を実行して日次計画を作成してください。';

  // 合計チェック
  const sumT = items.reduce((a,b)=>a+Number(b.time_plan_value||0),0);

  // 作業計画値は累積値なので、最終日の値が100%であることを確認
  const sortedItems = [...items].sort((a, b) => new Date(a.target_date) - new Date(b.target_date));
  const finalWorkValue = sortedItems[sortedItems.length - 1]?.work_plan_value || 0;
  
  if (finalWorkValue !== 100) return '作業計画の最終累積値が100%になっていません。';
  if (sumT !== Number(payload.target_time||0)) return '時間の合計が目標時間と一致していません。';
  return '';
}

function getAutoPlanType(form) {
  const checked = form.querySelector('input[name="auto-plan-type"]:checked');
  return checked ? checked.value : 'equal';
}

function buildAutoPlanWeights(autoType, items, fd) {
  if (autoType === 'weekday-weekend') {
    const weekdayRatio = Number(fd.get('auto-weekday-ratio') || 0);
    const weekendRatio = Number(fd.get('auto-weekend-ratio') || 0);
    if (weekdayRatio <= 0 && weekendRatio <= 0) {
      return '平日と土日の割合を入力してください。';
    }
    return items.map(item => {
      const idx = getWeekdayIndex(item.target_date);
      return (idx === 0 || idx === 6) ? weekendRatio : weekdayRatio;
    });
  }

  if (autoType === 'weekly') {
    const ratios = WEEKDAY_ORDER.reduce((acc, day) => {
      acc[day.index] = Number(fd.get(`auto-weekly-ratio-${day.key}`) || 0);
      return acc;
    }, {});
    const hasPositive = Object.values(ratios).some(v => v > 0);
    if (!hasPositive) {
      return '曜日ごとの割合を少なくとも1つ入力してください。';
    }
    return items.map(item => ratios[getWeekdayIndex(item.target_date)] || 0);
  }

  // 均等配分
  return new Array(items.length).fill(1);
}

function applyWorkWithWeights(items, weights) {
  const increments = allocateByWeights(weights, 100, { allowZeroTotal: false, label: '作業計画' });
  if (typeof increments === 'string') return increments;
  let cumulative = 0;
  return items.map((item, i) => {
    cumulative += increments[i];
    return { ...item, work_plan_value: cumulative };
  });
}

function applyTimeWithWeights(items, weights, target_time) {
  const total = Math.round(Number(target_time || 0));
  if (total < 0) return '目標時間は0以上を指定してください。';
  if (total === 0) {
    return items.map(item => ({ ...item, time_plan_value: 0 }));
  }
  const increments = allocateByWeights(weights, total, { allowZeroTotal: false, label: '時間計画' });
  if (typeof increments === 'string') return increments;
  return items.map((item, i) => ({ ...item, time_plan_value: increments[i] }));
}

function allocateByWeights(rawWeights, total, { allowZeroTotal, label }) {
  const weights = rawWeights.map(w => {
    const num = Number(w);
    return Number.isFinite(num) && num > 0 ? num : 0;
  });
  const sum = weights.reduce((acc, val) => acc + val, 0);

  if (total === 0) {
    return new Array(weights.length).fill(0);
  }

  if (sum === 0) {
    return allowZeroTotal ? new Array(weights.length).fill(0) : `${label}の配分比率が0です。値を入力してください。`;
  }

  const base = [];
  let allocated = 0;

  for (let i = 0; i < weights.length; i++) {
    const share = (weights[i] / sum) * total;
    const value = Math.floor(share);
    base[i] = value;
    allocated += value;
  }

  let remaining = Math.round(total - allocated);
  for (let i = 0; i < base.length && remaining > 0; i++) {
    base[i] += 1;
    remaining -= 1;
  }

  return base;
}

function getWeekdayIndex(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
