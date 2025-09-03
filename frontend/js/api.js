// frontendからの、BFFへのAPI呼び出しの関数を定義

import { getToken } from './token.js';

const API_BASE = (window.BFF_BASE_URL ?? '') + '/bff/v1';

// apiにリクエストを送る関数を定義
async function request(path, { method='GET', body, headers={} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let msg = 'Request failed';
    try { const err = await res.json(); msg = err.message || JSON.stringify(err); } catch {}
    throw new Error(`${res.status}: ${msg}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// 未定義/空値を除外してクエリ文字列を生成
function toQuery(params = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
  const qs = new URLSearchParams(cleaned).toString();
  return qs ? `?${qs}` : '';
}


// BFFへのAPI呼び出しの関数をまとめた、apiオブジェクトを定義（中核）
export const api = {
  // Auth
  async login({ username_or_email, password }) { return request('/auth/login', { method:'POST', body:{ username_or_email, password } }); },
  async register({ username, email, password }) { return request('/auth/register', { method:'POST', body:{ username, email, password } }); },
  async me() { return request('/users/me'); },

  // Dashboard
  async dashboardSummary() { return request('/dashboard/summary'); },
  async laggingTasks() { return request('/dashboard/lagging_tasks'); },

  // Tasks
  async listTasks(params={}) {
    const qs = toQuery({ mine:'true', ...params });
    return request(`/tasks${qs}`);
  },
  async getTask(task_id) { return request(`/tasks/${task_id}`); },
  // async createTask(payload) { return request('/tasks', { method:'POST', body: payload }); },
  async updateTask(task_id, payload) { return request(`/tasks/${task_id}`, { method:'PATCH', body: payload }); },
  async deleteTask(task_id) { return request(`/tasks/${task_id}`, { method:'DELETE' }); },
  async createTaskWithPlans(taskPayload, items) {
    return request('/tasks_with_plans', { method:'POST', body: { task: taskPayload, daily_plans: { items } } });
  },
  async updateTaskWithPlans(task_id, taskPayload, items) {
    return request(`/tasks_with_plans/${task_id}`, { method:'PATCH', body: { task: taskPayload, daily_plans: { items } } });
  },

  // Records
  // 互換関数: 既存コードからは diary を呼ぶ
  async listRecords(params={}) {
    const qs = toQuery(params);
    return request(`/records/diary${qs}`);
  },
  // 明示的関数
  async listRecordsDiary(params={}) {
    const qs = toQuery(params);
    return request(`/records/diary${qs}`);
  },
  async listRecordsByTask(params={}) {
    const qs = toQuery(params);
    return request(`/records/by_task${qs}`);
  },
  async createRecord(payload) { return request('/records', { method:'POST', body: payload }); },
  async updateRecord(id, payload) { return request(`/records/${id}`, { method:'PATCH', body: payload }); },
  async deleteRecord(id) { return request(`/records/${id}`, { method:'DELETE' }); },
};

// duplicate re-export removed; functions are already exported above
