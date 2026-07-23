import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

// Login do dono da plataforma — totalmente separado do login de admin de empresa (ver
// backend/src/middleware/superAdminAuth.js). Não tem cadastro nem recuperação de senha: é uma
// conta única configurada via variável de ambiente.
function SuperAdminLogin() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setEntrando(true);
    try {
      const res = await fetch(`${API_URL}/super-admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('superAdminToken', data.token);
        navigate('/admin-absoluto/dashboard');
      } else {
        toast.error(data.error || 'E-mail ou senha incorretos.');
      }
    } catch (err) {
      toast.error('Não foi possível conectar ao servidor. Tente novamente em instantes.');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="bb-page">
      <form className="bb-card" onSubmit={handleLogin}>
        <h2 className="bb-title">Admin absoluto</h2>
        <p className="bb-subtitle">Acesso restrito ao dono da plataforma</p>

        <input
          type="email"
          placeholder="E-mail"
          className="bb-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Senha"
          className="bb-input"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />
        <LoadingButton type="submit" loading={entrando} className="bb-btn">Entrar</LoadingButton>
      </form>
    </div>
  );
}

export default SuperAdminLogin;
