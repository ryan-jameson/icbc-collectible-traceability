import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { message } from 'antd';
import { fetchProfile, login as loginRequest, loginWithIcbc, logout as logoutRequest } from '../services/authService';
import { setAuthToken } from '../services/apiClient';

const TOKEN_STORAGE_KEY = 'icbc-collectible-token';
const ICBC_SESSION_STORAGE_KEY = 'icbc-collectible-icbc-token';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => window.localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [icbcSessionToken, setIcbcSessionToken] = useState(() => window.localStorage.getItem(ICBC_SESSION_STORAGE_KEY));
  const [loading, setLoading] = useState(true);

  const persistToken = useCallback((value) => {
    if (value) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    setAuthToken(value);
    setToken(value);
  }, []);

  const persistIcbcToken = useCallback((value) => {
    if (value) {
      window.localStorage.setItem(ICBC_SESSION_STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(ICBC_SESSION_STORAGE_KEY);
    }
    setIcbcSessionToken(value || null);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      setAuthToken(null);
      return;
    }

    try {
      setAuthToken(token);
      const profile = await fetchProfile();
      setUser(profile);
    } catch (error) {
      console.error('加载用户信息失败:', error);
      persistToken(null);
      setUser(null);
      message.error('登录状态已失效，请重新登录');
    } finally {
      setLoading(false);
    }
  }, [persistToken, token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleLogin = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const { token: newToken, user: userInfo } = await loginRequest(credentials);
      persistToken(newToken);
      persistIcbcToken(null);
      setUser(userInfo);
      message.success('登录成功');
    } finally {
      setLoading(false);
    }
  }, [persistToken, persistIcbcToken]);

  const handleIcbcLogin = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { token: newToken, user: userInfo } = await loginWithIcbc(payload);
      persistToken(newToken);
      persistIcbcToken(payload.icbcToken);
      setUser(userInfo);
      message.success('已通过工行认证登录');
    } finally {
      setLoading(false);
    }
  }, [persistToken, persistIcbcToken]);

  const finalizeIcbcSessionLogin = useCallback(({ token: newToken, user: userInfo, icbcToken: sessionToken = null }) => {
    persistToken(newToken);
    persistIcbcToken(sessionToken);
    setUser(userInfo);
    setLoading(false);
    message.success('登录成功');
  }, [persistToken, persistIcbcToken]);

  const handleLogout = useCallback(async () => {
    await logoutRequest();
    persistToken(null);
    persistIcbcToken(null);
    setUser(null);
  }, [persistToken, persistIcbcToken]);

  const value = useMemo(() => ({
    user,
    token,
    icbcSessionToken,
    loading,
    isAuthenticated: Boolean(user && token),
    login: handleLogin,
    loginWithIcbc: handleIcbcLogin,
    finalizeIcbcSessionLogin,
    logout: handleLogout,
    refreshUser: loadProfile
  }), [user, token, icbcSessionToken, loading, handleLogin, handleIcbcLogin, finalizeIcbcSessionLogin, handleLogout, loadProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
};
