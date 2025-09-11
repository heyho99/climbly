import { api } from '../api.js';
import { navigateTo } from '../router.js';
import { setToken } from '../token.js';

export function RegisterView() {
  return `
  <div class="card">
    <h2>新規登録</h2>
    <form id="register-form" class="form">
      <label>ユーザー名</label>
      <input type="text" id="username" placeholder="ユーザー名を入力" required minlength="3" maxlength="20" />
      <div class="helper">3文字以上20文字以下で入力してください</div>
      
      <label>メールアドレス</label>
      <input type="email" id="email" placeholder="example@email.com" required />
      
      <label>パスワード</label>
      <input type="password" id="password" placeholder="••••••••" required minlength="6" />
      <div class="helper">6文字以上で入力してください</div>
      
      <label>パスワード（確認）</label>
      <input type="password" id="password-confirm" placeholder="••••••••" required />
      
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button class="btn" type="submit">登録</button>
        <button class="btn secondary" type="button" id="goto-login">ログインへ戻る</button>
      </div>
      <div id="register-error" class="alert" style="display:none; margin-top:8px;"></div>
    </form>
  </div>`;
}

// ユーザ登録ページのイベントハンドラーを設定する関数
export function setupRegisterEvents() {
  // 登録フォーム
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.onsubmit = async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value.trim();
      const email = document.getElementById('email').value.trim();
      const password = document.getElementById('password').value;
      const passwordConfirm = document.getElementById('password-confirm').value;
      const errBox = document.getElementById('register-error');
      
      // エラー表示をリセット
      errBox.style.display = 'none';
      
      // バリデーション
      if (password !== passwordConfirm) {
        errBox.textContent = 'パスワードが一致しません';
        errBox.style.display = 'block';
        return;
      }
      
      if (username.length < 3) {
        errBox.textContent = 'ユーザー名は3文字以上で入力してください';
        errBox.style.display = 'block';
        return;
      }
      
      if (password.length < 6) {
        errBox.textContent = 'パスワードは6文字以上で入力してください';
        errBox.style.display = 'block';
        return;
      }
      
      try {
        const response = await api.register({ username, email, password });
        
        // 登録成功時は自動的にログイン状態になる（トークンが返される）
        if (response.token) {
          setToken(response.token);
          navigateTo('/dashboard');
        } else {
          // トークンがない場合はログイン画面へ
          navigateTo('/login');
        }
      } catch (err) {
        let errorMessage = err.message;
        
        // エラーメッセージを日本語化
        if (errorMessage.includes('user already exists')) {
          errorMessage = 'そのユーザー名またはメールアドレスは既に使用されています';
        } else if (errorMessage.includes('invalid email')) {
          errorMessage = 'メールアドレスの形式が正しくありません';
        }
        
        errBox.textContent = errorMessage;
        errBox.style.display = 'block';
      }
    };
  }

  // ログインへ戻るボタン
  const gotoLoginBtn = document.getElementById('goto-login');
  if (gotoLoginBtn) {
    gotoLoginBtn.onclick = (e) => {
      e.preventDefault();
      navigateTo('/login');
    };
  }
}
