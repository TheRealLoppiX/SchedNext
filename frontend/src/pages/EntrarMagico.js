import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { API_URL } from '../services/api';

// Consome o link de login automático mandado pelo bot de WhatsApp quando ele já reconhece o
// cliente pelo telefone (ver backend/src/services/loginMagico.js e POST /login-magico). Só troca
// o token de curta duração da URL por uma sessão de verdade — não tem formulário nenhum, é uma
// tela de passagem.
function EntrarMagico() {
  const [erro, setErro] = useState('');
  const navigate = useNavigate();
  const { empresaSlug } = useParams();
  const [searchParams] = useSearchParams();
  const jaTentou = useRef(false); // StrictMode/re-render não pode disparar a troca do token duas vezes

  useEffect(() => {
    if (jaTentou.current) return;
    jaTentou.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setErro('Link inválido.');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_URL}/login-magico`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (res.ok) {
          localStorage.setItem('token', data.token);
          localStorage.setItem('usuario_id', data.usuario.id);
          localStorage.setItem('usuario_nome', data.usuario.nome);
          navigate(`/${empresaSlug}/barbeiros`, { replace: true });
        } else {
          setErro(data.message || 'Não foi possível entrar automaticamente.');
        }
      } catch (err) {
        setErro('Erro ao conectar com o servidor.');
      }
    })();
  }, [searchParams, empresaSlug, navigate]);

  return (
    <div className="bb-page">
      <div className="bb-card" style={{ textAlign: 'center' }}>
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        {erro ? (
          <>
            <p className="bb-erro" style={{ marginTop: '16px' }}>{erro}</p>
            <p
              className="bb-link"
              style={{ marginTop: '10px' }}
              onClick={() => navigate(`/${empresaSlug}/login`)}
            >
              Entrar com e-mail e senha
            </p>
          </>
        ) : (
          <p className="bb-text-muted" style={{ marginTop: '16px' }}>Entrando na sua conta...</p>
        )}
      </div>
    </div>
  );
}

export default EntrarMagico;
