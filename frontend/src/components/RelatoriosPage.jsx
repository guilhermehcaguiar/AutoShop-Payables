import { useState, useEffect } from 'react';

function RelatoriosPage() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [mensal, setMensal] = useState(null);
  const [porFornecedor, setPorFornecedor] = useState([]);
  const [porCategoria, setPorCategoria] = useState([]);
  const [carregando, setCarregando] = useState(true);

  const fetchRelatorio = async () => {
    setCarregando(true);
    const token = localStorage.getItem('token');
    try {
      const [respM, respF, respC] = await Promise.all([
        fetch(`http://localhost:8000/relatorio/mensal?ano=${ano}&mes=${mes}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`http://localhost:8000/relatorio/fornecedores?ano=${ano}&mes=${mes}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`http://localhost:8000/relatorio/categorias?ano=${ano}&mes=${mes}`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (respM.ok) setMensal(await respM.json());
      if (respF.ok) setPorFornecedor(await respF.json());
      if (respC.ok) setPorCategoria(await respC.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => { fetchRelatorio(); }, [ano, mes]);

  const formatar = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const maxTotal = Math.max(...porFornecedor.map((f) => f.total), 1);

  const nomeMes = new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-white">Relatório {nomeMes} {ano}</h2>
        <select value={mes} onChange={(e) => setMes(Number(e.target.value))}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 ">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{new Date(ano, m - 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 ">
          {[agora.getFullYear(), agora.getFullYear() - 1].map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>
      </div>

      {carregando ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-500">
            <span className="inline-block w-5 h-5 border-2 border-atend-verde/30 border-t-atend-verde rounded-full animate-spin" />
            <span className="text-sm italic">Carregando relatório...</span>
          </div>
        ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-atend-verde/50 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pago</p>
              <p className="text-2xl font-extrabold text-white">{mensal ? formatar(mensal.total_pago) : 'R$ 0,00'}</p>
              <p className="text-xs text-slate-500 mt-1">{mensal?.total_boletos || 0} boletos no mês</p>
            </div>
            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pendente</p>
              <p className="text-2xl font-extrabold text-white">{mensal ? formatar(mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Geral</p>
              <p className="text-2xl font-extrabold text-white">{mensal ? formatar(mensal.total_pago + mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-4">📊 Por Fornecedor</h3>
              {porFornecedor.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nenhum dado no período.</p>
              ) : (
                <div className="space-y-3">
                  {porFornecedor.map((f, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium truncate">{f.fornecedor}</span>
                        <span className="text-white font-semibold">{formatar(f.total)}</span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-atend-verde to-emerald-400 transition-all duration-500"
                          style={{ width: `${(f.total / maxTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-4">🏷️ Por Categoria</h3>
              {porCategoria.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Nenhuma categoria no período.</p>
              ) : (
                <div className="space-y-3">
                  {porCategoria.map((c, i) => {
                    const maxCat = Math.max(...porCategoria.map((x) => x.total), 1);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-300 font-medium">{c.categoria}</span>
                          <span className="text-white font-semibold">{formatar(c.total)} ({c.quantidade}x)</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                            style={{ width: `${(c.total / maxCat) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RelatoriosPage;