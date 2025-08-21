// index.htmlのメイン部分DOMを指す
const appRoot = () => document.getElementById('app-root');

function parseRoute(pathname) {
  // ルートパラメータ簡易対応 /tasks/:id
  const routes = Object.keys(routerConfig.routes);
  for (const pattern of routes) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:\w+/g, (m) => { keys.push(m.slice(1)); return '([\\w-]+)'; }) + '$');
    const m = pathname.match(re);
    if (m) {
      const params = {};
      keys.forEach((k, i) => params[k] = m[i+1]);
      return { pattern, params };
    }
  }
  return { pattern: pathname, params: {} };
}

// { ルート定義, 毎回の遷移前に実行される関数, 遷移後に実行される関数 }
let routerConfig = { routes: {}, beforeEach: null, onRender: null };

// ルーターを初期化する関数
// ルーターの設定、ハッシュ変更のイベントリスナーを設定、初回遷移を実行
export function initRouter(config) {
  routerConfig = config;
  // hashchange：https://index.html#a → https://index.html#b のようなhashの変更
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

// location.hash（locationはwindow.locationのこと）を変更する関数
// location.hashの例... http://localhost:8080/#/login → location.hash = "#/login"
export function navigateTo(path) { location.hash = '#' + path; }


// 現在のURLハッシュに応じて表示画面を切り替える関数（中核処理）
async function handleRoute() {
  // #/loginを/loginに変換
  const path = location.hash.replace(/^#/, '');
  // 左辺：beforeEach（ガード関数）が定義されていれば、右辺を評価
  // 右辺：beforeEach(path)がfalse、つまり不正なアクセスなら、遷移を中止
  if (routerConfig.beforeEach && !routerConfig.beforeEach(path)) return;

  const { pattern, params } = parseRoute(path);
  const View = routerConfig.routes[pattern];
  if (!View) {
    appRoot().innerHTML = `<div class="card">存在しないページです: ${path}</div>`;
    return;
  }
  appRoot().innerHTML = '<div class="card">Loading...</div>';
  const html = await View(params);
  appRoot().innerHTML = html;
  if (routerConfig.onRender) routerConfig.onRender();
}
