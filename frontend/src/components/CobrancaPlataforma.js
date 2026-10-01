import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from './Toast';
import LoadingButton from './LoadingButton';
import { API_URL } from '../services/api';

// Cobrança da SchedNext em aberto pra empresa (contratação de plano enviada pelo admin absoluto ou
// iniciada por ela, ou mensalidade atrasada). Ver GET /admin/assinatura-plataforma/cobranca-pendente.
// O aviso aparece em todo o painel; o quadro de pagamento fica na tela Conta.

const formatarReal = (v) => `R$ ${Number(v || 0).toFixed(2).replace('.', ',')}`;

export function useCobrancaPendente(dependencia) {
  const [cobranca, setCobranca] = useState(null);
  const carregar = useCallback(() => {
    fetch(`${API_URL}/admin/assinatura-plataforma/cobranca-pendente`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setCobranca)
      .catch(() => setCobranca(null));
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [carregar, dependencia]);
  return [cobranca, carregar];
}

const descricao = (c) => (c.tipo === 'contratacao'
  ? `Pagamento do plano ${c.plano_nome}: ${formatarReal(c.valor)}. O plano passa a valer assim que o pagamento for confirmado.`
  : `Mensalidade da SchedNext em aberto: ${formatarReal(c.valor)}.${c.status === 'inadimplente' ? ' O painel fica limitado até o pagamento.' : ''}`);

// Faixa no topo do painel, em todas as telas menos a Conta (que já mostra o quadro completo).
export function AvisoCobrancaPlataforma({ caminho }) {
  const [cobranca] = useCobrancaPendente(caminho);
  if (!cobranca || caminho.startsWith('/admin/conta')) return null;
  return (
    <div role="status" style={st.aviso}>
      <span>{descricao(cobranca)}</span>
      <Link to="/admin/conta" style={st.avisoBotao}>Pagar agora</Link>
    </div>
  );
}

// Quadro de pagamento da tela Conta: Pix (QR + copia e cola, ou gerar outro se expirou) ou cartão.
export function PagamentoPendentePlataforma({ planoAtualId, aoPagar }) {
  const toast = useToast();
  const [cobranca, recarregar] = useCobrancaPendente();
  const [pixNovo, setPixNovo] = useState(null);
  const [processando, setProcessando] = useState(null);

  if (!cobranca) return null;
  const qr = pixNovo || (cobranca.qr_code ? cobranca : null);

  const gerarPix = async () => {
    setProcessando('pix');
    try {
      const res = await fetch(`${API_URL}/admin/assinatura-plataforma/cobranca-pendente/pix`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) setPixNovo(data); else toast.error(data.error || 'Não foi possível gerar o Pix.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setProcessando(null);
    }
  };

  const pagarComCartao = async () => {
    setProcessando('cartao');
    try {
      const res = await fetch(`${API_URL}/admin/assinatura-plataforma/iniciar-upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano_plataforma_id: cobranca.plano_plataforma_id || planoAtualId, forma_pagamento: 'cartao' })
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener,noreferrer');
        toast.success('Finalize o pagamento na aba que abriu. O plano é liberado assim que for confirmado.');
        recarregar();
        aoPagar?.();
      } else {
        toast.error(data.error || 'Não foi possível iniciar o pagamento com cartão.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setProcessando(null);
    }
  };

  const copiar = () => {
    navigator.clipboard.writeText(qr.qr_code)
      .then(() => toast.success('Código Pix copiado!'))
      .catch(() => toast.error('Não foi possível copiar o código.'));
  };

  return (
    <div style={st.quadro}>
      <strong style={st.titulo}>Pagamento pendente</strong>
      <p style={st.texto}>{descricao(cobranca)}</p>
      {qr ? (
        <div style={{ textAlign: 'center' }}>
          {qr.qr_code_base64 && <img src={`data:image/png;base64,${qr.qr_code_base64}`} alt="QR Code do Pix" style={st.qr} />}
          <div><button type="button" onClick={copiar} style={st.btnSecundario}>Copiar código Pix</button></div>
        </div>
      ) : (
        <LoadingButton loading={processando === 'pix'} onClick={gerarPix} style={st.btnSecundario}>Gerar Pix</LoadingButton>
      )}
      {(cobranca.plano_plataforma_id || planoAtualId) && (
        <LoadingButton loading={processando === 'cartao'} onClick={pagarComCartao} style={st.btnPrincipal}>Pagar com cartão</LoadingButton>
      )}
    </div>
  );
}

const st = {
  aviso: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', margin: '0 0 16px', padding: '12px 16px', borderRadius: '12px', background: 'var(--fx-amber-bg)', color: 'var(--fx-amber)', border: '1px solid var(--fx-amber)', fontSize: '13.5px', fontWeight: 600 },
  avisoBotao: { background: 'var(--fx-amber)', color: '#fff', padding: '8px 14px', borderRadius: '999px', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' },
  quadro: { display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', marginBottom: '16px', borderRadius: '12px', background: 'var(--fx-amber-bg)', border: '1px solid var(--fx-amber)' },
  titulo: { color: 'var(--fx-amber)', fontSize: '15px' },
  texto: { margin: 0, fontSize: '13.5px', color: 'var(--fx-text)', lineHeight: 1.45 },
  qr: { width: '180px', maxWidth: '100%', aspectRatio: '1', borderRadius: '8px', background: '#fff', padding: '6px', marginBottom: '8px' },
  btnSecundario: { padding: '10px 16px', borderRadius: '999px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', fontWeight: 600, cursor: 'pointer' },
  btnPrincipal: { padding: '12px 16px', borderRadius: '999px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: 700, cursor: 'pointer' }
};
