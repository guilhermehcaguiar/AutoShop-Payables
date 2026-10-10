import Icon from './Icon.jsx';
import Dialog from './Dialog.jsx';
import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { parseValorBR } from '../formatar.js';
import { SkeletonTabela } from './Skeleton';
import ConfirmDialog from './ConfirmDialog';

function MetasPage({ mostrarToast }) {
  const [metas, setMetas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [categoria, setCategoria] = useState('');
  const [limiteMensal, setLimiteMensal] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [erro, setErro] = useState('');
  const [metaAcao, setMetaAcao] = useState(null);
  const [editandoMeta, setEditandoMeta] = useState(null);
  const [confirmExcluir, setConfirmExcluir] = useState({ aberto: false, id: null, categoria: '' });
  const [editando, setEditando] = useState(false);

  const fetchMetas = async () => {
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch('/metas/', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) setMetas(await resp.json());
    } catch { /* noop */ } finally { setCarregando(false); }
  };

  useEffect(() => {
    const timer = setTimeout(fetchMetas, 0);
    const token = localStorage.getItem('token');
    apiFetch('/categorias/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => r.ok && r.json()).then(setCategorias).catch(() => undefined);
    return () => clearTimeout(timer);
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
    const limiteNumerico = parseValorBR(limiteMensal);
    if (limiteNumerico === null) {
      setErro('Valor inválido. Digite apenas números (ex: 1.500,00)');
      setSalvando(false);
      return;
    }
    try {
      const url = editando && editandoMeta ? `/metas/${editandoMeta.id}` : '/metas/';
      const method = editando && editandoMeta ? 'PUT' : 'POST';
      const resp = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          categoria: categoria.trim(),
          limite_mensal: limiteNumerico,
        }),
      });
      if (resp.ok) {
        const atualizada = await resp.json();
        setMetas((prev) => {
          const idx = prev.findIndex((m) => m.id === atualizada.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = atualizada;
            return copy;
          }
          return [...prev, atualizada];
        });
        setCategoria('');
        setLimiteMensal('');
        setEditando(false);
        setEditandoMeta(null);
        setMetaAcao(null);
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

  const handleEditarClick = (meta) => {
    setEditandoMeta(meta);
    setEditando(true);
    setCategoria(meta.categoria);
    setLimiteMensal(meta.limite_mensal.toFixed(2).replace('.', ','));
    setMetaAcao(null);
  };

  const handleExcluirClick = (meta) => {
    setConfirmExcluir({ aberto: true, id: meta.id, categoria: meta.categoria });
    setMetaAcao(null);
  };

  const handleExcluirConfirmar = async () => {
    const id = confirmExcluir.id;
    if (!id) return;
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch(`/metas/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (resp.ok) {
        setMetas((prev) => prev.filter((m) => m.id !== id));
        setConfirmExcluir({ aberto: false, id: null, categoria: '' });
        mostrarToast('Meta excluída com sucesso!');
      } else {
        const d = await resp.json();
        mostrarToast(d.detail || 'Erro ao excluir', 'erro');
      }
    } catch {
      mostrarToast('Erro ao excluir meta', 'erro');
    }
  };

  const handleCancelarEdicao = () => {
    setEditando(false);
    setEditandoMeta(null);
    setCategoria('');
    setLimiteMensal('');
  };

  if (carregando) return (
    <div className="app-section">
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
    <div className="app-section">
      <div className="section-heading page-heading"><div><h2>Metas por Categoria</h2><p>Defina limites mensais para cada categoria.</p></div><Icon name="metas" size={24} className="subtle" /></div>

        <div className="p-5 border-b border-atend-border">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Categoria {editando && <span className="text-atend-verde normal-case">(editando)</span>}
              </label>
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
            <div className="flex gap-2 w-full sm:w-auto">
              {editando && (
                <button type="button" onClick={handleCancelarEdicao}
                  className="bg-slate-800 hover:bg-slate-700 active:scale-[0.98] focus:outline-none text-slate-300 text-xs font-semibold px-4 py-2.5 rounded-lg transition-all duration-200 border border-slate-700 whitespace-nowrap">
                  Cancelar
                </button>
              )}
              <button type="submit" disabled={salvando}
                className="button-primary">
                <Icon name="check" size={16} />{salvando ? 'Salvando...' : editando ? 'Atualizar' : 'Salvar Meta'}
              </button>
            </div>
          </form>
          {erro && <div className="mt-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg p-3 text-center"><Icon name="alerta" size={18} className="inline-icon" /> {erro}</div>}
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
                    <div className="flex justify-center mb-2"><Icon name="metas" size={30} /></div>
                    <p className="text-sm font-medium text-slate-400">Nenhuma meta cadastrada</p>
                    <p className="text-xs text-slate-500 mt-0.5">Adicione uma meta usando o formulário acima</p>
                  </td>
                </tr>
              ) : (
                metas.map((meta) => (
                  <tr key={meta.id} onClick={() => setMetaAcao(meta)}
                    className="cursor-pointer hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                    <td className="px-5 py-4 font-medium text-white"><button type="button" className="link-button" onClick={e => { e.stopPropagation(); setMetaAcao(meta); }}>{meta.categoria}</button></td>
                    <td className="px-5 py-4 text-atend-verde font-semibold">
                      R$ {meta.limite_mensal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {metaAcao && (
          <Dialog aberto titulo={metaAcao.categoria} onFechar={() => setMetaAcao(null)}>
            <p className="subtle mb-5">Limite mensal: <strong>{metaAcao.limite_mensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={() => handleEditarClick(metaAcao)} className="button-secondary"><Icon name="editar" size={18} />Editar Meta</button>
              <button type="button" onClick={() => handleExcluirClick(metaAcao)} className="button-danger"><Icon name="excluir" size={18} />Excluir Meta</button>
              <button type="button" onClick={() => setMetaAcao(null)} className="button-secondary">Cancelar</button>
            </div>
          </Dialog>
        )}

        <ConfirmDialog
          aberto={confirmExcluir.aberto}
          titulo="Excluir Meta"
          mensagem={`Tem certeza que deseja excluir a meta "${confirmExcluir.categoria}"? Esta ação não pode ser desfeita.`}
          onConfirmar={handleExcluirConfirmar}
          onCancelar={() => setConfirmExcluir({ aberto: false, id: null, categoria: '' })}
        />
      </div>
    );
  }

export default MetasPage;
