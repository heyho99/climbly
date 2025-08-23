// アクセストークンの状態管理モジュール

// モジュール読み込み時に localStorage から復元
let token = localStorage.getItem('climbly_token') || '';

export function setToken(t) {
  token = t;
  localStorage.setItem('climbly_token', t);
}

export function getToken() {
  return token;
}

export function clearToken() {
  token = '';
  localStorage.removeItem('climbly_token');
}
