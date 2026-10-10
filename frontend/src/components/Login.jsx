import { useState } from 'react';
import './Login.css';

function Icon({ tipo, ...props }) {
  const paths = {
    usuario: <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>,
    cadeado: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    olho: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    ocultar: <><path d="m3 3 18 18M10.6 5.1 12 5c6.5 0 10 7 10 7a20 20 0 0 1-3 3.7M6.5 6.5A21 21 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.5-1.5M10 10a3 3 0 0 0 4 4" /></>,
    seta: <path d="M4 12h16m-6-6 6 6-6 6" />,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[tipo]}</svg>;
}

export default function Login({ username, setUsername, senha, setSenha, erro, carregando, onSubmit }) {
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const verificarCapsLock = (e) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <main className="login-page">
      <div className="login-shell">
        <section className="login-brand" aria-label="Financeiro Atend-Car">
          <a className="login-wordmark" href="#" aria-label="Atend-Car, início">Atend<span>-Car</span><span className="login-wordmark-dot" /></a>
          <div className="login-brand-content">
            <p className="login-eyebrow"><span /> GESTÃO FINANCEIRA</p>
            <h1>Seu financeiro<br />{' '}sob <span>controle.</span></h1>
            <p className="login-brand-description">Mais clareza nas contas.<br />Mais tranquilidade para seguir em frente.</p>
            <div className="login-road" aria-hidden="true">
              <svg viewBox="0 0 540 180" fill="none">
                <path d="M-30 156h610M-30 176h610" stroke="currentColor" opacity=".13" />
                <path d="M45 131h37l23-31 58-10 49-40h121l68 46 58 11 25 24h21" stroke="currentColor" strokeWidth="2" />
                <path d="M172 90h173l-36-28h-86l-39 28M98 135h57m49 0h173m49 0h44" stroke="currentColor" opacity=".45" />
                <circle cx="180" cy="132" r="23" stroke="currentColor" strokeWidth="2" /><circle cx="402" cy="132" r="23" stroke="currentColor" strokeWidth="2" />
                <circle cx="180" cy="132" r="9" stroke="currentColor" opacity=".35" /><circle cx="402" cy="132" r="9" stroke="currentColor" opacity=".35" />
              </svg>
            </div>
          </div>
          <p className="login-brand-footer">Organização que acompanha o seu ritmo.</p>
        </section>

        <section className="login-access" aria-labelledby="login-title">
          <div className="login-card">
            <div className="login-lock"><Icon tipo="cadeado" /></div>
            <p className="login-eyebrow login-card-eyebrow">BEM-VINDO DE VOLTA</p>
            <h2 id="login-title">Acesse sua conta</h2>
            <p className="login-card-description">Entre para gerenciar o financeiro da Atend-Car.</p>
            <form onSubmit={onSubmit} aria-busy={carregando}>
              <div className="login-field">
                <label htmlFor="login-username">Usuário</label>
                <div className="login-input-wrap">
                  <Icon tipo="usuario" />
                  <input id="login-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Seu usuário" required readOnly={carregando} />
                </div>
              </div>
              <div className="login-field">
                <label htmlFor="login-password">Senha</label>
                <div className="login-input-wrap">
                  <Icon tipo="cadeado" />
                  <input id="login-password" name="password" type={mostrarSenha ? 'text' : 'password'} autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={verificarCapsLock} onKeyUp={verificarCapsLock} onBlur={() => setCapsLock(false)} aria-describedby={capsLock ? 'login-caps-lock' : undefined} placeholder="Sua senha" required readOnly={carregando} />
                  <button className="login-show-password" type="button" aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={mostrarSenha} onClick={() => setMostrarSenha((v) => !v)}><Icon tipo={mostrarSenha ? 'ocultar' : 'olho'} /></button>
                </div>
                {capsLock && <p className="login-caps-lock" id="login-caps-lock" role="status">Caps Lock está ativado.</p>}
              </div>
              {erro && <div className="login-error" role="alert">{erro}</div>}
              <button className="login-submit" type="submit" disabled={carregando}>
                {carregando ? <><span className="login-spinner" aria-hidden="true" /> Entrando...</> : <>Entrar <Icon tipo="seta" /></>}
              </button>
            </form>
            <div className="login-access-note"><Icon tipo="cadeado" /><span>Acesso exclusivo à equipe Atend-Car</span></div>
          </div>
          <p className="login-help">Precisa de acesso? Fale com o administrador.</p>
        </section>
      </div>
      <footer className="login-footer"><span>ATEND-CAR</span><span>Financeiro · Gestão interna</span></footer>
    </main>
  );
}
