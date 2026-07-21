import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import usePaletaTenant from '../hooks/usePaletaTenant';
import MarcaPlataforma from '../components/MarcaPlataforma';

function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [empresa, setEmpresa] = useState({ nome: '', logo_url: null }); // Estado para a logo
  const navigate = useNavigate();
  const { empresaSlug } = useParams();

  usePaletaTenant(empresa);

  // BUSCA A LOGO DA EMPRESA ASSIM QUE A PÁGINA CARREGA
  useEffect(() => {
    const carregarDadosEmpresa = async () => {
      try {
        const res = await fetch(`http://localhost:4000/empresa/slug/${empresaSlug}`);
        const data = await res.json();
        if (res.ok) {
          setEmpresa(data);
        }
      } catch (err) {
        console.error("Erro ao carregar logo da empresa", err);
      }
    };
    carregarDadosEmpresa();
  }, [empresaSlug]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:4000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('usuario_id', data.usuario.id);
        localStorage.setItem('usuario_nome', data.usuario.nome);
        navigate(`/${empresaSlug}/barbeiros`);
      } else {
        setErro(data.message || 'Login inválido');
      }
    } catch (err) {
      setErro('Erro ao conectar com o servidor');
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card">
        {/* LÓGICA DA LOGO: Se tiver foto no banco, mostra a foto. Se não, mostra o emoji padrão */}
        <div style={s.logoArea}>
          {empresa.logo_url ? (
            <img src={empresa.logo_url} alt="Logo" style={s.logoImg} />
          ) : (
            <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
          )}
        </div>

        <h2 className="bb-title">{empresa.nome || 'Login'}</h2>
        <p className="bb-subtitle">Acesse para agendar seu horário</p>

        <form onSubmit={handleLogin}>
          <input
            className="bb-input"
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="bb-input"
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <button type="submit" className="bb-btn">Entrar</button>
        </form>

        <p
          className="bb-link"
          style={{ marginTop: '15px' }}
          onClick={() => navigate(`/${empresaSlug}/recuperar-senha`)}
        >
          Esqueci minha senha
        </p>

        <p className="bb-text-muted" style={{ marginTop: '18px' }}>
          Não tem conta?{' '}
          <span
            className="bb-link"
            onClick={() => navigate(`/${empresaSlug}/cadastro`)}
          >
            Cadastre-se aqui
          </span>
        </p>

        {erro && <p className="bb-erro">{erro}</p>}
        <MarcaPlataforma empresa={empresa} />
      </div>
    </div>
  );
}

const s = {
  logoArea: { marginBottom: '10px', display: 'flex', justifyContent: 'center' },
  logoImg: { width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(37,84,235,0.3)' }
};

export default Login;