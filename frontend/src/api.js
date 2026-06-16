const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const url = `${API_URL}${endpoint}`;

  const isFormData = options.body instanceof FormData || options.body instanceof URLSearchParams;
  const hasContentType = options.headers && options.headers['Content-Type'];

  const defaultHeaders = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(!isFormData && !hasContentType ? { 'Content-Type': 'application/json' } : {}),
  };

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
  });
}