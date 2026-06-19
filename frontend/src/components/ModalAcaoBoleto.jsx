import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';

function ModalAcaoBoleto({ aberto, boleto, onFechar, onEditar, onPagar, onDeletar, onDesfazerPagamento }) {
  const [usuarios, setUsuarios] = useState({});

  useEffect(() => {
    if (!aberto || !boleto || boleto.status !== 'Pago' || !boleto.pago_por) return;
    const token = localStorage.getItem('token');
    apiFetch('/admin/usuarios/', { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => r.ok && r.json())
      .then((lista) => {
        const mapa = {};
        (lista || []).forEach((u) => { mapa[u.id] = u.nome; });
        setUsuarios(mapa);
      })
      .catch(() => {});
  }, [aberto, boleto]);

  if (!aberto || !boleto) return null;

  const pago = boleto.status === 'Pago';
  const valorFormatado = boleto.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10 max-h-[85vh] overflow-y-auto animate-fade-in-scale">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
        <div className="flex justify-between items-center mb-6 mt-1">
          <h2 className="text-lg font-bold text-white">Detalhes do Boleto</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-white text-xl leading-none active:scale-[0.98] focus:outline-none transition-all duration-200">&times;</button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fornecedor</label>
            <p className="text-sm text-white">{boleto.fornecedor}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Valor</label>
            <p className="text-sm text-white">{valorFormatado}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Vencimento</label>
            <p className="text-sm text-white">{boleto.vencimento}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Categoria</label>
            <p className="text-sm text-white">{boleto.categoria || '-'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Código de Barras</label>
            <p className="text-sm text-white break-all">{boleto.codigo_barras || '-'}</p>
          </div>
          {pago && (
            <>
              <div className="flex items-center gap-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
                <span className="text-xs font-bold text-green-400 bg-green-400/10 px-2.5 py-0.5 rounded-full">Pago</span>
              </div>
              {boleto.data_pagamento && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Pago em</label>
                  <p className="text-sm text-white">
                    {new Date(boleto.data_pagamento + (boleto.data_pagamento.includes('T') ? 'Z' : 'T12:00:00Z')).toLocaleString('pt-BR')}
                    {boleto.pago_por && (
                      <span className="text-slate-400 ml-2">
                        por {usuarios[boleto.pago_por] || `Usuário #${boleto.pago_por}`}
                      </span>
                    )}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Método de Pagamento</label>
                <p className="text-sm text-white">{boleto.metodo_pagamento || '-'}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Banco</label>
                <p className="text-sm text-white">{boleto.banco || '-'}</p>
              </div>
            </>
          )}
          {(pago || boleto.descricao) && (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Descrição</label>
              <p className="text-sm text-white">{boleto.descricao || '-'}</p>
            </div>
          )}
        </div>
        <div className="flex gap-3 pt-6">
          {pago ? (
            <>
              <button onClick={() => onEditar(boleto)}
                className="flex-1 bg-sky-500/20 hover:bg-sky-500/30 active:scale-[0.98] focus:outline-none text-sky-400 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-sky-500/30">
                ✏️ Editar
              </button>
              <button onClick={() => onDesfazerPagamento(boleto.id)}
                className="flex-1 bg-amber-500/20 hover:bg-amber-500/30 active:scale-[0.98] focus:outline-none text-amber-400 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-amber-500/30">
                ↩ Desfazer
              </button>
            </>
          ) : (
            <>
              <button onClick={() => onEditar(boleto)}
                className="flex-1 bg-sky-500/20 hover:bg-sky-500/30 active:scale-[0.98] focus:outline-none text-sky-400 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-sky-500/30">
                ✏️ Editar
              </button>
              <button onClick={() => onPagar(boleto.id)}
                className="flex-1 bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all duration-200">
                ✔ Pagar
              </button>
              <button onClick={() => onDeletar(boleto.id)}
                className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 active:scale-[0.98] focus:outline-none text-rose-400 text-sm font-medium py-2.5 rounded-lg transition-all duration-200 border border-rose-500/30">
                🗑 Deletar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModalAcaoBoleto;
