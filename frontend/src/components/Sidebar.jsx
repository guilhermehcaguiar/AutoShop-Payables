function Sidebar({ aberta, setAberta, paginaAtual, setPaginaAtual, onSair, tema, onTemaChange, notificacoes, usuarioAdmin }) {
  return (
    <>
      {aberta && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setAberta(false)} />
      )}

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-atend-card border-r border-atend-border z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${
          aberta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5 border-b border-atend-border min-h-[64px]">
          <div className="w-full flex items-center justify-center">
            <span className="text-3xl font-black tracking-wide select-none"
              style={{
                fontFamily: "'Sonic Extra Bold', 'Segoe UI', 'Arial Black', system-ui, sans-serif",
                color: '#ffffff',
                WebkitTextStroke: '1.2px #000000',
                textShadow: '0 0 4px rgba(0,0,0,0.5)',
              }}>
              Atend-Car
            </span>
          </div>
          <button onClick={() => setAberta(false)}
            className="text-slate-500 hover:text-white text-xl leading-none absolute right-4 top-5">&times;</button>
        </div>

        <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
          <ItemSidebar icone="📊" rotulo="Dashboard" pagina="dashboard" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />
          <ItemSidebar icone="💰" rotulo="Boletos" pagina="boletos" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />
          <ItemSidebar icone="🏢" rotulo="Fornecedores" pagina="fornecedores" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />
          <ItemSidebar icone="📊" rotulo="Relatórios" pagina="relatorios" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />
          <ItemSidebar icone="📋" rotulo="Histórico" pagina="auditoria" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />
          <ItemSidebar icone="👤" rotulo="Perfil" pagina="perfil" atual={paginaAtual} onClick={setPaginaAtual} fechar={() => setAberta(false)} />

          {usuarioAdmin && (
            <>
              <ItemSidebar
                icone="⚙️"
                rotulo="Admin"
                pagina="admin"
                atual={paginaAtual}
                onClick={setPaginaAtual}
                fechar={() => setAberta(false)}
                badge={notificacoes?.pendentes > 0 ? notificacoes.pendentes : null}
              />
              <ItemSidebar
                icone="🎯"
                rotulo="Metas"
                pagina="metas"
                atual={paginaAtual}
                onClick={setPaginaAtual}
                fechar={() => setAberta(false)}
              />
            </>
          )}
        </nav>

        {notificacoes && (notificacoes.vence_hoje > 0 || notificacoes.atrasados > 0) && (
          <div className="px-4 py-3 border-t border-atend-border">
            <div className="flex items-center gap-2 text-xs">
              {notificacoes.vence_hoje > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  🔴 {notificacoes.vence_hoje} hoje
                </span>
              )}
              {notificacoes.atrasados > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  ⚠️ {notificacoes.atrasados} atrasados
                </span>
              )}
            </div>
          </div>
        )}

        <div className="px-3 py-3 border-t border-atend-border">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-2 px-3">Tema</p>
          <div className="flex gap-1 px-1">
            {[
              { valor: 'dark', icone: '🌙' },
              { valor: 'light', icone: '☀️' },
              { valor: 'system', icone: '💻' },
            ].map(({ valor, icone }) => (
              <button key={valor} onClick={() => onTemaChange(valor)}
                className={`flex-1 flex items-center justify-center px-2 py-2 rounded-lg text-xs font-medium transition-all ${
                  tema === valor
                    ? 'bg-atend-verde/10 text-atend-verde border border-atend-verde/20'
                    : 'text-slate-500 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`}>
                <span>{icone}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-4 border-t border-atend-border">
          <button onClick={onSair}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all">
            <span className="text-lg">🚪</span>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function ItemSidebar({ icone, rotulo, pagina, atual, onClick, fechar, badge }) {
  return (
    <button
      onClick={() => { onClick(pagina); fechar(); }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 relative overflow-hidden ${
        atual === pagina
          ? 'bg-atend-verde/10 text-atend-verde border border-atend-verde/20 shadow-sm shadow-atend-verde/5'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50 active:scale-[0.98]'
      }`}
    >
      {atual === pagina && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-atend-verde rounded-full" />}
      <span className="text-lg">{icone}</span>
      <span className="flex-1 text-left">{rotulo}</span>
      {badge !== null && badge !== undefined && (
        <span className="bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full px-1 animate-pulse">
          {badge}
        </span>
      )}
    </button>
  );
}

export default Sidebar;