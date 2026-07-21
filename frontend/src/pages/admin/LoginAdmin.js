import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/Toast';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

function LoginAdmin({ setEmpresaLogada }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogin = async (e) => {
    e.preventDefault();
    setEntrando(true);
    try {
      const res = await fetch(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (data.success) {
        // Salva para não deslogar no F5 (inclui o JWT usado em toda chamada /admin/*, ver services/authFetch.js)
        localStorage.setItem('adminToken', JSON.stringify({ ...data.admin, token: data.token }));
        // Avisa o App.js que a empresa logou
        setEmpresaLogada(data.admin.empresa_id);
        // Manda para o Dashboard
        navigate('/admin/dashboard');
      } else {
        toast.error(data.error || "E-mail ou senha incorretos.");
      }
    } catch (err) {
      toast.error("Não foi possível conectar ao servidor. Tente novamente em instantes.");
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="bb-page">
      <form className="bb-card" onSubmit={handleLogin}>
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        <h2 className="bb-title">Painel Administrativo</h2>
        <p className="bb-subtitle">Entre com os dados do seu negócio</p>

        <input
          type="email"
          placeholder="E-mail da empresa"
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
        <LoadingButton type="submit" loading={entrando} className="bb-btn">Acessar Dashboard</LoadingButton>
      </form>
    </div>
  );
}

export default LoginAdmin;