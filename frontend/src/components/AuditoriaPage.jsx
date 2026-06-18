import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { SkeletonTabela } from './Skeleton';

function AuditoriaPage() {
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const fetchAuditoria = async () => {
      const token = localStorage.getItem('token');
      try {
        const resp = await apiFetch('/auditoria/', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (resp.ok) setRegistros(await resp.json());
      } catch {} finally { setCarregando(false); }
    };
    fetchAuditoria();
  }, []);

  const icone = (acao) => {
    const mapa = { criar: '➕', editar: '✏️', pagar: '✅', excluir: '🗑' };
    return mapa[acao] || '📌';
  };

  const corAcao = (acao) => {
    const mapa = { criar: 'text-atend-verde', editar: 'text-amber-400', pagar: 'text-emerald-400', excluir: 'text-rose-400' };
    return mapa[acao] || 'text-slate-400';
  };

  if (carregando) return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border">
        <div className="h-5 bg-slate-700/50 rounded w-36 animate-pulse" />
        <div className="h-3 bg-slate-700/50 rounded w-52 mt-1 animate-pulse" />
      </div>
      <SkeletonTabela linhas={6} colunas={5} />
    </div>
  );

  return (
    <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-atend-border">
        <h3 className="text-lg font-bold text-white">Histórico de Ações</h3>
        <p className="text-xs text-slate-400">Registro de auditoria do sistema</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
              <th className="px-5 py-4">Data/Hora</th>
              <th className="px-5 py-4">Ação</th>
              <th className="px-5 py-4">Entidade</th>
              <th className="px-5 py-4">Usuário</th>
              <th className="px-5 py-4">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-atend-border/50 text-sm text-slate-300">
            {registros.length === 0 ? (
              <tr><td colSpan="5" className="px-5 py-10 text-center text-slate-500 italic">Nenhum registro de auditoria.</td></tr>
            ) : registros.map((r) => (
              <tr key={r.id} className="hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                <td className="px-5 py-4 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(r.criado_em + 'Z').toLocaleString('pt-BR')}
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center gap-1 font-semibold text-xs uppercase ${corAcao(r.acao)}`}>
                    {icone(r.acao)} {r.acao}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="text-xs font-medium text-white capitalize">{r.entidade}</span>
                  {r.entidade_id && <span className="text-xs text-slate-500 ml-1">#{r.entidade_id}</span>}
                </td>
                <td className="px-5 py-4 text-xs text-slate-400">{r.usuario_nome || 'Sistema'}</td>
                <td className="px-5 py-4 text-xs text-slate-400 max-w-[300px] truncate">{r.detalhes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AuditoriaPage;