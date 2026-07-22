import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import useEscToClose from '../hooks/useEscToClose';

const FAQ = [
  {
    q: 'Como eu marco um horário?',
    a: 'Escolha o barbeiro, depois a data e o horário disponível, selecione os serviços desejados e confirme.'
  },
  {
    q: 'Como cancelo um agendamento?',
    a: 'Na aba "Agendamentos" do seu perfil, abra o agendamento e toque em cancelar. Cancelamentos muito em cima da hora podem não ser permitidos.'
  },
  {
    q: 'Esqueci minha senha, e agora?',
    a: 'Na tela de login, toque em "Esqueci minha senha" e siga o código enviado por e-mail.'
  },
  {
    q: 'Sou dono do negócio, como acesso o painel administrativo?',
    a: 'Acesse a área /admin/login com o e-mail e a senha cadastrados da sua empresa.'
  },
  {
    q: 'Como funciona o programa de fidelidade?',
    a: 'Cada atendimento concluído conta para a campanha ativa do negócio. Ao atingir o número necessário, o prêmio é liberado.'
  }
];

// Botão de ajuda persistente + FAQ, a única fonte de ajuda/documentação do app hoje
// (heurística 10, que partiu de zero).
function HelpButton() {
  const [aberto, setAberto] = useState(false);
  const location = useLocation();

  useEscToClose(aberto, () => setAberto(false));

  // Não faz sentido mostrar ajuda de "como cancelar agendamento"/"como acessar o admin"
  // pra quem ainda nem criou conta, a landing pública fica sem o botão.
  if (location.pathname === '/') return null;

  return (
    <>
      <button className="bb-help-fab" onClick={() => setAberto(true)} aria-label="Ajuda" title="Ajuda">
        ?
      </button>
      {aberto && (
        <div className="bb-modal-overlay" onClick={() => setAberto(false)}>
          <div className="bb-help-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="bb-help-header">
              <h3>Perguntas frequentes</h3>
              <button className="bb-help-close" onClick={() => setAberto(false)} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="bb-help-list">
              {FAQ.map((item, i) => (
                <details key={i} className="bb-help-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default HelpButton;
