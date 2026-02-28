import apiClient from './apiClient';

export const createCollectible = async (payload) => {
  let data = payload;
  if (!(payload instanceof FormData)) {
    data = new FormData();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => data.append(`${key}[]`, item));
        return;
      }
      data.append(key, value);
    });
  }

  const response = await apiClient.post('collectibles', data);
  return response.data.data;
};

export const listCollectibles = async (params = {}) => {
  const response = await apiClient.get('collectibles', { params });
  const payload = response.data || {};
  if (Array.isArray(payload)) {
    return { data: payload, pagination: { total: payload.length, page: 1, pages: 1, limit: payload.length } };
  }
  const data = payload.data || payload.collectibles || [];
  const pagination = payload.pagination || {
    total: data.length,
    page: params.page || 1,
    pages: 1,
    limit: params.limit || data.length
  };
  return { data, pagination };
};

export const getCollectibleById = async (id) => {
  const response = await apiClient.get(`collectibles/${id}`);
  return response.data.data;
};

export const getCollectibleHistory = async (id) => {
  const response = await apiClient.get(`collectibles/${id}/history`);
  return response.data.data;
};

export const verifyCollectible = async ({ id, hash }) => {
  const response = await apiClient.post('collectibles/verify', { id, hash });
  return response.data;
};

export const claimCollectible = async (id, icbcToken, applicationDetails = null) => {
  const response = await apiClient.post(
    `collectibles/${id}/claim`,
    { applicationDetails },
    {
      headers: {
        'X-ICBC-Auth': icbcToken
      }
    }
  );
  return response.data.data;
};

export const requestCollectibleTransfer = async (id, payload) => {
  const response = await apiClient.post(`collectibles/${id}/transfer-request`, payload);
  return response.data.data;
};

export const transferCollectible = async (id, payload) => {
  const response = await apiClient.post(`collectibles/${id}/transfer`, payload);
  return response.data.data;
};

export const updateCollectibleStatus = async (id, status) => {
  const response = await apiClient.patch(`collectibles/${id}/status`, { status });
  return response.data.data;
};

export const updateCollectibleDetails = async (id, payload) => {
  const response = await apiClient.patch(`collectibles/${id}`, payload);
  return response.data.data;
};

export const searchCollectibles = async (params) => listCollectibles(params);

export const submitCollectibleApplication = async (payload) => {
  const response = await apiClient.post('collectibles/applications', payload);
  return response.data.data;
};

export const listCollectibleApplications = async (params = {}) => {
  const response = await apiClient.get('collectibles/applications', { params });
  const payload = response.data || {};
  return {
    data: payload.data || [],
    pagination: payload.pagination || {
      total: (payload.data || []).length,
      limit: params.limit || (payload.data || []).length || 0,
      offset: params.offset || 0
    }
  };
};

export const updateCollectibleApplicationStatus = async (id, status, notes = null) => {
  const response = await apiClient.patch(`collectibles/applications/${id}/status`, { status, notes });
  return response.data.data;
};

export const getMyCollectibleApplications = async () => {
  const response = await apiClient.get('collectibles/applications/mine');
  return response.data.data || [];
};
