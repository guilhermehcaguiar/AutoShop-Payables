import { useState } from 'react';
import { apiFetch } from '../api.js';

function PaginaPerfil({ usuarioPerfil }) {
  const [senhaAtual, setSenhaAtual] = useState('');
  const [senhaNova, setSenhaNova] = useState('');
  const [confirmSenha, setConfirmSenha] = useState('');
  const [msgSenha, setMsgSenha] = useState('');
  const [carregandoSenha, setCarregandoSenha] = useState(false);

  const handleAlterarSenha = async (e) => {
    e.preventDefault();
    setMsgSenha('');
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
        setMsgSenha('✅ Senha alterada com sucesso!');
        setSenhaAtual(''); setSenhaNova(''); setConfirmSenha('');
      } else {
        setMsgSenha(`⚠️ ${dados.detail}`);
      }
    } catch { setMsgSenha('⚠️ Erro de conexão com o servidor'); }
    finally { setCarregandoSenha(false); }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="rounded-xl border border-atend-border bg-atend-card overflow-hidden shadow-2xl">
        <div className="px-6 py-5 border-b border-atend-border">
          <h3 className="text-lg font-bold text-white">Meu Perfil</h3>
          <p className="text-xs text-slate-400">Informações da sua conta</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-atend-border/50">
            <div className="w-14 h-14 rounded-full bg-atend-verde/10 border border-atend-verde/20 flex items-center justify-center text-2xl">
              {usuarioPerfil.sexo === 'M' ? '👨‍🔧' : '👩‍🔧'}
            </div>
            <div>
              <p className="text-lg font-bold text-white">{usuarioPerfil.nome}</p>
              <p className="text-xs text-slate-400">Gênero: {usuarioPerfil.sexo === 'M' ? 'Masculino' : 'Feminino'}</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Alterar Senha</h4>
            <form onSubmit={handleAlterarSenha} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Senha Atual</label>
                <input type="password" value={senhaAtual} onChange={(e) => setSenhaAtual(e.target.value)}
                  placeholder="Sua senha atual"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Nova Senha</label>
                <input type="password" value={senhaNova} onChange={(e) => setSenhaNova(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Confirmar Nova Senha</label>
                <input type="password" value={confirmSenha} onChange={(e) => setConfirmSenha(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-atend-bg border border-atend-border rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-atend-verde/60 transition-colors" required />
              </div>
              {msgSenha && (
                <div className={`text-xs rounded-lg p-3 text-center ${msgSenha.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                  {msgSenha}
                </div>
              )}
              <button type="submit" disabled={carregandoSenha}
                className="bg-atend-verde hover:opacity-90 active:scale-[0.98] focus:outline-none disabled:opacity-50 text-slate-950 text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-atend-verde/10">
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
