import apiClient from './apiClient';

export const listBrands = async (params = {}) => {
  const response = await apiClient.get('brands', { params });
  const payload = response.data || {};
  const data = payload.data || payload.brands || [];
  const pagination = payload.pagination || {
    total: Array.isArray(data) ? data.length : 0,
    page: params.page || 1,
    limit: params.limit || data.length || 0
  };
  return { data, pagination };
};
