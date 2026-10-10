import { useState } from 'react';
import { apiFetch } from '../api.js';
import Icon from './Icon.jsx';

function PaginaPerfil({ usuarioPerfil }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState('');
  const [senhaAlterada, setSenhaAlterada] = useState(false);
  const [carregandoSenha, setCarregandoSenha] = useState(false);

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setMsgSenha('');
    setSenhaAlterada(false);
    if (senhaNova !== confirmSenha) { setMsgSenha('As senhas não conferem'); return; }
    if (senhaNova.length < 3) { setMsgSenha('A nova senha deve ter pelo menos 3 caracteres'); return; }
    setCarregandoSenha(true);
    const token = localStorage.getItem('token');
    try {
      const resposta = await apiFetch('/usuarios/alterar-senha', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ senha_atual: senhaAtual, senha_nova: senhaNova }),
      });
      const dados = await resposta.json();
      if (resposta.ok) {
        setSenhaAlterada(true);
        setMsgSenha('Senha alterada com sucesso!');
        setSenhaAtual(''); setSenhaNova(''); setConfirmSenha('');
      } else {
        setMsgSenha(dados.detail || 'Não foi possível alterar a senha');
      }
    } catch { setMsgSenha('Erro de conexão com o servidor'); }
    finally { setCarregandoSenha(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="app-section">
        <div className="section-heading page-heading">
          <div><h2>Meu Perfil</h2><p>Informações da sua conta</p></div>
          <Icon name="usuario" size={24} className="subtle" />
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-atend-border/50">
            <div className="profile-avatar">
              <Icon name="usuario" size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{usuarioPerfil.nome}</p>
              <p className="text-xs text-slate-400">Gênero: {usuarioPerfil.sexo === 'M' ? 'Masculino' : 'Feminino'}</p>
            </div>
          </div>
          <div>
            <h3 className="page-subheading"><Icon name="cadeado" size={18} />Alterar Senha</h3>
            <form onSubmit={handleAlterarSenha} className="space-y-4">
              <div className="field">
                <label htmlFor="perfil-senha-atual">Senha Atual</label>
                <input id="perfil-senha-atual" autoComplete="current-password" type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              <div className="field">
                <label htmlFor="perfil-senha-nova">Nova Senha</label>
                <input id="perfil-senha-nova" autoComplete="new-password" type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              <div className="field">
                <label htmlFor="perfil-senha-confirmar">Confirmar Nova Senha</label>
                <input id="perfil-senha-confirmar" autoComplete="new-password" type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              {msgSenha && (
                <div role={senhaAlterada ? 'status' : 'alert'} className={`notice ${senhaAlterada ? 'notice-success' : 'notice-error'}`}>
                  <Icon name={senhaAlterada ? 'check' : 'alerta'} size={18} className="inline-icon" /> {msgSenha}
                </div>
              )}
              <button type="submit" disabled={carregandoSenha}
                className="button-primary">
                <Icon name="cadeado" size={16} />
                {carregandoSenha ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PaginaPerfil;
