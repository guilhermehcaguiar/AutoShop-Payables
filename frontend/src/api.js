const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const url = `${API_URL}${endpoint}`;

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });
}