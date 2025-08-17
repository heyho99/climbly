export function initRouter(routes) {
  const app = document.getElementById('app');

  const render = () => {
    const hash = window.location.hash || '#/login';
    const page = routes[hash];
    if (page) {
      app.innerHTML = '';
      page(app);
    } else {
      app.textContent = '404 Not Found';
    }
  };

  window.addEventListener('hashchange', render);
  render();
}

export function navigateTo(hash) {
  if (window.location.hash === hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}
