import api from './api';

export const getUtilityServices = async () => {
  const response = await api.get('/services');
  return response.data;
};

export const createUtilityService = async (serviceData) => {
  const response = await api.post('/services', serviceData);
  return response.data;
};

export const updateUtilityService = async (id, serviceData) => {
  const response = await api.put(`/services/${id}`, serviceData);
  return response.data;
};

export const deleteUtilityService = async (id) => {
  const response = await api.delete(`/services/${id}`);
  return response.data;
};