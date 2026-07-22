// Dicionário de terminologia por vertical de negócio. O schema e as rotas continuam
// genéricos (barbeiro/serviço); só o texto exibido muda conforme o tipo de negócio
// da empresa (empresas.vertical). Ver §6 do plano de plataforma.
//
// artigo/artigoContraido existem porque "Barbearia" é feminino e "Salão"/"Estúdio"/
// "Estabelecimento" são masculinos, sem isso frases como "Perfil da/do X" saem erradas
// pra metade das verticais.
const TERMINOLOGIA = {
  barbearia: {
    profissional: 'Barbeiro', profissionalPlural: 'Barbeiros',
    local: 'Barbearia', artigo: 'a', artigoContraido: 'da',
    exemploNome: 'Barbearia do João', emoji: '💈'
  },
  salao: {
    profissional: 'Cabeleireiro', profissionalPlural: 'Cabeleireiros',
    local: 'Salão', artigo: 'o', artigoContraido: 'do',
    exemploNome: 'Salão da Maria', emoji: '💇'
  },
  estudio_unhas: {
    profissional: 'Nail Designer', profissionalPlural: 'Nail Designers',
    local: 'Estúdio', artigo: 'o', artigoContraido: 'do',
    exemploNome: 'Nail Studio da Ana', emoji: '💅'
  },
  generico: {
    profissional: 'Profissional', profissionalPlural: 'Profissionais',
    local: 'Estabelecimento', artigo: 'o', artigoContraido: 'do',
    exemploNome: 'Meu Negócio', emoji: '📋'
  }
};

function obterTerminologia(vertical) {
  return TERMINOLOGIA[vertical] || TERMINOLOGIA.generico;
}

export { TERMINOLOGIA, obterTerminologia };
