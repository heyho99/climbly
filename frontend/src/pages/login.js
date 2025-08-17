import { login, getMe } from '../api/auth.js';
import { navigateTo } from '../router/index.js';

export function renderLogin(root) {
  root.innerHTML = `
    <h1>ログイン</h1>
    <form id="login-form">
      <label>ユーザー名 <input name="username" required /></label><br />
      <label>パスワード <input name="password" type="password" required /></label><br />
      <button type="submit">ログイン</button>
    </form>
    <p id="msg"></p>
  `;

  const form = root.querySelector('#login-form');
  const msg = root.querySelector('#msg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    try {
      await login(fd.get('username'), fd.get('password'));
      await getMe();
      navigateTo('#/dashboard');
    } catch (err) {
      msg.textContent = 'ログインに失敗しました';
    }
  });
}
