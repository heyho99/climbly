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

let routerConfig = { routes: {}, beforeEach: null, onRender: null };

export function initRouter(config) {
  routerConfig = config;
  // hashchange：https://index.html#a → https://index.html#b のようなhashの変更
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function navigateTo(path) { location.hash = '#' + path; }

async function handleRoute() {
  // location：window.locationのことで、URLやサーバといった"位置"を表す
  // location.hash：URLの#以降の部分を表す  http://localhost:8080/#/login → location.hash = "#/login"
  // #/dashboardならdashboardに、評価結果がfalsy(空文字など)なら/loginに
  const path = location.hash.replace(/^#/, '') || '/login';
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
