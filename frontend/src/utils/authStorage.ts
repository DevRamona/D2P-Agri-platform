const ACCESS_TOKEN_KEY = "d2p_access_token";
const REFRESH_TOKEN_KEY = "d2p_refresh_token";
const USER_KEY = "d2p_user";

const setTokens = (accessToken: string, refreshToken: string) => {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
};

const clearTokens = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};

const getAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = () => window.localStorage.getItem(REFRESH_TOKEN_KEY);

const setStoredUser = (user: unknown) => {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
};

const clearStoredUser = () => {
  window.localStorage.removeItem(USER_KEY);
};

const getStoredUser = () => {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    return null;
  }
};

export {
  setTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setStoredUser,
  clearStoredUser,
  getStoredUser,
};
