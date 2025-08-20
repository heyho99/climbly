import { login } from '../auth.js';
import { navigateTo } from '../router.js';

export function LoginView() {
  return `
  <div class="card">
    <h2>ログイン</h2>
    <form id="login-form" class="form">
      <label>ユーザー名またはメール</label>
      <input type="text" id="username" placeholder="username or email" required />
      <label>パスワード</label>
      <input type="password" id="password" placeholder="••••••••" required />
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn" type="submit">ログイン</button>
        <button class="btn secondary" type="button" id="goto-demo">デモへ</button>
      </div>
      <div class="helper">初回はバックエンドが未起動だと失敗します。BFFを起動してください。</div>
      <div id="login-error" class="alert" style="display:none; margin-top:8px;"></div>
    </form>
  </div>`;
}

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('#login-form');
  if (!form) return;
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errBox = document.getElementById('login-error');
  errBox.style.display = 'none';
  try {
    await login(username, password);
    navigateTo('/dashboard');
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'goto-demo') {
    e.preventDefault();
    // 簡易デモ: 既知のダミー資格情報を試す or ダッシュボードへ遷移（トークン無し）
    navigateTo('/dashboard');
  }
});
