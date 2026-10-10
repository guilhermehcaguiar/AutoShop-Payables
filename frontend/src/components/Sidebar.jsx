import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

const paginas = [
  { id: 'dashboard', nome: 'Resumo', icon: 'dashboard' },
  { id: 'boletos', nome: 'Boletos', icon: 'boleto' },
  { id: 'fornecedores', nome: 'Fornecedores', icon: 'fornecedores' },
  { id: 'relatorios', nome: 'Relatórios', icon: 'relatorios' },
  { id: 'auditoria', nome: 'Histórico', icon: 'historico' },
  { id: 'perfil', nome: 'Meu perfil', icon: 'usuario' },
];

export default function Sidebar({ aberta, setAberta, paginaAtual, setPaginaAtual, onSair, tema, onTemaChange, notificacoes, usuarioAdmin }) {
  const menu = useRef(null);
  useEffect(() => {
    if (!aberta) return;
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    menu.current.querySelector('button')?.focus();
    const fechar = e => {
      if (e.key === 'Escape') setAberta(false);
      if (e.key === 'Tab') {
        const botoes = [...menu.current.querySelectorAll('button:not(:disabled)')];
        const primeiro = botoes[0], ultimo = botoes.at(-1);
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
      }
    };
    window.addEventListener('keydown', fechar);
    return () => { window.removeEventListener('keydown', fechar); document.body.style.overflow = overflow; if (anterior?.isConnected) anterior.focus(); };
  }, [aberta, setAberta]);
  const itens = usuarioAdmin ? [...paginas, { id: 'metas', nome: 'Metas', icon: 'metas' }, { id: 'admin', nome: 'Administração', icon: 'ajustes' }] : paginas;
  return <>
    {aberta && <button className="sidebar-overlay" aria-label="Fechar menu" onClick={() => setAberta(false)} />}
    <aside ref={menu} inert={!aberta} id="app-sidebar" className={`app-sidebar ${aberta ? 'sidebar-open' : ''}`} aria-label="Menu principal">
      <div className="sidebar-brand"><span>Atend-Car</span><button type="button" className="icon-button sidebar-close" aria-label="Fechar menu" onClick={() => setAberta(false)}><Icon name="fechar" /></button></div>
      <p className="sidebar-caption">GESTÃO FINANCEIRA</p>
      <nav>{itens.map(item => <button key={item.id} type="button" aria-current={paginaAtual === item.id ? 'page' : undefined} onClick={() => { setPaginaAtual(item.id); setAberta(false); }}><Icon name={item.icon} /><span>{item.nome}</span></button>)}</nav>
      {notificacoes?.atrasados > 0 && <div className="sidebar-note"><Icon name="alerta" size={16} /><span>{notificacoes.atrasados} contas vencidas</span></div>}
      <div className="sidebar-bottom"><p>Aparência</p><div className="sidebar-themes">{[{ id: 'dark', nome: 'Escuro', icon: 'lua' }, { id: 'light', nome: 'Claro', icon: 'sol' }, { id: 'system', nome: 'Sistema', icon: 'sistema' }].map(t => <button key={t.id} type="button" title={t.nome} aria-label={`Tema ${t.nome}`} aria-pressed={tema === t.id} onClick={() => onTemaChange(t.id)}><Icon name={t.icon} size={18} /></button>)}</div><button type="button" className="sidebar-logout" onClick={onSair}><Icon name="sair" size={18} />Sair da conta</button></div>
    </aside>
    <nav className="mobile-nav" aria-label="Acesso rápido">{paginas.slice(0, 3).map(item => <button key={item.id} type="button" aria-current={paginaAtual === item.id ? 'page' : undefined} onClick={() => { setPaginaAtual(item.id); setAberta(false); }}><Icon name={item.icon} /><span>{item.nome}</span></button>)}<button type="button" aria-expanded={aberta} aria-controls="app-sidebar" onClick={() => setAberta(v => !v)}><Icon name="menu" /><span>Mais</span></button></nav>
  </>;
}
