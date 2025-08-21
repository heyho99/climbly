import { initRouter, navigateTo } from './router.js';
import { api, setToken, getToken, clearToken } from './api.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { TasksView } from './views/tasks.js';
import { TaskFormView } from './views/task_form.js';
import { RecordsView } from './views/records.js';

// SPAのルーターは、javascriptファイルをルートする
const routes = {
  '/login': LoginView,
  '/dashboard': DashboardView,
  '/tasks': TasksView,
  '/tasks/new': (params) => TaskFormView({ mode: 'create', ...params }),
  '/tasks/:id': (params) => TaskFormView({ mode: 'edit', ...params }),
  '/records': RecordsView,
};

function renderNav() {
  const nav = document.getElementById('app-nav');
  const authed = !!getToken();
  nav.innerHTML = authed ? `
    <a href="#/dashboard" data-link>ダッシュボード</a>
    <a href="#/tasks" data-link>タスク</a>
    <a href="#/records" data-link>実績</a>
    <a href="#/login" id="logout-link" data-link>ログアウト</a>
  ` : `
    <a href="#/login" data-link>ログイン</a>
  `;

  const logout = document.getElementById('logout-link');
  if (logout) {
    logout.addEventListener('click', (e) => {
      e.preventDefault();
      clearToken();
      navigateTo('/login');
    });
  }
}

// ガード：画面遷移直前に実行されるログイン判定
function guard(path) {
  const authed = !!getToken();
  if (!authed && path !== '/login') {  // 未認証かつログインページ以外
    navigateTo('/login'); // ログインページへ
    return false;
  }
  if (authed && path === '/login') {  // 認証済みかつログインページ
    navigateTo('/dashboard'); // ダッシュボードへ
    return false;
  }
  return true;
}


// ---実行部分---

// ルーターを初期化
// hashchangeのイベントリスナーを作成
initRouter({ routes, beforeEach: guard, onRender: renderNav });

// 初回遷移
if (!location.hash) { // URLの#以降の部分が空なら（つまりhttp://localhost:8080/）
  navigateTo('/login');
}
