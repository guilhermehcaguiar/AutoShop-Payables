import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { SkeletonTabela } from './Skeleton';

function MetasPage({ mostrarToast }) {
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState('');
  const [limiteMensal, setLimiteMensal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');

  const fetchMetas = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch('/metas/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) setMetas(await resp.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => {
    fetchMetas();
    const token = localStorage.getItem('token');
    apiFetch('/categorias/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => r.ok && r.json()).then(setCategorias).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    if (!categoria.trim() || !limiteMensal) {
      setErro('Preencha todos os campos');
      return;
    }
    setSalvando(true);
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch('/metas/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          categoria: categoria.trim(),
          limite_mensal: parseFloat(limiteMensal.replace(',', '.')),
        }),
      });
      if (resp.ok) {
        const nova = await resp.json();
        setMetas((prev) => {
          const idx = prev.findIndex((m) => m.categoria === nova.categoria);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = nova;
            return copy;
          }
          return [...prev, nova];
        });
        setCategoria('');
        setLimiteMensal('');
        mostrarToast('Meta salva com sucesso!');
      } else {
        const dados = await resp.json();
        setErro(dados.detail || 'Erro ao salvar meta');
      }
    } catch {
      setErro('Erro de conexão com o servidor');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border">
        <div className="h-5 bg-slate-700/50 rounded w-40 animate-pulse" />
        <div className="h-3 bg-slate-700/50 rounded w-56 mt-1 animate-pulse" />
      </div>
      <div className="p-5 border-b border-atend-border">
        <div className="flex gap-3">
          <div className="h-10 bg-slate-700/50 rounded flex-1 animate-pulse" />
          <div className="h-10 bg-slate-700/50 rounded w-40 animate-pulse" />
          <div className="h-10 bg-slate-700/50 rounded w-24 animate-pulse" />
        </div>
      </div>
      <SkeletonTabela linhas={4} colunas={2} />
    </div>
  );

  return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border">
        <h3 className="text-lg font-bold text-white">Metas por Categoria</h3>
        <p className="text-xs text-slate-400">Defina limites mensais para cada categoria</p>
      </div>

      <div className="p-5 border-b border-atend-border">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
            <input type="text" value={categoria} onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Aluguel, Água, Peças"
              list="lista-categorias-meta"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
            <datalist id="lista-categorias-meta">
              {categorias.map((cat, i) => (<option key={i} value={cat} />))}
            </datalist>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Limite Mensal (R$)</label>
            <input type="text" value={limiteMensal} onChange={(e) => setLimiteMensal(e.target.value)}
              placeholder="Ex: 5000,00"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
          </div>
          <button type="submit" disabled={salvando}
            className="w-full sm:w-auto bg-atend-verde hover:opacity-90 disabled:opacity-50 text-slate-950 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all shadow-lg shadow-atend-verde/10 whitespace-nowrap">
            {salvando ? 'Salvando...' : 'Salvar Meta'}
          </button>
        </form>
        {erro && <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center">⚠️ {erro}</div>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-5 py-4">Categoria</th>
              <th className="px-5 py-4">Limite Mensal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
            {metas.length === 0 ? (
              <tr>
                <td colSpan="2" className="px-5 py-12 text-center text-slate-500 bg-slate-900/10">
                  <div className="text-2xl mb-2">🎯</div>
                  <p className="text-sm font-medium text-slate-400">Nenhuma meta cadastrada</p>
                  <p className="text-xs text-slate-500 mt-0.5">Adicione uma meta usando o formulário acima</p>
                </td>
              </tr>
            ) : (
              metas.map((meta) => (
                <tr key={meta.id} className="hover:bg-slate-900/20 transition-colors">
                  <td className="px-5 py-4 font-medium text-white">{meta.categoria}</td>
                  <td className="px-5 py-4 text-atend-verde font-semibold">
                    R$ {meta.limite_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default MetasPage;
