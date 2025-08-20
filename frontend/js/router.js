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
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function navigateTo(path) { location.hash = '#' + path; }

async function handleRoute() {
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
