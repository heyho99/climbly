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
      <div style="margin-top:12px;">
        <button class="btn" type="submit" style="width: 100%;">ログイン</button>
      </div>
      <div style="margin-top:16px; text-align:center;">
        <span class="helper">アカウントをお持ちでない方は </span>
        <button class="btn secondary" type="button" id="goto-register">新規登録</button>
      </div>
      <div class="helper">初回はバックエンドが未起動だと失敗します。BFFを起動してください。</div>
      <div id="login-error" class="alert" style="display:none; margin-top:8px;"></div>
    </form>
  </div>`;
}

// ログインページのイベントハンドラーを設定する関数
export function setupLoginEvents() {
  // ログインフォーム
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.onsubmit = async (e) => {
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
    };
  }

  // 新規登録ボタン
  const gotoRegisterBtn = document.getElementById('goto-register');
  if (gotoRegisterBtn) {
    gotoRegisterBtn.onclick = (e) => {
      e.preventDefault();
      navigateTo('/register');
    };
  }
}
