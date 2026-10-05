// Leitor de planilha (.xlsx e .csv) sem biblioteca externa, usado na importação de prospects do
// admin absoluto. O .xlsx é um zip de XMLs: lemos o diretório central do zip, descompactamos só
// os arquivos necessários com o DecompressionStream nativo do navegador e montamos as linhas de
// cada aba a partir do XML. Cobre o que planilhas de lista precisam (texto, número, fórmula já
// calculada); formatação, datas e estilos são ignorados.

const SIG_FIM_DIRETORIO = 0x06054b50;
const SIG_DIRETORIO = 0x02014b50;

async function descompactar(bytes, metodo) {
  if (metodo === 0) return bytes;
  if (metodo !== 8) throw new Error('Formato de compactação da planilha não suportado.');
  if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não consegue abrir .xlsx. Atualize o navegador ou salve a planilha como .csv.');
  const fluxo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(fluxo).arrayBuffer());
}

function lerZip(buffer) {
  const dv = new DataView(buffer);
  let fim = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 66000); i -= 1) {
    if (dv.getUint32(i, true) === SIG_FIM_DIRETORIO) { fim = i; break; }
  }
  if (fim < 0) throw new Error('Arquivo não parece ser uma planilha .xlsx válida.');

  const total = dv.getUint16(fim + 10, true);
  let pos = dv.getUint32(fim + 16, true);
  const decoder = new TextDecoder();
  const arquivos = {};
  for (let i = 0; i < total; i += 1) {
    if (dv.getUint32(pos, true) !== SIG_DIRETORIO) break;
    const metodo = dv.getUint16(pos + 10, true);
    const tamanho = dv.getUint32(pos + 20, true);
    const tamNome = dv.getUint16(pos + 28, true);
    const tamExtra = dv.getUint16(pos + 30, true);
    const tamComentario = dv.getUint16(pos + 32, true);
    const offsetLocal = dv.getUint32(pos + 42, true);
    const nome = decoder.decode(new Uint8Array(buffer, pos + 46, tamNome));
    arquivos[nome] = { metodo, tamanho, offsetLocal };
    pos += 46 + tamNome + tamExtra + tamComentario;
  }

  return async (nome) => {
    const info = arquivos[nome];
    if (!info) return null;
    const inicio = info.offsetLocal + 30 + dv.getUint16(info.offsetLocal + 26, true) + dv.getUint16(info.offsetLocal + 28, true);
    const bytes = await descompactar(new Uint8Array(buffer, inicio, info.tamanho), info.metodo);
    return new TextDecoder().decode(bytes);
  };
}

const xml = (texto) => new DOMParser().parseFromString(texto, 'application/xml');
const tags = (no, nome) => Array.from(no.getElementsByTagNameNS('*', nome));

function indiceColuna(ref) {
  const letras = String(ref || '').replace(/[0-9]/g, '');
  let indice = 0;
  for (const letra of letras) indice = indice * 26 + (letra.charCodeAt(0) - 64);
  return indice - 1;
}

async function lerXlsx(buffer) {
  const abrir = lerZip(buffer);

  const textoCompartilhado = await abrir('xl/sharedStrings.xml');
  const compartilhadas = textoCompartilhado
    ? tags(xml(textoCompartilhado), 'si').map((si) => tags(si, 't').filter((t) => t.parentNode.localName !== 'rPh').map((t) => t.textContent).join(''))
    : [];

  const relacoes = {};
  const textoRels = await abrir('xl/_rels/workbook.xml.rels');
  if (textoRels) {
    tags(xml(textoRels), 'Relationship').forEach((r) => {
      const alvo = r.getAttribute('Target') || '';
      relacoes[r.getAttribute('Id')] = alvo.startsWith('/') ? alvo.slice(1) : `xl/${alvo}`;
    });
  }

  const workbook = xml(await abrir('xl/workbook.xml'));
  const abas = [];
  for (const aba of tags(workbook, 'sheet')) {
    const idRel = aba.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || aba.getAttribute('r:id');
    const texto = relacoes[idRel] ? await abrir(relacoes[idRel]) : null;
    if (!texto) continue;
    const linhas = [];
    for (const row of tags(xml(texto), 'row')) {
      const linha = [];
      for (const c of tags(row, 'c')) {
        const tipo = c.getAttribute('t');
        let valor;
        if (tipo === 'inlineStr') valor = tags(c, 't').map((t) => t.textContent).join('');
        else {
          const v = tags(c, 'v')[0]?.textContent ?? '';
          valor = tipo === 's' ? compartilhadas[Number(v)] ?? '' : v;
        }
        linha[indiceColuna(c.getAttribute('r'))] = valor;
      }
      linhas[Number(row.getAttribute('r')) - 1 || linhas.length] = Array.from(linha, (v) => v ?? '');
    }
    abas.push({ nome: aba.getAttribute('name'), linhas: Array.from(linhas, (l) => l || []) });
  }
  return abas;
}

function lerCsv(texto) {
  const primeira = texto.split(/\r?\n/)[0] || '';
  const separador = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : ',';
  const linhas = [];
  let linha = [];
  let campo = '';
  let aspas = false;
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (aspas) {
      if (ch === '"' && texto[i + 1] === '"') { campo += '"'; i += 1; }
      else if (ch === '"') aspas = false;
      else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === separador) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && texto[i + 1] === '\n') i += 1;
      linha.push(campo); linhas.push(linha); linha = []; campo = '';
    } else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return [{ nome: 'CSV', linhas }];
}

// Devolve [{ nome, linhas: [[célula, ...], ...] }] — uma entrada por aba.
export async function lerPlanilha(arquivo) {
  const nome = (arquivo.name || '').toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) return lerCsv(await arquivo.text());
  if (nome.endsWith('.xlsx')) return lerXlsx(await arquivo.arrayBuffer());
  throw new Error('Envie a planilha em .xlsx ou .csv.');
}
