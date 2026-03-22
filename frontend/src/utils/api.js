import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// API endpoints
export const stocksAPI = {
  list: (params) => api.get('/stocks', { params }),
  detail: (symbol) => api.get(`/stocks/${symbol}`),
  live: (symbol) => api.get(`/stocks/${symbol}/live`),
  marketOverview: () => api.get('/stocks/market-overview'),
  sectors: () => api.get('/stocks/sectors/list'),
};

export const scannersAPI = {
  list: () => api.get('/scanners'),
  run: (key) => api.get(`/scanners/${key}`),
  runCustom: (conditions) => api.post('/scanners/custom', { conditions }),
  save: (name, conditions) => api.post('/scanners/save', { name, conditions }),
  savedList: () => api.get('/scanners/saved/list'),
};

export const fundamentalsAPI = {
  get: (symbol) => api.get(`/fundamentals/${symbol}`),
  quarterly: (symbol) => api.get(`/fundamentals/${symbol}/quarterly`),
  screen: (params) => api.get('/fundamentals/screen/filter', { params }),
};

export const fiiDiiAPI = {
  latest: () => api.get('/fii-dii/latest'),
  history: (days) => api.get('/fii-dii/history', { params: { days } }),
  cumulative: () => api.get('/fii-dii/cumulative'),
  sectorAllocation: () => api.get('/fii-dii/sector-allocation'),
};

export const alertsAPI = {
  list: () => api.get('/alerts'),
  create: (data) => api.post('/alerts', data),
  delete: (id) => api.delete(`/alerts/${id}`),
  toggle: (id) => api.put(`/alerts/${id}/toggle`),
};

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
};

export const newsAPI = {
  list: (params) => api.get('/news', { params }),
  live: () => api.get('/news/live'),
};

export const optionsAPI = {
  chain: (symbol) => api.get(`/options/${symbol}`),
};

export const chartsAPI = {
  data: (symbol, params) => api.get(`/charts/${symbol}`, { params }),
};

export default api;
