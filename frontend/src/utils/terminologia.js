// Termos exibidos na interface pra equipe e pro negócio. São neutros de propósito: a mesma
// empresa pode atender mais de um ramo (ex: barbearia + tatuagem), então nada aqui assume um
// segmento. O schema e as rotas continuam com os nomes antigos (barbeiros/barbeiro_id) — só o
// texto exibido sai daqui. A coluna empresas.vertical ficou no banco, mas não é mais usada.
//
// "Empresa" é feminino, por isso o artigo contraído "da" ("Perfil da Empresa").
const TERMOS = {
  profissional: 'Profissional', profissionalPlural: 'Profissionais',
  local: 'Empresa', artigoContraido: 'da',
  exemploNome: 'Studio Aurora'
};

export { TERMOS };
