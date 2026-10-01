// Recursos (flags) dos planos da plataforma, numa lista só: o editor de planos do admin absoluto
// e os cards de plano do site leem daqui. Chave nova em planos_plataforma entra aqui e aparece
// nos dois (antes o card do site tinha uma lista própria e ficava sem as chaves novas).
// rotuloAdmin: nome curto no editor; rotuloSite: como o recurso aparece pro cliente no card.
export const RECURSOS_PLANO = [
  { chave: 'permite_paleta_customizada', rotuloAdmin: 'Paleta customizada', rotuloSite: 'Paleta de cores personalizada' },
  { chave: 'permite_whatsapp_bot', rotuloAdmin: 'Bot de WhatsApp', rotuloSite: 'Bot de agendamento no WhatsApp' },
  { chave: 'permite_remover_marca', rotuloAdmin: 'Remover marca', rotuloSite: 'Sem marca "feito com SchedNext"' },
  { chave: 'permite_relatorios_avancados', rotuloAdmin: 'Relatórios avançados', rotuloSite: 'Relatórios avançados' },
  { chave: 'permite_relatorio_produtos', rotuloAdmin: 'Relatório de receita líquida por produto', rotuloSite: 'Receita líquida por produto vendido' },
  { chave: 'permite_ia', rotuloAdmin: 'Recursos com IA', rotuloSite: 'Recursos com IA' },
  { chave: 'permite_multi_unidade', rotuloAdmin: 'Múltiplas unidades', rotuloSite: 'Múltiplas unidades' },
  { chave: 'permite_api_publica', rotuloAdmin: 'API pública', rotuloSite: 'API pública' },
  { chave: 'permite_dominio_customizado', rotuloAdmin: 'Domínio próprio', rotuloSite: 'Subdomínio personalizado' },
  { chave: 'permite_campanhas_assinatura', rotuloAdmin: 'Campanhas promocionais de assinatura', rotuloSite: 'Campanhas promocionais pros seus assinantes' }
];

// Rótulos do site dos recursos ligados num plano, na ordem da lista.
export const recursosDoPlano = (plano) => RECURSOS_PLANO.filter((r) => plano?.[r.chave]).map((r) => r.rotuloSite);
