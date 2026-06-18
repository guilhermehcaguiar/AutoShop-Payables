import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const CORES = ['#2ecc71', '#3498db', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#3498db', '#f39c12'];

function RelatoriosPage() {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [diaInicio, setDiaInicio] = useState('');
  const [diaFim, setDiaFim] = useState('');
  const [mensal, setMensal] = useState(null);
  const [porFornecedor, setPorFornecedor] = useState([]);
  const [porCategoria, setPorCategoria] = useState([]);
  const [projecao, setProjecao] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const fetchRelatorio = async () => {
    setCarregando(true);
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ ano, mes });
    if (diaInicio) params.set('dia_inicio', diaInicio);
    if (diaFim) params.set('dia_fim', diaFim);
    try {
      const [respM, respF, respC, respP] = await Promise.all([
        apiFetch(`/relatorio/mensal?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/relatorio/fornecedores?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/relatorio/categorias?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/boletos/projecao-fluxo?${params}`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (respM.ok) setMensal(await respM.json());
      if (respF.ok) setPorFornecedor(await respF.json());
      if (respC.ok) setPorCategoria(await respC.json());
      if (respP.ok) setProjecao(await respP.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => { fetchRelatorio(); }, [ano, mes, diaInicio, diaFim]);

  const formatar = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const maxTotal = Math.max(...porFornecedor.map((f) => f.total), 1);

  const nomeMes = new Date(ano, mes - 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase());

  const dias = Array.from({ length: 31 }, (_, i) => i + 1);

  const dadosGrafico = (() => {
    if (!projecao) return [];
    const chaves = Object.keys(projecao);
    const todasCategorias = [...new Set(chaves.flatMap((k) => projecao[k].map((c) => c.categoria)))];
    return chaves.map((label) => {
      const entry = { name: label };
      const catMap = {};
      (projecao[label] || []).forEach((c) => { catMap[c.categoria] = c.total; });
      todasCategorias.forEach((cat) => { entry[cat] = catMap[cat] || 0; });
      entry.total = Object.values(entry).reduce((s, v) => (typeof v === 'number' ? s + v : s), 0);
      return entry;
    });
  })();

  const categoriasGrafico = dadosGrafico.length > 0
    ? Object.keys(dadosGrafico[0]).filter((k) => k !== 'name' && k !== 'total')
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-bold text-white">Relatório {nomeMes} {ano}</h2>
        <select value={mes} onChange={(e) => { setMes(Number(e.target.value)); setDiaInicio(''); setDiaFim(''); }}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{new Date(ano, m - 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300">
          {[agora.getFullYear(), agora.getFullYear() - 1].map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>
        <select value={diaInicio} onChange={(e) => setDiaInicio(e.target.value)}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300">
          <option value="">De</option>
          {dias.map((d) => (<option key={d} value={d}>Dia {d}</option>))}
        </select>
        <select value={diaFim} onChange={(e) => setDiaFim(e.target.value)}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300">
          <option value="">Até</option>
          {dias.map((d) => (<option key={d} value={d}>Dia {d}</option>))}
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
            <div className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-atend-verde/50 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pago</p>
              <p className="text-2xl font-extrabold tracking-tight text-white group-hover:text-atend-verde group-active:text-atend-verde transition-colors">{mensal ? formatar(mensal.total_pago) : 'R$ 0,00'}</p>
              <p className="text-xs text-slate-500 mt-1">{mensal?.total_boletos || 0} boletos no mês</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pendente</p>
              <p className="text-2xl font-extrabold tracking-tight text-white group-hover:text-amber-400 group-active:text-amber-400 transition-colors">{mensal ? formatar(mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
            <div className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent" />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Geral</p>
              <p className="text-2xl font-extrabold tracking-tight text-white group-hover:text-sky-400 group-active:text-sky-400 transition-colors">{mensal ? formatar(mensal.total_pago + mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
          </div>

          {dadosGrafico.length > 0 && (
            <div className="rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-4">📊 Projeção de Fluxo (Previsto)</h3>
              <div className="w-full overflow-x-auto">
                <ResponsiveContainer width={Math.max(dadosGrafico.length * 120, 400)} height={320}>
                  <BarChart data={dadosGrafico} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                      formatter={(value) => formatar(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                    {categoriasGrafico.map((cat, i) => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={CORES[i % CORES.length]} radius={[0, 0, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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
