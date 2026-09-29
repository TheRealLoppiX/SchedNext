import { useEffect, useRef, useState } from 'react';
import useEscToClose from '../hooks/useEscToClose';

// Lê código de barras pela câmera (traseira, no celular). A biblioteca (ZXing) só é baixada quando
// o leitor abre, pra não pesar no carregamento do painel. Leitor USB/Bluetooth não passa por
// aqui: ele "digita" o código no campo que estiver em foco, como um teclado.
function LeitorCodigoBarras({ onLer, onFechar }) {
  const videoRef = useRef(null);
  const [erro, setErro] = useState('');

  useEscToClose(true, onFechar);

  useEffect(() => {
    let controles = null;
    let cancelado = false;

    import('@zxing/browser')
      .then(({ BrowserMultiFormatReader }) => {
        if (cancelado) return null;
        const leitor = new BrowserMultiFormatReader();
        return leitor.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current,
          (resultado, _erroLeitura, ctrl) => {
            if (!resultado || cancelado) return;
            cancelado = true;
            ctrl.stop();
            onLer(resultado.getText());
          }
        );
      })
      .then((ctrl) => {
        controles = ctrl;
        if (cancelado && ctrl) ctrl.stop();
      })
      .catch((e) => {
        if (cancelado) return;
        setErro(e?.name === 'NotAllowedError'
          ? 'Sem permissão pra usar a câmera. Libere o acesso nas configurações do navegador.'
          : 'Não foi possível abrir a câmera neste aparelho.');
      });

    return () => {
      cancelado = true;
      if (controles) controles.stop();
    };
  }, [onLer]);

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.titulo}>Aponte para o código de barras</h3>
        {erro ? (
          <p style={s.erro}>{erro}</p>
        ) : (
          <div style={s.moldura}>
            <video ref={videoRef} style={s.video} muted playsInline />
            <div style={s.mira} />
          </div>
        )}
        <button type="button" onClick={onFechar} style={s.btnFechar}>Cancelar</button>
      </div>
    </div>
  );
}

const s = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '16px' },
  card: { background: 'var(--fx-card)', borderRadius: '16px', padding: '20px', width: '100%', maxWidth: '420px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '14px' },
  titulo: { margin: 0, fontSize: '16px', color: 'var(--fx-text)' },
  moldura: { position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' },
  video: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  mira: { position: 'absolute', left: '10%', right: '10%', top: '50%', height: '2px', background: '#ef4444', boxShadow: '0 0 8px #ef4444' },
  erro: { margin: 0, color: 'var(--fx-red)', fontSize: '14px', lineHeight: 1.4 },
  btnFechar: { padding: '12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', fontWeight: 600, cursor: 'pointer' }
};

export default LeitorCodigoBarras;
