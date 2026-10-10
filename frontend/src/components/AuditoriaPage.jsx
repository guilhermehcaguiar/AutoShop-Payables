import { useState, useEffect, useCallback } from 'react';
import { apiJson } from '../api.js';
import Icon from './Icon.jsx';
import { formatarDataHora } from '../boletosView.js';

export default function AuditoriaPage() {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [acao, setAcao] = useState('');
  const carregar = useCallback(async () => {
    setCarregando(true); setErro('');
    try { setLista(await apiJson('/auditoria/')); } catch (e) { setErro(e.message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);
  const encontrados = lista.filter(r => (!acao || r.acao === acao) && [r.detalhes, r.usuario_nome, r.entidade, r.entidade_id].join(' ').toLowerCase().includes(busca.trim().toLowerCase()));
  const icone = r => <span className="status-pill"><Icon name={{ criar: 'mais', editar: 'editar', pagar: 'check', excluir: 'excluir' }[r.acao] || 'historico'} size={14} />{r.acao}</span>;
  const detalhes = r => r.detalhes ? <details><summary>Ver detalhes</summary><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', paddingTop: 10 }}>{r.detalhes}</p></details> : '—';
  return <section className="app-section"><div className="section-heading"><div><h2>Histórico de ações</h2><p>Acompanhe alterações e responsáveis pelos registros.</p></div><button type="button" className="button-secondary" disabled={carregando} onClick={carregar}><Icon name="recorrente" size={16} />Atualizar</button></div><div className="filters"><div className="filter-row"><div className="search-field"><Icon name="busca" size={18} /><input type="search" aria-label="Buscar no histórico" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar usuário, conta ou detalhe" /></div><div className="field"><label htmlFor="historico-acao">Ação</label><select id="historico-acao" value={acao} onChange={e => setAcao(e.target.value)}><option value="">Todas</option>{[...new Set(lista.map(r => r.acao))].sort().map(a => <option key={a}>{a}</option>)}</select></div></div></div>
    {erro ? <div className="empty-state" role="alert"><p>{erro}</p><button type="button" className="button-secondary" onClick={carregar}>Tentar novamente</button></div> : carregando ? <div className="empty-state" role="status">Carregando histórico...</div> : !encontrados.length ? <div className="empty-state"><h3>{acao || busca ? 'Nenhuma ação encontrada' : 'Nenhuma ação registrada'}</h3>{(acao || busca) && <button type="button" className="button-secondary" onClick={() => { setAcao(''); setBusca(''); }}>Limpar filtros</button>}</div> : <><div className="desktop-table" style={{ overflowX: 'auto' }}><table className="list-table"><thead><tr><th>Data</th><th>Ação</th><th>Registro</th><th>Usuário</th><th>Detalhes</th></tr></thead><tbody>{encontrados.map(r => <tr key={r.id}><td>{formatarDataHora(r.criado_em)}</td><td>{icone(r)}</td><td>{r.entidade} #{r.entidade_id}</td><td>{r.usuario_nome || 'Sistema'}</td><td>{detalhes(r)}</td></tr>)}</tbody></table></div><div className="mobile-cards">{encontrados.map(r => <article className="boleto-card" key={r.id}><div className="actions-row">{icone(r)}<span className="subtle">{formatarDataHora(r.criado_em)}</span></div><p className="subtle">{r.entidade} #{r.entidade_id} · {r.usuario_nome || 'Sistema'}</p>{detalhes(r)}</article>)}</div></>}
  </section>;
}
