let state = { user: null };

export function setUser(user) {
  state.user = user;
}

export function getUser() {
  return state.user;
}
