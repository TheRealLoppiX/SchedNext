import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '../../components/Toast';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

const INTERVALO_POLL_MS = 5000;
// Depois de conectado, o poll rápido de 5s (feito só enquanto tem QR pendente) para de rodar —
// sem um poll mais espaçado por cima, uma queda silenciosa da sessão do WhatsApp (ex: o
// celular foi desconectado do app) só aparecia pro admin se ele desse F5 na página.
const INTERVALO_POLL_CONECTADO_MS = 45000;

function AdminWhatsapp() {
  const toast = useToast();
  const confirmar = useConfirm();

  const [carregando, setCarregando] = useState(true);
  const [permitido, setPermitido] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [instancia, setInstancia] = useState(null);
  const [qrcode, setQrcode] = useState(null);
  const [conectando, setConectando] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [telefoneTeste, setTelefoneTeste] = useState('');
  const [testando, setTestando] = useState(false);

  const [botConfig, setBotConfig] = useState({ permiteIa: false, modo: 'guiado', nome: '', personalidade: '', boasVindas: '', temperatura: 0.6, resumoProfissionaisAtivo: false, resumoProfissionaisHorario: '08:00', horarioAtivo: false, horarioInicio: '09:00', horarioFim: '18:00', horarioDias: [1, 2, 3, 4, 5, 6], mensagemFora: '', mensagemForaPadrao: '' });
  const [salvandoBot, setSalvandoBot] = useState(false);

  const pollRef = useRef(null);
  const pollLentoRef = useRef(null);
  const conectadoRef = useRef(false);
  // Essa tela faz poll a cada 5-45s (ver INTERVALO_POLL_*) pra status de conexão — sem essa trava,
  // um ciclo de poll durante a edição da personalidade sobrescrevia o rascunho do admin no meio da
  // digitação com o valor ainda salvo no banco.
  const botConfigCarregadoRef = useRef(false);

  const pararPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const carregarStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp`);
      const dados = await res.json();
      setPermitido(!!dados.permitido);
      setConectado(!!dados.conectado);
      setInstancia(dados.instancia || null);
      if (dados.botConfig && !botConfigCarregadoRef.current) {
        setBotConfig(dados.botConfig);
        botConfigCarregadoRef.current = true;
      }
      if (dados.conectado) {
        setQrcode(null);
        pararPoll();
      } else if (conectadoRef.current && !dados.erroConsulta) {
        // Estava conectado e agora não está mais — sessão caiu sozinha (ex: celular desparelhado
        // do lado do WhatsApp). Sem isso, o admin só descobria recarregando a página por acaso.
        toast.error('O WhatsApp desconectou. Escaneie o QR Code novamente para reconectar.');
      }
      conectadoRef.current = !!dados.conectado;
      return dados;
    } catch (err) {
      console.error('Erro ao carregar status do WhatsApp:', err);
      return null;
    }
  }, [toast]);

  useEffect(() => {
    carregarStatus().finally(() => setCarregando(false));
    return pararPoll;
  }, [carregarStatus]);

  // Enquanto tem QR pendente pra escanear, confere a cada 5s se já conectou (sem exigir que o
  // usuário fique clicando em nada — o pareamento no celular é instantâneo do lado do WhatsApp).
  useEffect(() => {
    if (!qrcode) return;
    pollRef.current = setInterval(() => { carregarStatus(); }, INTERVALO_POLL_MS);
    return pararPoll;
  }, [qrcode, carregarStatus]);

  // Já conectado: poll bem mais espaçado só pra detectar uma queda silenciosa da sessão.
  useEffect(() => {
    if (!conectado) return;
    pollLentoRef.current = setInterval(() => { carregarStatus(); }, INTERVALO_POLL_CONECTADO_MS);
    return () => { if (pollLentoRef.current) clearInterval(pollLentoRef.current); };
  }, [conectado, carregarStatus]);

  const enviarTeste = async () => {
    if (!telefoneTeste.trim()) return toast.error('Informe um número de telefone para o teste.');
    setTestando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/testar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: telefoneTeste })
      });
      const dados = await res.json();
      if (res.ok) toast.success('Mensagem de teste enviada! Confira o WhatsApp do número informado.');
      else toast.error(dados.error || 'Não foi possível enviar a mensagem de teste.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setTestando(false);
    }
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/conectar`, { method: 'POST' });
      const dados = await res.json();
      if (!res.ok) return toast.error(dados.error || 'Não foi possível conectar o WhatsApp.');
      setInstancia(dados.instancia);
      setQrcode(dados.qrcode);
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setConectando(false);
    }
  };

  const gerarNovoQrCode = async () => {
    setConectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/qrcode`);
      const dados = await res.json();
      if (!res.ok) return toast.error(dados.error || 'Não foi possível gerar um novo QR Code.');
      setQrcode(dados.qrcode);
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setConectando(false);
    }
  };

  const desconectar = async () => {
    const ok = await confirmar('Desconectar o WhatsApp desta empresa?', {
      detail: 'O bot de agendamento por WhatsApp para de funcionar até conectar de novo (vai precisar escanear o QR Code outra vez, possivelmente com outro número).',
      confirmText: 'Desconectar',
      danger: true
    });
    if (!ok) return;

    setDesconectando(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('WhatsApp desconectado.');
        setConectado(false);
        setInstancia(null);
        setQrcode(null);
      } else {
        toast.error('Não foi possível desconectar.');
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setDesconectando(false);
    }
  };

  const salvarBotConfig = async () => {
    setSalvandoBot(true);
    try {
      const res = await fetch(`${API_URL}/admin/whatsapp/bot-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo: botConfig.modo,
          nome: botConfig.nome,
          personalidade: botConfig.personalidade,
          boas_vindas: botConfig.boasVindas,
          temperatura: botConfig.temperatura,
          resumo_profissionais_ativo: botConfig.resumoProfissionaisAtivo,
          resumo_profissionais_horario: botConfig.resumoProfissionaisHorario,
          horario_ativo: !!botConfig.horarioAtivo,
          horario_inicio: botConfig.horarioInicio || '09:00',
          horario_fim: botConfig.horarioFim || '18:00',
          horario_dias: botConfig.horarioDias && botConfig.horarioDias.length ? botConfig.horarioDias : [0, 1, 2, 3, 4, 5, 6],
          mensagem_fora: botConfig.mensagemFora
        })
      });
      const dados = await res.json();
      if (res.ok) toast.success('Configuração do bot salva.');
      else toast.error(dados.error || 'Não foi possível salvar.');
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setSalvandoBot(false);
    }
  };

  if (carregando) return <p style={{ padding: '40px', textAlign: 'center', color: 'var(--fx-muted)' }}>Carregando...</p>;

  if (!permitido) {
    return (
      <div style={styles.container}>
        <h2 style={styles.title}>WhatsApp</h2>
        <div style={styles.upsell}>
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--fx-muted)' }}>
            Deixar clientes marcarem horário direto pelo WhatsApp é um recurso exclusivo dos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
            Fale com o suporte para fazer upgrade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>WhatsApp</h2>
      <p style={styles.subtitle}>Conecte um número de WhatsApp para seus clientes agendarem horário direto por lá.</p>

      {conectado ? (
        <div style={styles.cardAtual}>
          <div style={styles.linhaTopo}>
            <div>
              <strong style={{ fontSize: '16px' }}>{instancia}</strong>
              <div style={{ marginTop: '4px' }}>
                <span style={{ ...styles.badge, backgroundColor: 'var(--fx-green-bg)', color: 'var(--fx-green)' }}>Conectado</span>
              </div>
            </div>
            <LoadingButton loading={desconectando} onClick={desconectar} style={styles.btnExcluir}>Desconectar</LoadingButton>
          </div>

          <div style={styles.blocoTeste}>
            <p style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: '600', color: 'var(--fx-text)' }}>Testar o envio</p>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'var(--fx-muted)' }}>
              Envie uma mensagem de teste pro seu próprio WhatsApp pra confirmar que a conexão está funcionando. Pra testar o bot de agendamento completo, mande uma mensagem qualquer (ex: "oi") de outro número pra este WhatsApp conectado.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="tel"
                placeholder="Seu número com DDD"
                value={telefoneTeste}
                onChange={(e) => setTelefoneTeste(e.target.value)}
                style={styles.inputTeste}
              />
              <LoadingButton loading={testando} onClick={enviarTeste} style={styles.btnSecundario}>Enviar teste</LoadingButton>
            </div>
          </div>
        </div>
      ) : qrcode ? (
        <div style={styles.cardAtual}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--fx-text)' }}>
            Abra o WhatsApp no celular que vai atender seus clientes e escaneie o QR Code abaixo em
            <strong> Configurações → Aparelhos conectados → Conectar um aparelho</strong>.
          </p>
          <div style={{ textAlign: 'center' }}>
            <img src={qrcode} alt="QR Code de conexão do WhatsApp" style={styles.qrImg} />
          </div>
          <p style={{ margin: '16px 0 0', fontSize: '12px', color: 'var(--fx-muted)', textAlign: 'center' }}>
            Essa página confere sozinha a cada poucos segundos se você já conectou. Se o QR expirar antes de escanear, gere um novo.
          </p>
          <div style={{ textAlign: 'center', marginTop: '14px' }}>
            <LoadingButton loading={conectando} onClick={gerarNovoQrCode} style={styles.btnSecundario}>Gerar novo QR Code</LoadingButton>
          </div>
        </div>
      ) : (
        <div style={styles.cardForm}>
          <p style={{ margin: '0 0 16px', fontSize: '14px', color: 'var(--fx-text)' }}>Nenhum WhatsApp conectado ainda.</p>
          <LoadingButton loading={conectando} onClick={conectar} style={styles.btnCadastrar}>Conectar WhatsApp</LoadingButton>
        </div>
      )}

      <div style={{ ...styles.cardForm, marginTop: '20px' }}>
        <h3 style={styles.tituloSecao}>Personalidade do assistente</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--fx-muted)' }}>
          Personalize como o bot fala com seus clientes.
        </p>

        <label style={styles.label}>Mensagem de boas-vindas</label>
        <input
          type="text"
          placeholder='Ex: "Olá! Bem-vindo à Barbearia do João"'
          value={botConfig.boasVindas}
          maxLength={300}
          onChange={(e) => setBotConfig((c) => ({ ...c, boasVindas: e.target.value }))}
          style={styles.inputTexto}
        />

        {!botConfig.permiteIa ? (
          <div style={{ ...styles.upsell, marginTop: '16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--fx-muted)' }}>
              Modo de conversa, nome, personalidade e criatividade do assistente são recursos de IA, exclusivos dos planos <strong>Profissional</strong> e <strong>Enterprise</strong>.
            </p>
          </div>
        ) : (
          <>
            <label style={{ ...styles.label, marginTop: '16px' }}>Modo de conversa</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setBotConfig((c) => ({ ...c, modo: 'guiado' }))}
                style={botConfig.modo === 'guiado' ? styles.modoBtnAtivo : styles.modoBtn}
              >
                Guiado (menu fixo)
              </button>
              <button
                type="button"
                onClick={() => setBotConfig((c) => ({ ...c, modo: 'livre' }))}
                style={botConfig.modo === 'livre' ? styles.modoBtnAtivo : styles.modoBtn}
              >
                Livre (IA conduz a conversa)
              </button>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>
              {botConfig.modo === 'livre'
                ? 'A IA conversa livremente com o cliente, decidindo quando checar horários, cadastrar e agendar.'
                : 'O bot segue um menu numerado fixo, entendendo texto livre só pra identificar a intenção inicial.'}
            </p>

            <label style={{ ...styles.label, marginTop: '16px' }}>Nome do assistente</label>
            <input
              type="text"
              placeholder="Ex: Bia"
              value={botConfig.nome}
              maxLength={40}
              onChange={(e) => setBotConfig((c) => ({ ...c, nome: e.target.value }))}
              style={styles.inputTexto}
            />

            <label style={{ ...styles.label, marginTop: '16px' }}>Personalidade</label>
            <textarea
              placeholder="Ex: descontraída, usa gírias e emojis, trata o cliente com intimidade"
              value={botConfig.personalidade}
              maxLength={1000}
              onChange={(e) => setBotConfig((c) => ({ ...c, personalidade: e.target.value }))}
              style={styles.textarea}
            />

            <label style={{ ...styles.label, marginTop: '16px' }}>
              Criatividade das respostas: {Number(botConfig.temperatura).toFixed(1)}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={botConfig.temperatura}
              onChange={(e) => setBotConfig((c) => ({ ...c, temperatura: Number(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>
              Mais baixo = respostas mais previsíveis e diretas. Mais alto = respostas mais variadas e criativas.
            </p>
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <LoadingButton loading={salvandoBot} onClick={salvarBotConfig} style={styles.btnCadastrar}>Salvar</LoadingButton>
        </div>
      </div>

      <div style={{ ...styles.cardForm, marginTop: '20px' }}>
        <h3 style={styles.tituloSecao}>Horário de atendimento do bot</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--fx-muted)' }}>
          Escolha se o bot responde seus clientes a qualquer hora ou só em um horário. Fora do horário ele avisa uma vez
          que está fechado e fica quieto até abrir de novo. Lembretes e confirmações de agendamento continuam saindo normalmente.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setBotConfig((c) => ({ ...c, horarioAtivo: false }))}
            style={!botConfig.horarioAtivo ? styles.modoBtnAtivo : styles.modoBtn}
          >
            Ligado 24 horas
          </button>
          <button
            type="button"
            onClick={() => setBotConfig((c) => ({ ...c, horarioAtivo: true }))}
            style={botConfig.horarioAtivo ? styles.modoBtnAtivo : styles.modoBtn}
          >
            Só em um horário
          </button>
        </div>

        {botConfig.horarioAtivo && (
          <>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
              <div>
                <label style={styles.label}>Das</label>
                <input
                  type="time"
                  value={botConfig.horarioInicio}
                  onChange={(e) => setBotConfig((c) => ({ ...c, horarioInicio: e.target.value }))}
                  style={{ ...styles.inputTexto, maxWidth: '160px' }}
                />
              </div>
              <div>
                <label style={styles.label}>Até</label>
                <input
                  type="time"
                  value={botConfig.horarioFim}
                  onChange={(e) => setBotConfig((c) => ({ ...c, horarioFim: e.target.value }))}
                  style={{ ...styles.inputTexto, maxWidth: '160px' }}
                />
              </div>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>
              Horário de Brasília. Pode passar da meia-noite (ex: das 18:00 até 02:00).
            </p>

            <label style={{ ...styles.label, marginTop: '16px' }}>Dias</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((rotulo, dia) => {
                const marcado = (botConfig.horarioDias || []).includes(dia);
                return (
                  <button
                    key={rotulo}
                    type="button"
                    aria-pressed={marcado}
                    onClick={() => setBotConfig((c) => {
                      const dias = c.horarioDias || [];
                      const novos = dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia];
                      return { ...c, horarioDias: novos.length ? novos : dias }; // pelo menos um dia
                    })}
                    style={{ ...(marcado ? styles.modoBtnAtivo : styles.modoBtn), padding: '8px 12px', minWidth: '52px' }}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>

            <label style={{ ...styles.label, marginTop: '16px' }}>Mensagem fora do horário</label>
            <textarea
              rows={3}
              maxLength={500}
              placeholder={botConfig.mensagemForaPadrao}
              value={botConfig.mensagemFora}
              onChange={(e) => setBotConfig((c) => ({ ...c, mensagemFora: e.target.value }))}
              style={{ ...styles.inputTexto, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>
              Deixe em branco pra usar a mensagem padrão. Escreva {'{volta}'} onde quiser que apareça quando o atendimento volta (ex: "amanhã às 09:00").
            </p>
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <LoadingButton loading={salvandoBot} onClick={salvarBotConfig} style={styles.btnCadastrar}>Salvar</LoadingButton>
        </div>
      </div>

      <div style={{ ...styles.cardForm, marginTop: '20px' }}>
        <h3 style={styles.tituloSecao}>Resumo diário para os profissionais</h3>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--fx-muted)' }}>
          Todo dia, no horário definido abaixo, cada profissional ativo com telefone cadastrado (em Equipe) recebe uma
          mensagem no WhatsApp com os próprios atendimentos do dia.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '600', color: 'var(--fx-text)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={botConfig.resumoProfissionaisAtivo}
            onChange={(e) => setBotConfig((c) => ({ ...c, resumoProfissionaisAtivo: e.target.checked }))}
            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
          />
          Enviar resumo diário automaticamente
        </label>

        {botConfig.resumoProfissionaisAtivo && (
          <>
            <label style={{ ...styles.label, marginTop: '16px' }}>Horário de envio</label>
            <input
              type="time"
              value={botConfig.resumoProfissionaisHorario}
              onChange={(e) => setBotConfig((c) => ({ ...c, resumoProfissionaisHorario: e.target.value }))}
              style={{ ...styles.inputTexto, maxWidth: '160px' }}
            />
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--fx-faint)' }}>Horário de Brasília.</p>
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <LoadingButton loading={salvandoBot} onClick={salvarBotConfig} style={styles.btnCadastrar}>Salvar</LoadingButton>
        </div>
      </div>
    </div>
  );
}


const styles = {
  container: { padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: "'Inter', -apple-system, sans-serif" },
  title: { fontFamily: 'var(--oc-display)', fontWeight: 400, fontSize: 'clamp(44px, 5.4vw, 76px)', lineHeight: 0.92, textTransform: 'uppercase', letterSpacing: '0.005em', color: 'var(--fx-text)', margin: '0 0 10px 0' },
  subtitle: { color: 'var(--fx-muted)', fontSize: '15px', marginBottom: '25px' },
  upsell: { padding: '20px', backgroundColor: 'var(--fx-surface-2)', borderRadius: '10px', border: '1px dashed var(--fx-line-2)' },
  cardForm: { backgroundColor: 'var(--fx-card)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--fx-line)' },
  cardAtual: { backgroundColor: 'var(--fx-card)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid var(--fx-line)' },
  linhaTopo: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' },
  badge: { display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' },
  btnCadastrar: { padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  btnSecundario: { padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', cursor: 'pointer', fontSize: '13px' },
  btnExcluir: { padding: '8px 14px', borderRadius: '6px', border: '1px solid var(--fx-red-line)', background: 'var(--fx-red-bg)', color: 'var(--fx-red)', cursor: 'pointer', fontSize: '13px' },
  qrImg: { width: '220px', maxWidth: '100%', height: 'auto', aspectRatio: '1', border: '1px solid var(--fx-line)', borderRadius: '8px', padding: '8px' },
  blocoTeste: { marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--fx-line)' },
  inputTeste: { flex: '1 1 200px', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', fontSize: '13px' },
  tituloSecao: { fontSize: '17px', color: 'var(--fx-text)', fontWeight: '700', margin: '0 0 4px' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--fx-text)', marginBottom: '6px' },
  inputTexto: { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', fontSize: '13px', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: '80px', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--fx-line-2)', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  modoBtn: { padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-text)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' },
  modoBtnAtivo: { padding: '10px 16px', borderRadius: '8px', border: '1px solid #2554eb', background: 'var(--fx-violet-bg)', color: 'var(--fx-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }
};

export default AdminWhatsapp;
