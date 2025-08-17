const BASE_URL = '/api/v1';
let accessToken = null; // in-memory

export function setAccessToken(token) {
  accessToken = token;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `HTTP ${res.status}`);
  }

  const ct = res.headers.get('Content-Type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

export const http = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body: JSON.stringify(body) }),
  put: (p, body) => request(p, { method: 'PUT', body: JSON.stringify(body) }),
  del: (p) => request(p, { method: 'DELETE' }),
};
