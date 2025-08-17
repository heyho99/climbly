import { initRouter, navigateTo } from './router/index.js';
import { getMe } from './api/auth.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';

const routes = {
  '#/login': renderLogin,
  '#/dashboard': renderDashboard,
};

async function bootstrap() {
  const app = document.getElementById('app');
  app.textContent = 'Loading...';
  try {
    const me = await getMe();
    if (me) navigateTo('#/dashboard');
  } catch (_) {
    navigateTo('#/login');
  }
  initRouter(routes);
}

bootstrap();
