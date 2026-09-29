import { useEffect, useRef, useState } from 'react';
import useEscToClose from '../hooks/useEscToClose';

// Formatos de código de barras de produto (+ QR). Restringir aos que interessam deixa a leitura
// bem mais rápida e confiável do que procurar todos os formatos a cada quadro.
const FORMATOS_NATIVOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar', 'qr_code'];

// Câmera traseira em alta resolução: em 640x480 (padrão do navegador) as barras finas de um EAN-13
// ficam borradas e quase nunca são lidas.
const RESTRICOES_VIDEO = {
  audio: false,
  video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
};

// Bip de leitor de caixa ao ler. O contexto de áudio precisa ser criado/destravado dentro de um
// toque do usuário (exigência do iPhone), por isso quem abre o leitor chama desbloquearBip() no
// clique do botão da câmera.
let contextoAudio = null;

export function desbloquearBip() {
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return;
    if (!contextoAudio) contextoAudio = new Contexto();
    if (contextoAudio.state === 'suspended') contextoAudio.resume();
  } catch (_) {
    // sem áudio, segue só com a vibração
  }
}

function tocarBip() {
  try {
    if (!contextoAudio) desbloquearBip();
    if (!contextoAudio) return;
    const agora = contextoAudio.currentTime;
    const oscilador = contextoAudio.createOscillator();
    const volume = contextoAudio.createGain();
    oscilador.type = 'square';
    oscilador.frequency.value = 2700;
    volume.gain.setValueAtTime(0.0001, agora);
    volume.gain.exponentialRampToValueAtTime(0.15, agora + 0.005);
    volume.gain.setValueAtTime(0.15, agora + 0.1);
    volume.gain.exponentialRampToValueAtTime(0.0001, agora + 0.12);
    oscilador.connect(volume).connect(contextoAudio.destination);
    oscilador.start(agora);
    oscilador.stop(agora + 0.13);
  } catch (_) {
    // sem áudio, segue só com a vibração
  }
}

// Lê código de barras pela câmera. Usa o leitor nativo do aparelho quando existe (Chrome no
// Android, bem mais rápido e preciso) e cai pra ZXing nos demais (iPhone, Firefox, desktop). A
// ZXing só é baixada nesse caso. Leitor USB/Bluetooth não passa por aqui: ele "digita" o código
// no campo em foco, como um teclado.
function LeitorCodigoBarras({ onLer, onFechar }) {
  const videoRef = useRef(null);
  const trilhaRef = useRef(null);
  const [erro, setErro] = useState('');
  const [temLanterna, setTemLanterna] = useState(false);
  const [lanternaLigada, setLanternaLigada] = useState(false);

  useEscToClose(true, onFechar);

  useEffect(() => {
    let cancelado = false;
    let stream = null;
    let controlesZxing = null;
    let timer = null;

    const concluir = (codigo) => {
      if (cancelado || !codigo) return;
      cancelado = true;
      tocarBip();
      if (navigator.vibrate) navigator.vibrate(80);
      onLer(String(codigo).trim());
    };

    const iniciar = async () => {
      stream = await navigator.mediaDevices.getUserMedia(RESTRICOES_VIDEO);
      if (cancelado) return;

      const trilha = stream.getVideoTracks()[0];
      trilhaRef.current = trilha;
      const capacidades = trilha?.getCapabilities ? trilha.getCapabilities() : {};
      // Foco contínuo (quando o aparelho deixa escolher): sem ele a câmera fica focada no
      // infinito e o código de perto sai borrado.
      if (capacidades.focusMode?.includes('continuous')) {
        trilha.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      }
      setTemLanterna(!!capacidades.torch);

      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});

      if ('BarcodeDetector' in window) {
        const suportados = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
        const formatos = FORMATOS_NATIVOS.filter((f) => suportados.includes(f));
        if (formatos.length > 0) {
          const detector = new window.BarcodeDetector({ formats: formatos });
          const procurar = async () => {
            if (cancelado) return;
            try {
              if (video.readyState >= 2) {
                const achados = await detector.detect(video);
                if (achados.length > 0) return concluir(achados[0].rawValue);
              }
            } catch (_) {
              // quadro ruim, tenta o próximo
            }
            timer = setTimeout(procurar, 120);
          };
          procurar();
          return;
        }
      }

      const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
        import('@zxing/browser'),
        import('@zxing/library')
      ]);
      if (cancelado) return;
      const dicas = new Map();
      dicas.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.QR_CODE
      ]);
      dicas.set(DecodeHintType.TRY_HARDER, true);
      const leitor = new BrowserMultiFormatReader(dicas, { delayBetweenScanAttempts: 100 });
      controlesZxing = await leitor.decodeFromStream(stream, video, (resultado) => {
        if (resultado) concluir(resultado.getText());
      });
      if (cancelado) controlesZxing.stop();
    };

    iniciar().catch((e) => {
      if (cancelado) return;
      setErro(e?.name === 'NotAllowedError'
        ? 'Sem permissão pra usar a câmera. Libere o acesso nas configurações do navegador.'
        : 'Não foi possível abrir a câmera neste aparelho.');
    });

    return () => {
      cancelado = true;
      clearTimeout(timer);
      if (controlesZxing) controlesZxing.stop();
      if (stream) stream.getTracks().forEach((t) => t.stop());
      trilhaRef.current = null;
    };
  }, [onLer]);

  const alternarLanterna = () => {
    const trilha = trilhaRef.current;
    if (!trilha) return;
    const ligar = !lanternaLigada;
    trilha.applyConstraints({ advanced: [{ torch: ligar }] })
      .then(() => setLanternaLigada(ligar))
      .catch(() => {});
  };

  return (
    <div style={s.overlay} onClick={onFechar}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <h3 style={s.titulo}>Aponte para o código de barras</h3>
        {erro ? (
          <p style={s.erro}>{erro}</p>
        ) : (
          <>
            <div style={s.moldura}>
              <video ref={videoRef} style={s.video} muted playsInline autoPlay />
              <div style={s.mira} />
            </div>
            <p style={s.dica}>Deixe o código na horizontal, a uns 15 cm da câmera e bem iluminado. Não leu? Digite o número no campo.</p>
          </>
        )}
        <div style={s.botoes}>
          {temLanterna && !erro && (
            <button type="button" onClick={alternarLanterna} style={s.btn}>{lanternaLigada ? 'Desligar lanterna' : 'Ligar lanterna'}</button>
          )}
          <button type="button" onClick={onFechar} style={s.btn}>Cancelar</button>
        </div>
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
  dica: { margin: 0, color: 'var(--fx-muted)', fontSize: '12.5px', lineHeight: 1.4 },
  erro: { margin: 0, color: 'var(--fx-red)', fontSize: '14px', lineHeight: 1.4 },
  botoes: { display: 'flex', gap: '8px' },
  btn: { flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', fontWeight: 600, cursor: 'pointer' }
};

export default LeitorCodigoBarras;
