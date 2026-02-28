import apiClient from './apiClient';

export const getCurrentUserCollectibles = async (params = {}) => {
  const response = await apiClient.get('users/me/collectibles', { params });
  const payload = response.data || {};
  if (Array.isArray(payload)) {
    return { data: payload, pagination: { total: payload.length, page: 1, pages: 1, limit: payload.length } };
  }
  return {
    data: payload.data || [],
    pagination: payload.pagination || {
      total: payload.data?.length || 0,
      page: params.page || 1,
      pages: 1,
      limit: params.limit || payload.data?.length || 0
    }
  };
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('users/me');
  return response.data.data;
};

export const listUsers = async (params = {}) => {
  const response = await apiClient.get('users', { params });
  const payload = response.data || {};

  return {
    data: payload.data || [],
    pagination: payload.pagination || {
      total: payload.data?.length || 0,
      page: params.page || 1,
      pages: 1,
      limit: params.limit || payload.data?.length || 0
    }
  };
};

export const createUser = async (data) => {
  const response = await apiClient.post('users', data);
  return response.data;
};

export const deactivateUser = async (userId) => {
  const response = await apiClient.delete(`users/${userId}`);
  return response.data;
};
