import { initRouter, navigateTo } from './router.js';
import { getToken, clearToken } from './token.js';
import { LoginView, setupLoginEvents } from './views/login.js';
import { RegisterView, setupRegisterEvents } from './views/register.js';
import { DashboardView } from './views/dashboard.js';
import { TasksView, setupTasksEvents } from './views/tasks.js';
import { TaskFormView, setupTaskFormEvents } from './views/task_form.js';
import { RecordsView, setupRecordsEvents } from './views/records.js';
import { RecordsBoardView, setupRecordsBoardEvents } from './views/records_board.js';


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
    <a href="#/register" data-link>新規登録</a>
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
  // 未認証でログインページや登録ページ以外にアクセスしたら、ログインページへリダイレクト
  if (!authed && path !== '/login' && path !== '/register') {  
    navigateTo('/login');
    return false;
  }
  // 認証済みでログインページや登録ページにアクセスしたら、ダッシュボードへリダイレクト
  if (authed && (path === '/login' || path === '/register')) {  
    navigateTo('/dashboard');
    return false;
  }
  return true;
}

// 画面描画後に実行される関数
function onRender() {
  renderNav();
  
  // 現在のパスを取得
  const path = location.hash.replace(/^#/, '');
  
  // ページ毎のイベントセットアップ
  // document.addEventListner()だと、このjsファイルがapp.jsでimportされる毎に実行されてしまうが、
  // 関数ベースのイベントハンドラの設定により、対象のページが読み込まれたときのみにイベントハンドラが設定されるようになる。
  // しかも、ページを離れた時点でイベントハンドラを解放することもでき安全
  if (path === '/login') {
    setupLoginEvents();
  } else if (path === '/register') {
    setupRegisterEvents();
  } else if (path === '/tasks') {
    setupTasksEvents();
  } else if (path.startsWith('/tasks/')) {
    setupTaskFormEvents();
  } else if (path === '/records') {
    setupRecordsEvents();
  } else if (path === '/records/board') {
    setupRecordsBoardEvents();
  }
  // DashboardViewはイベントハンドラなし
}



// ---実行部分---

// SPAのルーターは、javascriptファイルをルートする
// ビューのルーティングの対応表（ルート定義）
const routes = {
  '/login': LoginView,
  '/register': RegisterView,
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
initRouter({ routes, beforeEach: guard, onRender });

// location.hashが空なら/loginに遷移
if (!location.hash) {
  navigateTo('/login');
}
