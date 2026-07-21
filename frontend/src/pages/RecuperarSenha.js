import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '../components/Toast';
import usePaletaTenant from '../hooks/usePaletaTenant';
import MarcaPlataforma from '../components/MarcaPlataforma';

function RecuperarSenha() {
  const [etapa, setEtapa] = useState(1); // 1: Email, 2: Código, 3: Nova Senha
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [erro, setErro] = useState('');
  const [empresa, setEmpresa] = useState(null);
  const { empresaSlug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  usePaletaTenant(empresa);

  useEffect(() => {
    fetch(`http://localhost:4000/empresa/slug/${empresaSlug}`)
      .then((r) => r.json())
      .then(setEmpresa)
      .catch(() => {});
  }, [empresaSlug]);

  // ENVIA O CÓDIGO
  const handleEnviarEmail = async (e) => {
    if (e) e.preventDefault();
    const res = await fetch('http://localhost:4000/recuperar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (res.ok) { setEtapa(2); setErro(''); } 
    else { setErro('E-mail não encontrado.'); }
  };

  // APENAS AVANÇA PARA A SENHA (A validação real ocorre no passo final pelo backend)
  const handleAvancarParaSenha = (e) => {
    if (e) e.preventDefault();
    if (codigo.length === 6) { setEtapa(3); setErro(''); }
    else { setErro('Digite o código de 6 dígitos.'); }
  };

  // FINALIZA E TROCA A SENHA
  const handleFinalizarReset = async (e) => {
    if (e) e.preventDefault();
    const res = await fetch('http://localhost:4000/resetar-senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, codigo, novaSenha })
    });

    if (res.ok) {
      toast.success('Senha alterada! Faça login agora.');
      navigate(`/${empresaSlug}/login`);
    } else {
      setErro('Código inválido. Tente novamente do início.');
      setEtapa(1); // Volta pro início se o código estiver errado
    }
  };

  return (
    <div className="bb-page">
      <div className="bb-card">
        <img src="/icon-schednext.png" alt="SchedNext" className="bb-logo-img" />
        <h2 className="bb-title">Recuperação de Senha</h2>

        {etapa === 1 && (
          <form onSubmit={handleEnviarEmail}>
            <p className="bb-subtitle">Informe seu e-mail cadastrado:</p>
            <input className="bb-input" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
            <button type="submit" className="bb-btn">Enviar Código</button>
          </form>
        )}

        {etapa === 2 && (
          <form onSubmit={handleAvancarParaSenha}>
            <p className="bb-subtitle">Digite o código enviado para:<br/><b>{email}</b></p>
            <input className="bb-input" placeholder="6 dígitos" value={codigo} onChange={e => setCodigo(e.target.value)} />
            <button type="submit" className="bb-btn">Verificar Código</button>
          </form>
        )}

        {etapa === 3 && (
          <form onSubmit={handleFinalizarReset}>
            <p className="bb-subtitle">Crie sua nova senha:</p>
            <input className="bb-input" type="password" placeholder="Nova Senha" onChange={e => setNovaSenha(e.target.value)} />
            <button type="submit" className="bb-btn">Alterar Senha Agora</button>
          </form>
        )}

        <p className="bb-link" style={{ marginTop: '18px' }} onClick={() => navigate(-1)}>Voltar</p>
        {erro && <p className="bb-erro">{erro}</p>}
        <MarcaPlataforma empresa={empresa} />
      </div>
    </div>
  );
}

export default RecuperarSenha;