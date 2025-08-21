const API_BASE = (window.BFF_BASE_URL ?? '') + '/bff/v1';

let token = localStorage.getItem('climbly_token') || '';
export function setToken(t) { token = t; localStorage.setItem('climbly_token', t); }
export function getToken() { return token; }
export function clearToken() { token = ''; localStorage.removeItem('climbly_token'); }

async function request(path, { method='GET', body, headers={} } = {}) {
  const h = { 'Content-Type': 'application/json', ...headers };
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
    const qs = new URLSearchParams({ mine:'true', ...params }).toString();
    return request(`/tasks?${qs}`);
  },
  async getTask(task_id) { return request(`/tasks/${task_id}`); },
  async createTask(payload) { return request('/tasks', { method:'POST', body: payload }); },
  async updateTask(task_id, payload) { return request(`/tasks/${task_id}`, { method:'PATCH', body: payload }); },
  async deleteTask(task_id) { return request(`/tasks/${task_id}`, { method:'DELETE' }); },

  // Records
  async listRecords(params={}) {
    const qs = new URLSearchParams(params).toString();
    return request(`/records?${qs}`);
  },
  async createRecord(payload) { return request('/records', { method:'POST', body: payload }); },
  async updateRecord(id, payload) { return request(`/records/${id}`, { method:'PATCH', body: payload }); },
  async deleteRecord(id) { return request(`/records/${id}`, { method:'DELETE' }); },
};

// duplicate re-export removed; functions are already exported above
