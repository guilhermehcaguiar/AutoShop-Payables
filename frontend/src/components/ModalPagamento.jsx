import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';

function ModalPagamento({ aberto, boleto, onFechar, onConfirmado }) {
  const [metodoPagamento, setMetodoPagamento] = useState('');
  const [banco, setBanco] = useState('');
  const [bancos, setBancos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setMetodoPagamento('');
    setBanco('');
    setCopiado(false);
    const token = localStorage.getItem('token');
    apiFetch('/boletos/bancos-utilizados', { headers: { 'Authorization': `Bearer ${token}` } })
      .then((r) => r.ok && r.json()).then(setBancos).catch(() => {});
  }, [aberto]);

  const handleCopiar = async () => {
    try {
      await navigator.clipboard.writeText(boleto.codigo_barras || '');
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {}
  };

  const handleConfirmar = async () => {
    setSalvando(true);
    const token = localStorage.getItem('token');
    try {
      const resp = await apiFetch(`/boletos/${boleto.id}/pagar`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ metodo_pagamento: metodoPagamento, banco }),
      });
      if (resp.ok) {
        onConfirmado(boleto.id, metodoPagamento, banco);
        onFechar();
      }
    } catch {}
    setSalvando(false);
  };

  if (!aberto || !boleto) return null;

  const podeConfirmar = metodoPagamento.trim() && banco.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-black/60" onClick={onFechar} />
      <div className="relative w-full max-w-md bg-atend-card border border-atend-border rounded-2xl shadow-2xl p-6 z-10">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-atend-verde shadow-[0_0_15px_#2ecc71] rounded-t-2xl" />
        <div className="flex justify-between items-center mb-6 mt-1">
          <h2 className="text-lg font-bold text-white">Confirmar Pagamento</h2>
          <button onClick={onFechar} className="text-slate-500 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Fornecedor</label>
            <p className="text-sm text-white">{boleto.fornecedor}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Valor</label>
            <p className="text-lg font-bold text-atend-verde">R$ {Number(boleto.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Código de Barras</label>
            <div className="flex gap-2">
              <input type="text" value={boleto.codigo_barras || ''} readOnly
                className="flex-1 bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white font-mono focus:outline-none" />
              <button onClick={handleCopiar}
                className={`px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${copiado ? 'bg-atend-verde text-slate-950' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'}`}>
                {copiado ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Método de Pagamento</label>
            <select value={metodoPagamento} onChange={(e) => setMetodoPagamento(e.target.value)}
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-atend-verde/60 transition-colors">
              <option value="">Selecione...</option>
              <option value="Pix">Pix</option>
              <option value="Transferência">Transferência</option>
              <option value="Cartão">Cartão</option>
              <option value="Dinheiro">Dinheiro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Banco</label>
            <input type="text" value={banco} onChange={(e) => setBanco(e.target.value)}
              placeholder="Ex: Itaú, Bradesco"
              list="lista-bancos-pag"
              className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" />
            <datalist id="lista-bancos-pag">
              {bancos.map((b, i) => (<option key={i} value={b} />))}
            </datalist>
          </div>
        </div>

        <div className="flex gap-3 pt-6">
          <button onClick={onFechar}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium py-2.5 rounded-lg border border-slate-700">
            Cancelar
          </button>
          <button onClick={handleConfirmar} disabled={!podeConfirmar || salvando}
            className="flex-1 bg-atend-verde hover:opacity-90 disabled:opacity-50 text-slate-950 text-sm font-bold py-2.5 rounded-lg transition-all">
            {salvando ? 'Confirmando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalPagamento;
