// ログイン認証の関数を定義

import { api, setToken, getToken, clearToken } from './api.js';

export async function login(username_or_email, password) {
  const { token, user } = await api.login({ username_or_email, password });
  setToken(token);
  return user;
}

export async function currentUser() {
  if (!getToken()) return null;
  try { return await api.me(); } catch { return null; }
}

export function logout() { clearToken(); }
