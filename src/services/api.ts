import axios from 'axios';

function getCSRFToken(): string {
  return document.cookie
    .split('; ')
    .find(row => row.startsWith('csrftoken='))
    ?.split('=')[1] || '';
}

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(config => {
  if (config.method === 'post') {
    config.headers['X-CSRFToken'] = getCSRFToken();
  }
  return config;
});
