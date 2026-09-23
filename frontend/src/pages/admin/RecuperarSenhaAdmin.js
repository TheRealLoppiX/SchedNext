import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

// Recuperação de senha do login da barbearia (/admin/login) — sem slug de empresa, porque esse
// login busca o e-mail direto em `empresas`/`unidade_admins` (ver routes/auth.js), diferente do
// RecuperarSenha.js de cliente final, que é escopado por tenant.
function RecuperarSenhaAdmin() {
  const [etapa, setEtapa] = useState(1); // 1: E-mail, 2: Código, 3: Nova senha
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleEnviarEmail = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/admin/recuperar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) {
        setEtapa(2);
      } else {
        toast.error(data.error || 'E-mail não encontrado.');
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  // A validação real do código acontece no passo final, pelo backend.
  const handleAvancarParaSenha = (e) => {
    e.preventDefault();
    if (codigo.trim().length === 6) {
      setEtapa(3);
    } else {
      toast.error('Digite o código de 6 dígitos.');
    }
  };

  const handleFinalizarReset = async (e) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const res = await fetch(`${API_URL}/admin/resetar-senha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, codigo, novaSenha })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Senha alterada! Faça login agora.');
        navigate('/admin/login');
      } else {
        toast.error(data.error || 'Código inválido. Tente novamente do início.');
        setEtapa(1);
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card">
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        <h2 className="bb-title">Recuperação de Senha</h2>
        <p className="bb-subtitle">Painel administrativo da sua barbearia</p>

        {etapa === 1 && (
          <form onSubmit={handleEnviarEmail}>
            <input
              type="email"
              className="bb-input"
              placeholder="E-mail da empresa"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <LoadingButton type="submit" loading={enviando} className="bb-btn">Enviar Código</LoadingButton>
          </form>
        )}

        {etapa === 2 && (
          <form onSubmit={handleAvancarParaSenha}>
            <p className="bb-subtitle">Digite o código enviado para:<br /><b>{email}</b></p>
            <input
              className="bb-input"
              placeholder="6 dígitos"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              required
            />
            <button type="submit" className="bb-btn">Verificar Código</button>
          </form>
        )}

        {etapa === 3 && (
          <form onSubmit={handleFinalizarReset}>
            <p className="bb-subtitle">Crie sua nova senha:</p>
            <input
              type="password"
              className="bb-input"
              placeholder="Nova senha"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              required
            />
            <LoadingButton type="submit" loading={enviando} className="bb-btn">Alterar Senha Agora</LoadingButton>
          </form>
        )}

        <p className="bb-link" style={{ marginTop: '18px' }} onClick={() => navigate('/admin/login')}>
          Voltar para o login
        </p>
      </div>
    </div>
  );
}

export default RecuperarSenhaAdmin;
