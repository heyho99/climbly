import { initRouter, navigateTo } from './router.js';
import { api, setToken, getToken, clearToken } from './api.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { TasksView } from './views/tasks.js';
import { TaskFormView } from './views/task_form.js';
import { RecordsView } from './views/records.js';

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

function guard(path) {
  const authed = !!getToken();
  if (!authed && path !== '/login') {
    navigateTo('/login');
    return false;
  }
  if (authed && path === '/login') {
    navigateTo('/dashboard');
    return false;
  }
  return true;
}

initRouter({ routes, beforeEach: guard, onRender: renderNav });

// 初回遷移
if (!location.hash) {
  navigateTo('/login');
}
