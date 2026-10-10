import { useState, useEffect, useCallback, useRef } from 'react';
import { apiJson } from '../api.js';
import Dialog from './Dialog.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Icon from './Icon.jsx';
const vazio = { nome: '', cnpj: '', telefone: '', email: '' };

export default function FornecedoresPage({ mostrarToast }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroLista, setErroLista] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(vazio);
  const [erro, setErro] = useState('');
  const [excluirId, setExcluirId] = useState(null);
  const [erroExcluir, setErroExcluir] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const lock = useRef(false);
  const dialog = useRef(null);
  const carregar = useCallback(async () => {
    setCarregando(true); setErroLista('');
    try { setLista(await apiJson('/fornecedores/')); } catch (e) { setErroLista(e.message); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { const t = setTimeout(carregar, 0); return () => clearTimeout(t); }, [carregar]);
  const abrir = fornecedor => { setEditando(fornecedor || {}); setForm(fornecedor ? Object.fromEntries(Object.keys(vazio).map(k => [k, fornecedor[k] || ''])) : vazio); setErro(''); };
  const salvar = async e => {
    e.preventDefault(); if (lock.current) return;
    if (!form.nome.trim()) { setErro('Informe o nome do fornecedor.'); return; }
    const digitos = form.cnpj.replace(/\D/g, '');
    if (form.cnpj && digitos.length !== 14) { setErro('O CNPJ deve ter 14 dígitos.'); return; }
    lock.current = true; setOcupado(true); setErro('');
    try {
      await apiJson(editando.id ? `/fornecedores/${editando.id}` : '/fornecedores/', { method: editando.id ? 'PUT' : 'POST', body: JSON.stringify({ ...form, nome: form.nome.trim() }) });
      setEditando(null); mostrarToast('Fornecedor salvo.'); await carregar();
    } catch (e) { setErro(e.message); }
    finally { lock.current = false; setOcupado(false); }
  };
  const excluir = async () => {
    if (lock.current) return; lock.current = true; setOcupado(true); setErroExcluir('');
    try { await apiJson(`/fornecedores/${excluirId}`, { method: 'DELETE' }); setExcluirId(null); mostrarToast('Fornecedor excluído.'); await carregar(); }
    catch (e) { setErroExcluir(e.message); }
    finally { lock.current = false; setOcupado(false); }
  };
  const encontrados = lista.filter(f => [f.nome, f.cnpj, f.telefone, f.email].join(' ').toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR').trim()));
  const acoes = f => <div className="actions-row"><button type="button" className="icon-button" aria-label={`Editar ${f.nome}`} onClick={() => abrir(f)}><Icon name="editar" size={17} /></button><button type="button" className="icon-button" aria-label={`Excluir ${f.nome}`} onClick={() => { setErroExcluir(''); setExcluirId(f.id); }}><Icon name="excluir" size={17} /></button></div>;
  const inicial = editando?.id ? Object.fromEntries(Object.keys(vazio).map(k => [k, editando[k] || ''])) : vazio;
  return <section className="app-section"><div className="section-heading"><div><h2>Fornecedores</h2><p>Contatos para facilitar o acompanhamento das contas.</p></div><button type="button" className="button-primary" onClick={() => abrir()}><Icon name="mais" size={16} />Novo fornecedor</button></div><div className="filters"><div className="search-field"><Icon name="busca" size={18} /><input type="search" aria-label="Buscar fornecedores" placeholder="Buscar nome, CNPJ ou contato" value={busca} onChange={e => setBusca(e.target.value)} /></div></div>
    {erroLista ? <div className="empty-state" role="alert"><p>{erroLista}</p><button type="button" className="button-secondary" onClick={carregar}>Tentar novamente</button></div> : carregando ? <div className="empty-state" role="status">Carregando fornecedores...</div> : !encontrados.length ? <div className="empty-state"><h3>{busca ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}</h3><p>{busca ? 'Tente outro nome ou limpe a busca.' : 'Cadastre os contatos dos fornecedores da oficina.'}</p><button type="button" className="button-secondary" onClick={busca ? () => setBusca('') : () => abrir()}>{busca ? 'Limpar busca' : 'Cadastrar fornecedor'}</button></div> : <><div className="desktop-table" style={{ overflowX: 'auto' }}><table className="list-table"><thead><tr><th>Nome</th><th>CNPJ</th><th>Telefone</th><th>E-mail</th><th>Ações</th></tr></thead><tbody>{encontrados.map(f => <tr key={f.id}><td>{f.nome}</td><td>{f.cnpj || '—'}</td><td>{f.telefone || '—'}</td><td>{f.email || '—'}</td><td>{acoes(f)}</td></tr>)}</tbody></table></div><div className="mobile-cards">{encontrados.map(f => <article className="boleto-card" key={f.id}><strong>{f.nome}</strong><p className="subtle">{f.cnpj || 'Sem CNPJ'}<br />{f.telefone || 'Sem telefone'}<br />{f.email || 'Sem e-mail'}</p>{acoes(f)}</article>)}</div></>}
    <Dialog ref={dialog} aberto={!!editando} titulo={editando?.id ? 'Editar fornecedor' : 'Novo fornecedor'} onFechar={() => setEditando(null)} ocupado={ocupado} alterado={JSON.stringify(form) !== JSON.stringify(inicial)}><form onSubmit={salvar}><fieldset disabled={ocupado} style={{ border: 0, padding: 0, margin: 0 }}>{[{ campo: 'nome', titulo: 'Nome *', tipo: 'text' }, { campo: 'cnpj', titulo: 'CNPJ', tipo: 'text' }, { campo: 'telefone', titulo: 'Telefone', tipo: 'tel' }, { campo: 'email', titulo: 'E-mail', tipo: 'email' }].map(c => <div className="field" key={c.campo}><label htmlFor={`fornecedor-${c.campo}`}>{c.titulo}</label><input id={`fornecedor-${c.campo}`} type={c.tipo} required={c.campo === 'nome'} value={form[c.campo]} onChange={e => setForm(f => ({ ...f, [c.campo]: e.target.value }))} /></div>)}</fieldset>{erro && <p className="notice notice-error" role="alert">{erro}</p>}<div className="dialog-actions"><button type="button" className="button-secondary" disabled={ocupado} onClick={() => dialog.current?.solicitarFechamento()}>Cancelar</button><button type="submit" className="button-primary" disabled={ocupado}>{ocupado ? 'Salvando...' : 'Salvar'}</button></div></form></Dialog>
    <ConfirmDialog erro={erroExcluir} aberto={!!excluirId} titulo="Excluir fornecedor?" mensagem="O contato será removido. Os boletos existentes serão mantidos." onConfirmar={excluir} onCancelar={() => setExcluirId(null)} carregando={ocupado} />
  </section>;
}
