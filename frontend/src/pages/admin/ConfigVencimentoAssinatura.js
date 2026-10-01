import { useEffect, useState } from 'react';
import { useConfirm } from '../../components/ConfirmDialog';
import LoadingButton from '../../components/LoadingButton';
import { API_URL } from '../../services/api';

// Vencimento das mensalidades dos assinantes (ver backend/src/services/vencimentoAssinatura.js):
// na data em que cada cliente assinou (padrão) ou em dias fixos do mês escolhidos pela empresa.
const REGRAS = [
  ['proporcional', 'Proporcional', 'Paga ao assinar só os dias até o vencimento. Depois, o valor cheio todo mês no dia escolhido.'],
  ['cheia_ciclo_longo', 'Valor cheio, 1º mês mais longo', 'Paga o valor cheio ao assinar e o primeiro ciclo vai até o dia escolhido depois de completar 1 mês.'],
  ['no_dia_fixo', 'Só no dia escolhido', 'Não paga nada ao assinar: o plano já vale e a primeira cobrança é no dia escolhido.']
];
const DIAS_DO_MES = Array.from({ length: 28 }, (_, i) => i + 1);

function ConfigVencimentoAssinatura({ onFeedback }) {
  const confirmar = useConfirm();
  const [config, setConfig] = useState(null);
  const [migrarAtuais, setMigrarAtuais] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const carregar = () => {
    fetch(`${API_URL}/admin/assinatura-config`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setConfig(d))
      .catch(() => {});
  };
  useEffect(carregar, []);

  if (!config) return null;

  const diasFixos = config.modo_vencimento === 'dias_fixos';
  const alternarDia = (dia) => setConfig((c) => ({
    ...c,
    dias_vencimento: c.dias_vencimento.includes(dia) ? c.dias_vencimento.filter((d) => d !== dia) : [...c.dias_vencimento, dia].sort((a, b) => a - b)
  }));

  const salvar = async () => {
    if (diasFixos && config.dias_vencimento.length === 0) return onFeedback('Escolha ao menos um dia de vencimento.', 'erro');
    if (diasFixos && migrarAtuais) {
      const ok = await confirmar('Passar quem já assina para os dias fixos?', {
        detail: 'A troca acontece na próxima cobrança de cada assinante, seguindo a regra de primeira cobrança escolhida. Quem paga no cartão continua na data atual (dá pra mudar um a um em Clientes).',
        confirmText: 'Aplicar'
      });
      if (!ok) return;
    }
    setSalvando(true);
    try {
      const res = await fetch(`${API_URL}/admin/assinatura-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modo_vencimento: config.modo_vencimento,
          dias_vencimento: config.dias_vencimento,
          primeira_cobranca: config.primeira_cobranca,
          migrar_atuais: diasFixos && migrarAtuais
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onFeedback(data.message || 'Configuração salva.');
        setMigrarAtuais(false);
        carregar();
      } else {
        onFeedback(data.detalhes?.[0]?.mensagem || data.error || 'Não foi possível salvar.', 'erro');
      }
    } catch (err) {
      onFeedback('Erro de conexão.', 'erro');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div style={st.card}>
      <div>
        <h4 style={st.titulo}>Vencimento das mensalidades</h4>
        <p style={st.dica}>Quando a cobrança automática (Pix ou cartão) dos assinantes vence.</p>
      </div>

      <div style={st.opcoes}>
        {[['data_assinatura', 'Na data em que o cliente assinou', 'Quem assinou dia 17 paga todo dia 17.'],
          ['dias_fixos', 'Em dias fixos do mês', 'Você escolhe os dias (ex: 5 e 10) e o cliente escolhe um deles ao assinar.']].map(([valor, rotulo, desc]) => (
          <label key={valor} style={{ ...st.opcao, ...(config.modo_vencimento === valor ? st.opcaoAtiva : {}) }}>
            <input type="radio" name="modo_vencimento" checked={config.modo_vencimento === valor} onChange={() => setConfig((c) => ({ ...c, modo_vencimento: valor }))} style={st.radio} />
            <span>
              <strong style={st.opcaoTitulo}>{rotulo}</strong>
              <span style={st.opcaoDesc}>{desc}</span>
            </span>
          </label>
        ))}
      </div>

      {diasFixos && (
        <>
          <div>
            <label style={st.label}>Dias de vencimento</label>
            <div style={st.gradeDias}>
              {DIAS_DO_MES.map((dia) => {
                const marcado = config.dias_vencimento.includes(dia);
                return (
                  <button key={dia} type="button" aria-pressed={marcado} onClick={() => alternarDia(dia)} style={{ ...st.dia, ...(marcado ? st.diaAtivo : {}) }}>{dia}</button>
                );
              })}
            </div>
            <p style={st.dica}>Dias de 1 a 28, pra todo mês ter o dia.</p>
          </div>

          <div>
            <label style={st.label}>Primeira cobrança de quem assina entre os vencimentos (Pix)</label>
            <div style={st.opcoes}>
              {REGRAS.map(([valor, rotulo, desc]) => (
                <label key={valor} style={{ ...st.opcao, ...(config.primeira_cobranca === valor ? st.opcaoAtiva : {}) }}>
                  <input type="radio" name="primeira_cobranca" checked={config.primeira_cobranca === valor} onChange={() => setConfig((c) => ({ ...c, primeira_cobranca: valor }))} style={st.radio} />
                  <span>
                    <strong style={st.opcaoTitulo}>{rotulo}</strong>
                    <span style={st.opcaoDesc}>{desc}</span>
                  </span>
                </label>
              ))}
            </div>
            <p style={st.dica}>No cartão, a primeira cobrança é sempre no dia escolhido, e o plano já vale desde a assinatura.</p>
          </div>

          <label style={st.check}>
            <input type="checkbox" checked={migrarAtuais} onChange={(e) => setMigrarAtuais(e.target.checked)} style={st.radio} />
            <span>
              <strong style={st.opcaoTitulo}>Aplicar também a quem já assina</strong>
              <span style={st.opcaoDesc}>
                A troca acontece na próxima cobrança de cada um, com a regra acima. Quem paga no cartão continua na data atual.
                {config.migracoes_agendadas > 0 && ` ${config.migracoes_agendadas} assinante(s) já com a troca agendada.`}
              </span>
            </span>
          </label>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <LoadingButton loading={salvando} onClick={salvar} style={st.btn}>Salvar vencimento</LoadingButton>
      </div>
    </div>
  );
}

const st = {
  card: { background: 'var(--fx-card)', padding: '28px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '30px', border: '1px solid var(--fx-line)', display: 'flex', flexDirection: 'column', gap: '20px' },
  titulo: { margin: 0, color: 'var(--fx-text)', fontSize: '16px', fontWeight: '700' },
  dica: { margin: '6px 0 0', fontSize: '12px', color: 'var(--fx-faint)', lineHeight: 1.4 },
  label: { display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--fx-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  opcoes: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' },
  opcao: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '14px', borderRadius: '10px', border: '1px solid var(--fx-line-2)', cursor: 'pointer', background: 'var(--fx-card)' },
  opcaoAtiva: { borderColor: 'var(--fx-strong)', background: 'var(--fx-surface-2)' },
  opcaoTitulo: { display: 'block', fontSize: '14px', color: 'var(--fx-text)', marginBottom: '2px' },
  opcaoDesc: { display: 'block', fontSize: '12.5px', color: 'var(--fx-muted)', lineHeight: 1.4 },
  radio: { accentColor: 'var(--fx-text)', marginTop: '3px', flexShrink: 0 },
  gradeDias: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: '6px', maxWidth: '420px' },
  dia: { padding: '9px 0', borderRadius: '8px', border: '1px solid var(--fx-line-2)', background: 'var(--fx-card)', color: 'var(--fx-muted)', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },
  diaAtivo: { background: 'var(--fx-strong)', color: '#fff', borderColor: 'var(--fx-strong)' },
  check: { display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: 'pointer' },
  btn: { background: 'linear-gradient(135deg, #4c74f0, #2554eb)', color: '#fff', padding: '12px 22px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700' }
};

export default ConfigVencimentoAssinatura;
