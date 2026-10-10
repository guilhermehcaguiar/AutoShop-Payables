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

  const controller = new AbortController();
  const cancelar = () => controller.abort(options.signal.reason);
  options.signal?.addEventListener('abort', cancelar, { once: true });
  if (options.signal?.aborted) cancelar();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: { ...defaultHeaders, ...(options.headers || {}) },
    });
    if (response.status === 401 && token && endpoint !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('usuarioPerfil');
      window.dispatchEvent(new CustomEvent('sessao-expirada'));
    }
    return response;
  } catch (err) {
    if (options.signal?.aborted) throw err;
    if (err.name === 'AbortError') throw new Error('A conexão demorou demais. Tente novamente.', { cause: err });
    throw new Error('Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.', { cause: err });
  } finally { clearTimeout(timeout); options.signal?.removeEventListener('abort', cancelar); }
}

export async function exigirSucesso(response, fallback = 'Não foi possível concluir a operação.') {
  if (response.ok) return response;
  let detalhe;
  try { detalhe = (await response.json()).detail; } catch { /* Resposta sem JSON. */ }
  const mensagem = Array.isArray(detalhe) ? detalhe.map(d => d.msg).join(' ') : typeof detalhe === 'string' ? detalhe : fallback;
  throw new Error(response.status === 401 ? 'Sua sessão expirou. Entre novamente para continuar.' : mensagem || fallback);
}

export async function apiJson(endpoint, options) {
  const response = await exigirSucesso(await apiFetch(endpoint, options));
  return response.status === 204 ? null : response.json();
}
