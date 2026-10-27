import React from 'react';
import { Link } from 'react-router-dom';
import LogoSchedNext from './LogoSchedNext';

// Metade esquerda das telas de acesso da PLATAFORMA (login do painel, cadastro da empresa,
// recuperação de senha, admin absoluto): marca grande, frase e benefícios, como nos sistemas
// comerciais. Só aparece em telas largas (ver .bb-page-marca em estilo/app-oficio.css); no
// celular fica só o formulário, com a logo no topo do cartão.
//
// Telas do cliente final de uma empresa NÃO usam isto: lá a marca que aparece é a da empresa.
function PainelMarcaAcesso() {
  return (
    <aside className="bb-painel-marca">
      <Link to="/" aria-label="SchedNext, página inicial"><LogoSchedNext tamanho={40} claro /></Link>
      <div className="bb-painel-marca-texto">
        <h2>Sua agenda cheia, sem parar o atendimento.</h2>
        <ul>
          <li>Clientes agendam sozinhos pelo link ou pelo WhatsApp</li>
          <li>Lembretes automáticos que reduzem as faltas</li>
          <li>Agenda, caixa, estoque e relatórios num painel só</li>
        </ul>
      </div>
      <small>© {new Date().getFullYear()} SchedNext</small>
    </aside>
  );
}

export default PainelMarcaAcesso;
