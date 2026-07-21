import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatarTelefone } from '../utils/telefone';
import { emailValido } from '../utils/validacao';
import { useToast } from '../components/Toast';
import usePaletaTenant from '../hooks/usePaletaTenant';
import MarcaPlataforma from '../components/MarcaPlataforma';
import { API_URL } from '../services/api';

function Cadastro() {
  const [form, setForm] = useState({ nome: '', nascimento: '', email: '', telefone: '', senha: '' });
  const [erro, setErro] = useState('');
  const [etapa, setEtapa] = useState('cadastro');
  const [codigo, setCodigo] = useState('');
  const [empresa, setEmpresa] = useState(null);
  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const toast = useToast();

  usePaletaTenant(empresa);

  useEffect(() => {
    fetch(`${API_URL}/empresa/slug/${empresaSlug}`)
      .then((r) => r.json())
      .then(setEmpresa)
      .catch(() => {});
  }, [empresaSlug]);

  const handleTelefone = (v) => {
    setForm({ ...form, telefone: formatarTelefone(v) });
  };

  const emailTocado = form.email.length > 0;
  const emailInvalido = emailTocado && !emailValido(form.email);

  const handleCadastro = async (e) => {
    if (e) e.preventDefault();
    if (!emailValido(form.email)) {
      setErro('Insira um e-mail válido.');
      return;
    }
    if (form.telefone.length < 14) {
      setErro('Insira um telefone válido com DDD');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, empresaSlug })
      });
      
      const data = await res.json();

      if (res.ok) {
        setErro('');
        setEtapa('verificacao'); 
      } else {
        setErro(data.error || 'Erro ao cadastrar.');
      }
    } catch (err) {
      setErro('Erro de conexão com o servidor.');
    }
  };

  const handleConfirmarCodigo = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/confirmar-codigo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, codigo })
      });

      if (res.ok) {
        toast.success('Conta ativada com sucesso!');
        navigate(`/${empresaSlug}/login`); 
      } else {
        setErro('Código inválido ou expirado.');
      }
    } catch (err) {
      setErro('Erro ao validar código.');
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card">
        {empresa?.logo_url ? (
          <img src={empresa.logo_url} alt="Logo" className="bb-logo-img" />
        ) : (
          <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        )}
        {etapa === 'cadastro' ? (
          <>
            <h2 className="bb-title">Criar Conta</h2>
            <p className="bb-subtitle">Cadastre-se para agendar seu horário</p>
            <form onSubmit={handleCadastro}>
              <input className="bb-input" placeholder="Nome Completo" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
              <input className="bb-input" type="date" value={form.nascimento} onChange={e => setForm({...form, nascimento: e.target.value})} />
              <input
                className="bb-input"
                type="email"
                placeholder="E-mail"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                style={emailInvalido ? { borderColor: 'var(--bb-danger)', marginBottom: '4px' } : undefined}
              />
              {emailInvalido && <p className="bb-erro" style={{ margin: '0 0 12px', textAlign: 'left', fontSize: '12px' }}>Formato de e-mail inválido.</p>}
              <input
                className="bb-input"
                placeholder="Telefone (xx) xxxxx-xxxx"
                value={form.telefone}
                onChange={e => handleTelefone(e.target.value)}
              />
              <input className="bb-input" type="password" placeholder="Senha" value={form.senha} onChange={e => setForm({...form, senha: e.target.value})} />
              <button type="submit" className="bb-btn">Cadastrar</button>
              <button type="button" className="bb-btn-secondary" onClick={() => navigate(`/${empresaSlug}`)}>Voltar</button>
            </form>
          </>
        ) : (
          <>
            <h2 className="bb-title">Verifique seu E-mail</h2>
            <p className="bb-subtitle">Enviamos um código para <b>{form.email}</b></p>
            <form onSubmit={handleConfirmarCodigo}>
              <input
                className="bb-input"
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '5px' }}
                placeholder="000000"
                maxLength="6"
                value={codigo}
                onChange={e => setCodigo(e.target.value)}
                autoFocus
              />
              <button type="submit" className="bb-btn">Ativar Conta</button>
              <button type="button" className="bb-btn-secondary" onClick={() => { setEtapa('cadastro'); setErro(''); }}>Voltar ao cadastro</button>
            </form>
          </>
        )}
        {erro && <p className="bb-erro">{erro}</p>}
        <MarcaPlataforma empresa={empresa} />
      </div>
    </div>
  );
}

export default Cadastro;