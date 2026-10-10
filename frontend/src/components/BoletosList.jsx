import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatarData, moeda, selecionaveis } from '../boletosView.js';

export function StatusBoleto({ boleto, hoje }) {
  const tipo = boleto.status === 'Pago' ? 'pago' : boleto.vencimento < hoje ? 'vencido' : boleto.vencimento === hoje ? 'hoje' : 'pendente';
  const texto = { pago: 'Pago', vencido: 'Vencido', hoje: 'Vence hoje', pendente: 'Pendente' }[tipo];
  return <span className={`status-pill status-${tipo}`}><Icon name={tipo === 'pago' ? 'check' : tipo === 'vencido' ? 'alerta' : 'calendario'} size={12} />{texto}</span>;
}

export default function BoletosList({ itens, filtros, onFiltros, meses, fornecedores, selecionados, onSelecionar, onSelecionarPagina, onAbrir, onNovo, onCSV, carregando, erro, onTentar, pg, onPagina, totalItens, totalValor, hoje }) {
  const checkbox = useRef(null);
  const [extras, setExtras] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaInput = useRef(null);
  const buscaBotao = useRef(null);
  useEffect(() => { if (buscaAberta) buscaInput.current?.focus(); }, [buscaAberta]);
  const pendentes = selecionaveis(itens);
  const todos = pendentes.length > 0 && pendentes.every(b => selecionados.has(b.id));
  const alguns = pendentes.some(b => selecionados.has(b.id));
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = alguns && !todos; }, [alguns, todos]);
  const tabs = [{ id: 'todos', nome: 'Todos' }, { id: 'pendentes', nome: 'Pendentes' }, { id: 'pagos', nome: 'Pagos' }, { id: 'vencidos', nome: 'Vencidos' }, { id: 'vencendo', nome: 'Hoje' }, { id: 'proximos', nome: 'Próximos 7 dias' }];
  const ativo = filtros.busca || filtros.fornecedor || filtros.dia || filtros.inicio || filtros.fim || filtros.status !== 'todos';
  const limite = Math.max(1, Math.ceil(totalItens / 25));
  const selecionar = b => <input type="checkbox" aria-label={`Selecionar ${b.fornecedor}, ${moeda(b.valor)}`} checked={selecionados.has(b.id)} onChange={() => onSelecionar(b.id)} disabled={b.status === 'Pago' || carregando || !!erro} />;
  const vazio = <div className="empty-state"><Icon name="busca" size={30} /><h3>{ativo ? 'Nenhum resultado para estes filtros' : 'Nenhuma conta neste período'}</h3><p>{ativo ? 'Tente outro termo ou limpe os filtros para ampliar a busca.' : 'Cadastre um boleto recebido ou uma conta prevista para organizar o financeiro.'}</p><button type="button" className="button-secondary" onClick={ativo ? () => onFiltros({ limpar: true }) : onNovo}>{ativo ? 'Limpar filtros' : 'Cadastrar primeira conta'}</button></div>;
  return <section className="app-section" aria-label="Contas a pagar">
    <div className="section-heading"><div><h2>Contas a pagar</h2><p>Confira os vencimentos e registre os pagamentos.</p></div><div className="actions-row"><button type="button" className="button-secondary" onClick={onCSV}><Icon name="download" size={16} />CSV</button><button type="button" className="button-primary" onClick={onNovo}><Icon name="mais" size={16} />Novo Boleto</button></div></div>
    <div className="filters"><div className="filter-tabs">{tabs.map(t => <button type="button" key={t.id} className="filter-tab" aria-pressed={filtros.status === t.id} onClick={() => onFiltros({ status: t.id, ...(['vencidos', 'vencendo', 'proximos'].includes(t.id) ? { inicio: '', fim: '', dia: '' } : {}) })}>{t.nome}</button>)}</div>
      <div className="filter-row">
        <div className="field"><label htmlFor="filtro-mes">Mês</label><select id="filtro-mes" value={filtros.mes} disabled={['vencidos', 'vencendo', 'proximos'].includes(filtros.status) || !!(filtros.inicio || filtros.fim)} onChange={e => onFiltros({ mes: e.target.value })}>{meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select></div>
        <div className="field"><label htmlFor="filtro-dia">Dia do vencimento</label><input id="filtro-dia" type="date" value={filtros.inicio && filtros.inicio === filtros.fim ? filtros.inicio : ''} onChange={e => onFiltros({ inicio: e.target.value, fim: e.target.value, dia: '', ...(e.target.value ? { mes: e.target.value.slice(0, 7) } : {}), status: ['vencidos', 'vencendo', 'proximos'].includes(filtros.status) ? 'todos' : filtros.status })} /></div>
        <div className="field"><label htmlFor="filtro-fornecedor">Fornecedor</label><select id="filtro-fornecedor" value={filtros.fornecedor} onChange={e => onFiltros({ fornecedor: e.target.value })}><option value="">Todos</option>{fornecedores.map(f => <option key={f}>{f}</option>)}</select></div>
        <button ref={buscaBotao} type="button" className={`button-secondary search-toggle ${filtros.busca ? 'is-active' : ''}`} aria-label={buscaAberta ? 'Fechar pesquisa de boletos' : 'Pesquisar boletos'} title="Pesquisar boletos" aria-expanded={buscaAberta} aria-controls="pesquisa-boletos" onClick={() => setBuscaAberta(v => !v)}><Icon name="busca" size={20} /></button>
        <button type="button" className="button-secondary" onClick={() => setExtras(v => !v)} aria-expanded={extras}>Mais filtros</button>
      </div>
      <div id="pesquisa-boletos" hidden={!buscaAberta} className="boleto-search-panel">
        {buscaAberta && <div className="search-field"><Icon name="busca" size={18} /><input ref={buscaInput} type="search" aria-label="Buscar contas por fornecedor, descrição ou código" placeholder="Buscar fornecedor, descrição ou código" value={filtros.busca} onChange={e => onFiltros({ busca: e.target.value })} onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setBuscaAberta(false); buscaBotao.current?.focus(); } }} /></div>}
      </div>
      {extras && <div className="filter-row" style={{ marginTop: 14 }}>
        <div className="field"><label htmlFor="filtro-inicio">De</label><input id="filtro-inicio" type="date" value={filtros.inicio} max={filtros.fim || undefined} onChange={e => onFiltros({ inicio: e.target.value })} /></div>
        <div className="field"><label htmlFor="filtro-fim">Até</label><input id="filtro-fim" type="date" value={filtros.fim} min={filtros.inicio || undefined} onChange={e => onFiltros({ fim: e.target.value })} /></div>
        <label className="field-hint"><input type="checkbox" checked={extras && extras === 'colunas'} onChange={e => setExtras(e.target.checked ? 'colunas' : true)} /> Mostrar banco e método</label>
      </div>}
      <div className="filter-context"><span>{totalItens} {totalItens === 1 ? 'conta encontrada' : 'contas encontradas'}{['vencidos', 'vencendo', 'proximos'].includes(filtros.status) && ' · Todos os meses'}{filtros.busca && ` · Busca: ${filtros.busca}`}{filtros.fornecedor && ` · ${filtros.fornecedor}`}{filtros.inicio && filtros.inicio === filtros.fim && ` · Vencimento: ${formatarData(filtros.inicio)}`}</span>{ativo && <button type="button" className="link-button" onClick={() => onFiltros({ limpar: true })}>Limpar filtros</button>}</div>
      {!carregando && !erro && pendentes.length > 0 && <label className="field-hint field-inline" style={{ marginTop: 14 }}><input ref={checkbox} style={{ width: 18, flex: 'none' }} type="checkbox" checked={todos} aria-label="Selecionar pendentes desta página" onChange={() => onSelecionarPagina(itens)} />Selecionar pendentes desta página ({pendentes.length})</label>}
    </div>
    {erro ? <div className="empty-state" role="alert"><Icon name="alerta" size={28} /><h3>Não foi possível carregar as contas</h3><p>{erro}</p><button type="button" className="button-secondary" onClick={onTentar}>Tentar novamente</button></div> : carregando ? <div className="empty-state" role="status">Carregando contas...</div> : !itens.length ? vazio : <>
      <div className="desktop-table" style={{ overflowX: 'auto' }}><table className="list-table"><thead><tr><th aria-label="Seleção" /><th>Fornecedor / descrição</th><th className="number">Valor</th><th>Vencimento</th><th>Status</th><th>Categoria</th>{extras === 'colunas' && <><th>Banco</th><th>Método</th></>}<th aria-label="Detalhes" /></tr></thead><tbody>{itens.map(b => <tr key={b.id}><td>{selecionar(b)}</td><td><button type="button" className="link-button" onClick={() => onAbrir(b)}>{b.fornecedor}</button>{b.descricao && <p className="row-description" title={b.descricao}>{b.descricao}</p>}{!b.codigo_barras && <p className="row-description">{b.status === 'Pago' ? 'Sem código de barras' : 'Previsão · sem código de barras'}</p>}</td><td className="number">{moeda(b.valor)}</td><td>{formatarData(b.vencimento)}</td><td><StatusBoleto boleto={b} hoje={hoje} /></td><td className="subtle">{b.categoria || '—'}</td>{extras === 'colunas' && <><td>{b.banco || '—'}</td><td>{b.metodo_pagamento || '—'}</td></>}<td><button type="button" className="icon-button" aria-label={`Ver detalhes de ${b.fornecedor}`} onClick={() => onAbrir(b)}><Icon name="seta" size={17} /></button></td></tr>)}</tbody></table></div>
      <div className="mobile-cards">{itens.map(b => <article className="boleto-card" key={b.id}><div className="boleto-card-heading">{selecionar(b)}<button type="button" className="link-button" onClick={() => onAbrir(b)}>{b.fornecedor}</button><StatusBoleto boleto={b} hoje={hoje} /></div>{b.descricao && <p className="row-description">{b.descricao}</p>}{!b.codigo_barras && <p className="row-description">{b.status === 'Pago' ? 'Sem código de barras' : 'Previsão · sem código de barras'}</p>}<div className="boleto-card-meta"><span>{formatarData(b.vencimento)}<br />{b.categoria || 'Sem categoria'}</span><strong>{moeda(b.valor)}</strong></div></article>)}</div>
    </>}
    <div className="list-footer"><span>Total dos resultados: <strong>{moeda(totalValor)}</strong></span><div className="pagination"><button type="button" className="icon-button" aria-label="Página anterior" disabled={pg <= 1} onClick={() => onPagina(pg - 1)}>‹</button><span>{pg} de {limite}</span><button type="button" className="icon-button" aria-label="Próxima página" disabled={pg >= limite} onClick={() => onPagina(pg + 1)}>›</button></div></div>
  </section>;
}
