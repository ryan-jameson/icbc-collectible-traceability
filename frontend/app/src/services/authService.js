import apiClient, { setAuthToken } from './apiClient';

const LOGIN_ENDPOINTS = {
  ADMIN: 'auth/admin/login',
  SUPER_ADMIN: 'auth/admin/login',
  ICBC_ADMIN: 'auth/admin/login',
  BRAND_ADMIN: 'auth/admin/login',
  CLIENT: 'auth/client/login',
  USER: 'auth/client/login'
};

export const login = async ({ email, password, role = 'ADMIN' }) => {
  const normalizedRole = (role || 'ADMIN').toUpperCase();
  const endpoint = LOGIN_ENDPOINTS[normalizedRole] || 'auth/login';

  const response = await apiClient.post(endpoint, { email, password });
  const { data } = response.data;
  setAuthToken(data.token);
  return data;
};

export const loginWithIcbc = async ({ icbcToken, role = 'USER', accountType = 'PERSONAL' }) => {
  const response = await apiClient.post('auth/login/icbc', { icbcToken, role, accountType });
  const { data } = response.data;
  setAuthToken(data.token);
  return data;
};

export const initIcbcLogin = async ({ accountType = 'PERSONAL' }) => {
  const response = await apiClient.post('auth/login/icbc/init', { accountType });
  return response.data.data;
};

export const fetchIcbcLoginStatus = async (sessionId) => {
  const response = await apiClient.get('auth/login/icbc/status', {
    params: { sessionId }
  });
  return response.data.data;
};

export const authorizeIcbcSession = async ({ sessionId, icbcToken = null, testUserId = null }) => {
  const response = await apiClient.post('auth/login/icbc/authorize', {
    sessionId,
    icbcToken,
    testUserId
  });
  return response.data.data;
};

export const fetchProfile = async () => {
  const response = await apiClient.get('auth/me');
  return response.data.data;
};

export const logout = async () => {
  try {
    await apiClient.post('auth/logout');
  } catch (error) {
    // ignore network failures during logout
  }
  setAuthToken(null);
};
