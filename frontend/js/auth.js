// ログイン認証の関数を定義

import { api } from './api.js';
import { setToken, getToken, clearToken } from './token.js';

// ログインの関数を定義
export async function login(username_or_email, password) {
  const { token, user } = await api.login({ username_or_email, password });
  setToken(token);
  return user;
}

// 現在のログインユーザーの情報を取得する関数を定義
export async function currentUser() {
  if (!getToken()) return null;
  try { return await api.me(); } catch { return null; }
}

// ログアウトの関数を定義
export function logout() { clearToken(); }
