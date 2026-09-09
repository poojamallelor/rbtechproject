import axios from 'axios';

const host = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? '127.0.0.1'
  : (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || `http://${host}:8000/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default apiClient;
