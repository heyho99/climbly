import { http, setAccessToken } from './http.js';

export async function login(username, password) {
  const res = await http.post('/login', { username, password });
  setAccessToken(res.access_token);
  return res;
}

export async function logout() {
  await http.post('/logout', {});
  setAccessToken(null);
}

export async function getMe() {
  return http.get('/users/me');
}
