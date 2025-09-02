import { initRouter, navigateTo } from './router.js';
import { getToken, clearToken } from './token.js';
import { LoginView } from './views/login.js';
import { DashboardView } from './views/dashboard.js';
import { TasksView } from './views/tasks.js';
import { TaskFormView } from './views/task_form.js';
import { RecordsView } from './views/records.js';
import { RecordsBoardView } from './views/records_board.js';


// ナビゲーション(ヘッダやサイドバーの)をレンダリングする関数
function renderNav() {
  const nav = document.getElementById('app-nav');
  const authed = !!getToken();
  nav.innerHTML = authed ? `
    <a href="#/dashboard" data-link>ダッシュボード</a>
    <a href="#/tasks" data-link>タスク</a>
    <a href="#/records" data-link>実績</a>
    <a href="#/records/board" data-link>実績(ボード)</a>
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

// ガード：画面遷移直前に実行されるログイン判定（ログイン有無はトークンで判断）
function guard(path) {
  const authed = !!getToken(); // !!で値をboolに変換
  // 未認証でログインページ以外にアクセスしたら、ログインページへリダイレクト
  if (!authed && path !== '/login') {  
    navigateTo('/login');
    return false;
  }
  // 認証済みでログインページにアクセスしたら、ダッシュボードへリダイレクト
  if (authed && path === '/login') {  
    navigateTo('/dashboard');
    return false;
  }
  return true;
}



// ---実行部分---

// SPAのルーターは、javascriptファイルをルートする
// ビューのルーティングの対応表（ルート定義）
const routes = {
  '/login': LoginView,
  '/dashboard': DashboardView,
  '/tasks': TasksView,
  '/tasks/new': (params) => TaskFormView({ mode: 'create', ...params }),
  '/tasks/:id': (params) => TaskFormView({ mode: 'edit', ...params }),
  '/records': RecordsView,
  '/records/board': RecordsBoardView,
};

// ルーターを初期化（ルーター設定の反映、hashchangeイベントリスナーの作成、）
// hashchangeのイベントリスナーを作成
// { ルート定義, 毎回の遷移前に実行される関数, 遷移後に実行される関数 }
initRouter({ routes, beforeEach: guard, onRender: renderNav });

// location.hashが空なら/loginに遷移
if (!location.hash) {
  navigateTo('/login');
}
