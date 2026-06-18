import { useState, useEffect } from 'react';
import { apiFetch } from '../api.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { SkeletonResumo, SkeletonGrafico } from './Skeleton';
import { jsPDF } from 'jspdf';

const CORES = ['#2ecc71', '#3498db', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#e67e22', '#2ecc71', '#3498db', '#f39c12'];

function RelatoriosPage({ mostrarToast }) {
  const agora = new Date();
  const [ano, setAno] = useState(agora.getFullYear());
  const [mes, setMes] = useState(agora.getMonth() + 1);
  const [diaInicio, setDiaInicio] = useState('');
  const [diaFim, setDiaFim] = useState('');
  const [mensal, setMensal] = useState(null);
  const [porFornecedor, setPorFornecedor] = useState([]);
  const [porCategoria, setPorCategoria] = useState([]);
  const [projecao, setProjecao] = useState(null);
  const [filtroStatusRel, setFiltroStatusRel] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [evolucao, setEvolucao] = useState([]);
  const [secaoAberta, setSecaoAberta] = useState(null);
  const [exportando, setExportando] = useState(false);

  const fetchRelatorio = async () => {
    setCarregando(true);
    const token = localStorage.getItem('token');
    const paramsBase = new URLSearchParams({ ano, mes });
    if (diaInicio) paramsBase.set('dia_inicio', diaInicio);
    if (diaFim) paramsBase.set('dia_fim', diaFim);
    const paramsF = new URLSearchParams(paramsBase);
    const paramsC = new URLSearchParams(paramsBase);
    if (filtroStatusRel) {
      paramsF.set('status', filtroStatusRel);
      paramsC.set('status', filtroStatusRel);
    }
    try {
      const [respM, respF, respC, respP, respE] = await Promise.all([
        apiFetch(`/relatorio/mensal?${paramsBase}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/relatorio/fornecedores?${paramsF}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/relatorio/categorias?${paramsC}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/boletos/projecao-fluxo?${paramsBase}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        apiFetch(`/boletos/evolucao-mensal`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (respM.ok) setMensal(await respM.json());
      if (respF.ok) setPorFornecedor(await respF.json());
      if (respC.ok) setPorCategoria(await respC.json());
      if (respP.ok) setProjecao(await respP.json());
      if (respE.ok) setEvolucao(await respE.json());
    } catch {} finally { setCarregando(false); }
  };

  useEffect(() => { fetchRelatorio(); }, [ano, mes, diaInicio, diaFim, filtroStatusRel]);

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

  const AccordionSection = ({ indice, icone, titulo, descricao, children }) => (
    <div className="border-b border-atend-border last:border-b-0">
      <button onClick={() => setSecaoAberta(secaoAberta === indice ? null : indice)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-900/20 transition-all duration-200 active:scale-[0.98] focus:outline-none">
        <div className="flex items-center gap-3">
          <span className="text-lg">{icone}</span>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">{titulo}</h3>
            <p className="text-xs text-slate-400">{descricao}</p>
          </div>
        </div>
        <span className={`text-slate-500 transition-all duration-300 ease-in-out ${secaoAberta === indice ? 'rotate-180 text-atend-verde' : ''}`}>▼</span>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${secaoAberta === indice ? 'max-h-[5000px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-5 pb-4">
          {children}
        </div>
      </div>
    </div>
  );

  const exportarPDF = async () => {
    setExportando(true);
    try {
      const [respM, respC] = await Promise.all([
        apiFetch(`/relatorio/mensal?ano=${ano}&mes=${mes}`),
        apiFetch(`/relatorio/categorias?ano=${ano}&mes=${mes}`),
      ]);
      if (!respM.ok) { mostrarToast?.('Erro ao carregar dados', 'erro'); setExportando(false); return; }

      const m = await respM.json();
      const cats = respC.ok ? await respC.json() : [];

      let doc;
      try {
        doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      } catch (e) {
        mostrarToast?.('Erro ao criar PDF: ' + e.message, 'erro');
        setExportando(false);
        return;
      }

      const pw = doc.internal.pageSize.getWidth();
      const ph = doc.internal.pageSize.getHeight();
      const ml = 14, mr = 14, cw = pw - ml - mr;
      const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
      const BG = '#0f1117', CARD = '#1a1d27', BORDER = '#2a2d3a', GREEN = '#2ecc71';
      let y = 0;

      try {
        const pageBg = () => {
          doc.setFillColor(15, 17, 23);
          doc.rect(0, 0, pw, ph, 'F');
        };
        const card = (x, w, h, yp) => {
          doc.setFillColor(26, 29, 39);
          doc.setDrawColor(42, 45, 58);
          doc.setLineWidth(0.3);
          doc.roundedRect(x, yp, w, h, 2, 2, 'FD');
        };
        const sectionTitle = (text, yp) => {
          doc.setFillColor(46, 204, 113);
          doc.rect(ml, yp, 3, 10, 'F');
          doc.setTextColor(46, 204, 113);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text(text.toUpperCase(), ml + 7, yp + 7);
        };

        pageBg();

        y = 15;
        card(ml, cw, 80, y);

        const centerX = pw / 2;
        const titleY = y + 16;
        const sonicSize = 22;

        const fullTitle = 'ATEND-CAR';
        await document.fonts.ready;
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size;
        canvas.height = Math.round(size * 0.35);
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const sonicPx = 72;
        ctx.font = `${sonicPx}px 'Sonic Extra Bold', 'Segoe UI', sans-serif`;
        const metrics = ctx.measureText(fullTitle);
        const imgW = metrics.width;
        const imgH = sonicPx * 1.2;
        canvas.width = Math.ceil(imgW + 20);
        canvas.height = Math.ceil(imgH + 10);
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = `${sonicPx}px 'Sonic Extra Bold', 'Segoe UI', sans-serif`;
        ctx.strokeStyle = '#0f1117';
        ctx.lineWidth = sonicPx * 0.08;
        ctx.lineJoin = 'round';
        ctx.strokeText(fullTitle, cx, cy);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(fullTitle, cx, cy);
        const imgData = canvas.toDataURL('image/png');
        const pdfImgH = 14;
        const pdfImgW = (canvas.width / canvas.height) * pdfImgH;
        const titleX = centerX - pdfImgW / 2;
        doc.addImage(imgData, 'PNG', titleX, titleY - pdfImgH / 2, pdfImgW, pdfImgH);

        doc.setFont('helvetica', 'normal');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text('SISTEMA DE GERENCIAMENTO FINANCEIRO', centerX, titleY + 9, { align: 'center' });

        doc.setDrawColor(46, 204, 113);
        doc.setLineWidth(0.5);
        doc.line(ml + 5, titleY + 14, ml + cw - 5, titleY + 14);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(46, 204, 113);
        doc.text(`DRE - ${nomeMes.toUpperCase()} ${ano}`, centerX, titleY + 22, { align: 'center' });

        y = titleY + 26;
        const periodoStr = `${nomeMes} ${ano}`;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const dataEmissao = new Date().toLocaleDateString('pt-BR');
        doc.text(`Período: ${periodoStr}`, ml + cw, y, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        doc.text(`Emissão: ${dataEmissao}`, ml, y);
        y += 3;

        y += 3;
        sectionTitle('Demonstrativo do Resultado', y);
        y += 15;

        card(ml, cw, 45, y);
        const ty = y + 3;

        const headerLabels = ['Descrição', 'Valor'];
        const headerWs = [cw * 0.7, cw * 0.3];
        doc.setFillColor(46, 204, 113);
        doc.rect(ml + 4, ty, cw - 8, 6, 'F');
        doc.setTextColor(10, 10, 10);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        let hx = ml + 6;
        headerLabels.forEach((l, i) => {
          doc.text(l, hx + (i === 1 ? headerWs[i] - 2 : 0), ty + 4, i === 1 ? { align: 'right' } : undefined);
          if (i === 0) hx += headerWs[i];
        });

        let ry = ty + 6;
        const dreRows = [
          ['Receita Líquida (Total Geral)', fmt(m.total_pago + m.total_pendente), true, true],
          ['  Total Pago', fmt(m.total_pago), false, false],
          ['  Total Pendente', fmt(m.total_pendente), true, false],
        ];
        dreRows.forEach(([label, value, isAlt, isBold]) => {
          doc.setFillColor(isAlt ? 26 : 22, isAlt ? 29 : 26, isAlt ? 39 : 36);
          doc.rect(ml + 4, ry, cw - 8, 6, 'F');
          doc.setTextColor(isBold ? 255 : 200, isBold ? 255 : 200, isBold ? 180 : 180);
          doc.setFontSize(6);
          doc.setFont('helvetica', isBold ? 'bold' : 'normal');
          doc.text(label, ml + 6, ry + 4);
          doc.text(value, ml + cw - 6, ry + 4, { align: 'right' });
          ry += 6;
        });

        doc.setDrawColor(46, 204, 113);
        doc.setLineWidth(0.3);
        doc.line(ml + 4, ry, ml + cw - 4, ry);
        ry += 2;

        doc.setFillColor(26, 29, 39);
        doc.rect(ml + 4, ry, cw - 8, 6, 'F');
        doc.setTextColor(46, 204, 113);
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.text('Boletos no Mês', ml + 6, ry + 4);
        doc.text(String(m.total_boletos || 0), ml + cw - 6, ry + 4, { align: 'right' });
        ry += 8;

        y = ry + 3;

        if (Array.isArray(cats) && cats.length > 0) {
          sectionTitle('Distribuição por Categoria', y);
          y += 15;

          const catRows = Math.ceil(cats.length);
          const catH = catRows * 6 + 12;
          card(ml, cw, catH, y);

          const ct = y + 3;
          doc.setFillColor(46, 204, 113);
          doc.rect(ml + 4, ct, cw - 8, 6, 'F');
          doc.setTextColor(10, 10, 10);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          const catHeaders = ['Categoria', 'Valor', 'Qtd'];
          const catWs = [cw * 0.55, cw * 0.3, cw * 0.15];
          let chx = ml + 6;
          catHeaders.forEach((l, i) => {
            const isLast = i === catHeaders.length - 1;
            doc.text(l, isLast ? chx + catWs[i] - 2 : chx, ct + 4, isLast ? { align: 'right' } : undefined);
            chx += catWs[i];
          });

          let cry = ct + 6;
          cats.forEach((c, i) => {
            doc.setFillColor(i % 2 === 0 ? 26 : 22, i % 2 === 0 ? 29 : 26, i % 2 === 0 ? 39 : 36);
            doc.rect(ml + 4, cry, cw - 8, 6, 'F');
            doc.setTextColor(200, 200, 180);
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            let cx2 = ml + 6;
            const vals = [c.categoria, fmt(c.total), String(c.quantidade)];
            vals.forEach((val, j) => {
              const isLast = j === vals.length - 1;
              doc.text(val, isLast ? cx2 + catWs[j] - 2 : cx2, cry + 4, isLast ? { align: 'right' } : undefined);
              cx2 += catWs[j];
            });
            cry += 6;
          });
          y = cry + 8;
        }

        y += 5;
        doc.setDrawColor(42, 45, 58);
        doc.setLineWidth(0.3);
        doc.line(ml, y, ml + cw, y);
        y += 3;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(100, 116, 139);
        doc.text('AutoShop Payables © 2026 — Todos os direitos reservados.', centerX, y, { align: 'center' });

        doc.save(`DRE-${nomeMes}-${ano}.pdf`);
        mostrarToast?.('PDF exportado com sucesso!');
      } catch (e) {
        mostrarToast?.('Erro ao gerar PDF: ' + e.message, 'erro');
      }
    } catch (err) {
      mostrarToast?.('Erro de conexão: ' + (err.message || 'erro'), 'erro');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="text-xl font-bold text-white">Relatório {nomeMes} {ano}</h2>
        <select value={mes} onChange={(e) => { setMes(Number(e.target.value)); setDiaInicio(''); setDiaFim(''); }}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-all duration-200">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{new Date(ano, m - 1).toLocaleDateString('pt-BR', { month: 'long' }).replace(/^\w/, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-all duration-200">
          {[agora.getFullYear(), agora.getFullYear() - 1].map((a) => (<option key={a} value={a}>{a}</option>))}
        </select>
        <select value={diaInicio} onChange={(e) => setDiaInicio(e.target.value)}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-all duration-200">
          <option value="">De</option>
          {dias.map((d) => (<option key={d} value={d}>Dia {d}</option>))}
        </select>
        <select value={diaFim} onChange={(e) => setDiaFim(e.target.value)}
          className="bg-atend-bg border border-atend-border rounded-lg px-3 py-1.5 text-xs text-slate-300 transition-all duration-200">
          <option value="">Até</option>
          {dias.map((d) => (<option key={d} value={d}>Dia {d}</option>))}
        </select>
      </div>

      {carregando ? (
        <div className="space-y-6">
          <SkeletonResumo cards={3} />
          <SkeletonGrafico />
          <SkeletonGrafico />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonGrafico />
            <SkeletonGrafico />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div onClick={() => setFiltroStatusRel(filtroStatusRel === 'Pago' ? '' : 'Pago')}
              className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-atend-verde/50 to-transparent ${filtroStatusRel === 'Pago' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pago</p>
              <p className={`text-2xl font-extrabold tracking-tight ${filtroStatusRel === 'Pago' ? 'text-atend-verde' : 'text-white group-hover:text-atend-verde group-active:text-atend-verde'} transition-colors`}>{mensal ? formatar(mensal.total_pago) : 'R$ 0,00'}</p>
              <p className="text-xs text-slate-500 mt-1">{mensal?.total_boletos || 0} boletos no mês</p>
            </div>
            <div onClick={() => setFiltroStatusRel(filtroStatusRel === 'Pendente' ? '' : 'Pendente')}
              className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent ${filtroStatusRel === 'Pendente' ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Pendente</p>
              <p className={`text-2xl font-extrabold tracking-tight ${filtroStatusRel === 'Pendente' ? 'text-amber-400' : 'text-white group-hover:text-amber-400 group-active:text-amber-400'} transition-colors`}>{mensal ? formatar(mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
            <div onClick={() => setFiltroStatusRel('')}
              className="group relative overflow-hidden rounded-xl border border-atend-border bg-atend-card p-5 shadow-2xl hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer">
              <div className={`absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-sky-500/40 to-transparent ${!filtroStatusRel ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`} />
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">Total Geral</p>
              <p className={`text-2xl font-extrabold tracking-tight ${!filtroStatusRel ? 'text-sky-400' : 'text-white group-hover:text-sky-400 group-active:text-sky-400'} transition-colors`}>{mensal ? formatar(mensal.total_pago + mensal.total_pendente) : 'R$ 0,00'}</p>
            </div>
          </div>

          <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
            <AccordionSection indice={1} icone="📊" titulo="Projeção de Fluxo (Previsto)" descricao="Gráfico de barras com fluxo de caixa projetado">
              {dadosGrafico.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width={Math.max(dadosGrafico.length * 120, 400)} height={320}>
                    <BarChart data={dadosGrafico} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--c-tooltip-bg, #1e293b)', border: '1px solid var(--c-tooltip-border, #334155)', borderRadius: 8, color: 'var(--c-tooltip-color, #f1f5f9)', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                        formatter={(value) => formatar(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      {categoriasGrafico.map((cat, i) => (
                        <Bar key={cat} dataKey={cat} stackId="a" fill={CORES[i % CORES.length]} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">Nenhum dado disponível para projeção.</p>
              )}
            </AccordionSection>

            <AccordionSection indice={2} icone="📈" titulo="Evolução Mensal (12 meses)" descricao="Comparativo de pagos vs pendentes ao longo do ano">
              {evolucao.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart data={evolucao} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => { const [a, m] = v.split('-'); return `${m}/${a.slice(2)}`; }} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ background: 'var(--c-tooltip-bg, #1e293b)', border: '1px solid var(--c-tooltip-border, #334155)', borderRadius: 8, color: 'var(--c-tooltip-color, #f1f5f9)', fontSize: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                        formatter={(value) => formatar(value)}
                        labelFormatter={(label) => { const [a, m] = label.split('-'); return `${m}/${a}`; }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                      <Line type="monotone" dataKey="pago" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} name="Pago" />
                      <Line type="monotone" dataKey="pendente" stroke="#f59e0b" strokeWidth={2} dot={{ fill: '#f59e0b', r: 4 }} name="Pendente" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic py-2">Nenhum dado de evolução disponível.</p>
              )}
            </AccordionSection>

            <AccordionSection indice={3} icone="📊" titulo="Por Fornecedor / Categoria" descricao="Distribuição de gastos por fornecedor e categoria">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">📊 Por Fornecedor</h4>
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

                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">🏷️ Por Categoria</h4>
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
            </AccordionSection>

            <AccordionSection indice={4} icone="📋" titulo="Demonstrativo do Resultado (DRE)" descricao="Resumo financeiro do período">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-400">Receitas e despesas do período</p>
                <button onClick={exportarPDF} disabled={exportando}
                  className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-slate-950 text-xs font-bold px-4 py-2 rounded-lg transition-all duration-200">
                  {exportando ? 'Exportando...' : 'Exportar PDF'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3">Conta</th>
                      <th className="px-4 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-atend-border/50 text-sm">
                    <tr className="bg-slate-900/10">
                      <td className="px-4 py-3 font-semibold text-white">Receita Líquida (Total Geral)</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">
                        {mensal ? formatar(mensal.total_pago + mensal.total_pendente) : 'R$ 0,00'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-8 text-slate-300">Total Pago</td>
                      <td className="px-4 py-3 text-right text-atend-verde font-medium">
                        {mensal ? formatar(mensal.total_pago) : 'R$ 0,00'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 pl-8 text-slate-300">Total Pendente</td>
                      <td className="px-4 py-3 text-right text-amber-400 font-medium">
                        {mensal ? formatar(mensal.total_pendente) : 'R$ 0,00'}
                      </td>
                    </tr>
                    <tr className="border-t-2 border-atend-border/80">
                      <td className="px-4 py-3 font-semibold text-white">Boletos no Mês</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{mensal?.total_boletos || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {porCategoria.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Por Categoria</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-atend-border bg-slate-900/30 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <th className="px-4 py-2">Categoria</th>
                          <th className="px-4 py-2 text-right">Valor</th>
                          <th className="px-4 py-2 text-right">Qtd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-atend-border/50 text-sm">
                        {porCategoria.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-900/20 transition-all duration-150 active:scale-[0.99]">
                            <td className="px-4 py-2 text-slate-300">{c.categoria}</td>
                            <td className="px-4 py-2 text-right text-white font-medium">{formatar(c.total)}</td>
                            <td className="px-4 py-2 text-right text-slate-400">{c.quantidade}x</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </AccordionSection>
          </div>
        </>
      )}
    </div>
  );
}

export default RelatoriosPage;
