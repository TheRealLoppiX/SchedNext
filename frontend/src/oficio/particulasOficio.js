import * as THREE from 'three';

// Nuvem de partículas que se transforma no símbolo de cada
// ofício conforme a rolagem: poeira dourada (abertura) -> tesoura (barbearia) -> secador (salão)
// -> esmalte (unhas) -> gota de sérum (estética) -> poste de barbeiro 3D (como funciona) ->
// grade de horários (agenda). Formas planas são desenhadas num canvas 2D e amostradas por pixel.

const LADO = 360;

function amostrarDesenho(desenhar, n, escala = 4.2) {
  const c = document.createElement('canvas');
  c.width = LADO;
  c.height = LADO;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  desenhar(ctx);
  const dados = ctx.getImageData(0, 0, LADO, LADO).data;
  const cheios = [];
  for (let y = 0; y < LADO; y += 1) {
    for (let x = 0; x < LADO; x += 1) {
      if (dados[(y * LADO + x) * 4 + 3] > 128) cheios.push(x, y);
    }
  }
  const out = new Float32Array(n * 3);
  const total = cheios.length / 2;
  for (let i = 0; i < n; i++) {
    const k = Math.floor(Math.random() * total) * 2;
    const jx = Math.random() - 0.5;
    const jy = Math.random() - 0.5;
    out[i * 3] = ((cheios[k] + jx) / LADO - 0.5) * escala;
    out[i * 3 + 1] = -((cheios[k + 1] + jy) / LADO - 0.5) * escala;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
  }
  return out;
}

const DESENHOS = {
  tesoura(ctx) {
    // tesoura aberta em V: argolas embaixo, lâminas abrindo pra cima
    ctx.save();
    ctx.translate(180, 196);
    [-1, 1].forEach((lado) => {
      ctx.save();
      ctx.rotate(lado * 0.3);
      // lâmina: larga no pivô, afinando até a ponta
      ctx.beginPath();
      ctx.moveTo(-15 * lado, 12);
      ctx.quadraticCurveTo(-20 * lado, -80, -3 * lado, -172);
      ctx.lineTo(6 * lado, -165);
      ctx.quadraticCurveTo(14 * lado, -80, 13 * lado, 12);
      ctx.closePath();
      ctx.fill();
      // haste
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(4 * lado, 62);
      ctx.stroke();
      // argola
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.ellipse(12 * lado, 104, 30, 40, lado * 0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(0, 4, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(0, 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
  secador(ctx) {
    ctx.save();
    ctx.translate(165, 150);
    // corpo
    ctx.beginPath();
    ctx.arc(-40, 0, 72, 0, Math.PI * 2);
    ctx.fill();
    // bico
    ctx.beginPath();
    ctx.moveTo(10, -46);
    ctx.lineTo(128, -30);
    ctx.lineTo(128, 30);
    ctx.lineTo(10, 46);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(124, -38, 18, 76);
    // cabo
    ctx.beginPath();
    ctx.moveTo(-70, 40);
    ctx.lineTo(-16, 40);
    ctx.lineTo(4, 170);
    ctx.quadraticCurveTo(-24, 184, -52, 170);
    ctx.closePath();
    ctx.fill();
    // grade de ar (vazada)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = 7;
    [22, 40].forEach((r) => {
      ctx.beginPath();
      ctx.arc(-40, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  },
  esmalte(ctx) {
    ctx.save();
    ctx.translate(180, 180);
    // tampa alta
    ctx.beginPath();
    ctx.roundRect(-30, -165, 60, 120, 12);
    ctx.fill();
    ctx.fillRect(-40, -52, 80, 16);
    // frasco
    ctx.beginPath();
    ctx.roundRect(-92, -34, 184, 184, 44);
    ctx.fill();
    // reflexo vazado
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.roundRect(-66, -10, 18, 120, 9);
    ctx.fill();
    ctx.restore();
  },
  gota(ctx) {
    ctx.save();
    ctx.translate(180, 196);
    ctx.beginPath();
    ctx.moveTo(0, -165);
    ctx.bezierCurveTo(40, -90, 118, -10, 118, 52);
    ctx.bezierCurveTo(118, 118, 64, 150, 0, 150);
    ctx.bezierCurveTo(-64, 150, -118, 118, -118, 52);
    ctx.bezierCurveTo(-118, -10, -40, -90, 0, -165);
    ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(-52, 60, 14, 34, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};

function formaPoeira(n) {
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = Math.pow(Math.random(), 0.6) * 4.2;
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    out[i * 3] = Math.sin(b) * Math.cos(a) * r * 1.5;
    out[i * 3 + 1] = Math.cos(b) * r;
    out[i * 3 + 2] = Math.sin(b) * Math.sin(a) * r * 0.6;
  }
  return out;
}

// Poste de barbeiro: partículas na superfície de um cilindro, listras em espiral
// (ciano / branco / azul, cores da logo). Guarda ângulo e altura pra girar a cada quadro.
function formaPoste(n) {
  const base = new Float32Array(n * 3);
  const cores = new Float32Array(n * 3);
  const vermelho = new THREE.Color('#22d3ee');
  const azul = new THREE.Color('#2554eb');
  const branco = new THREE.Color('#f2f7ff');
  for (let i = 0; i < n; i++) {
    const tampa = i < n * 0.12;
    let ang = Math.random() * Math.PI * 2;
    let y;
    let r = 0.62;
    if (tampa) {
      y = Math.random() < 0.5 ? 1.95 + Math.random() * 0.25 : -1.95 - Math.random() * 0.25;
      r = 0.75 + Math.random() * 0.08;
    } else {
      y = (Math.random() - 0.5) * 3.8;
    }
    base[i * 3] = ang;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = r;
    let cor;
    if (tampa) cor = new THREE.Color('#d8dde8');
    else {
      const faixa = ((ang / (Math.PI * 2)) * 3 + y * 0.55) % 1;
      const f = (faixa + 1) % 1;
      cor = f < 0.3 ? vermelho : f < 0.5 ? branco : f < 0.8 ? azul : branco;
    }
    cores[i * 3] = cor.r;
    cores[i * 3 + 1] = cor.g;
    cores[i * 3 + 2] = cor.b;
  }
  return { base, cores };
}

// Grade de horários: 7 colunas (dias) x 9 linhas (horários), cada célula um quadradinho.
function formaGrade(n) {
  const out = new Float32Array(n * 3);
  const cols = 7;
  const rows = 9;
  const w = 0.48;
  const h = 0.34;
  const gap = 0.1;
  const larg = cols * (w + gap);
  const alt = rows * (h + gap);
  const ocupadas = new Set();
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let k = 0; k < 34; k++) ocupadas.add(Math.floor(rnd() * cols * rows));
  const marcaOcupada = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const cel = Math.floor(Math.random() * cols * rows);
    const cx = cel % cols;
    const cy = Math.floor(cel / cols);
    const ocup = ocupadas.has(cel);
    // células livres: só contorno; ocupadas: preenchidas
    let px;
    let py;
    if (ocup) {
      px = Math.random() * w;
      py = Math.random() * h;
    } else {
      const t = Math.random() * 2 * (w + h);
      if (t < w) { px = t; py = 0; } else if (t < w + h) { px = w; py = t - w; } else if (t < 2 * w + h) { px = t - w - h; py = h; } else { px = 0; py = t - 2 * w - h; }
    }
    out[i * 3] = cx * (w + gap) + px - larg / 2;
    out[i * 3 + 1] = -(cy * (h + gap) + py) + alt / 2;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
    marcaOcupada[i] = ocup ? 1 : 0;
  }
  return { pos: out, marcaOcupada };
}

function paleta(n, cores, pesos) {
  const out = new Float32Array(n * 3);
  const cs = cores.map((c) => new THREE.Color(c));
  for (let i = 0; i < n; i++) {
    let r = Math.random();
    let k = 0;
    while (k < pesos.length - 1 && r > pesos[k]) { r -= pesos[k]; k++; }
    const c = cs[k];
    const v = 0.85 + Math.random() * 0.3;
    out[i * 3] = c.r * v;
    out[i * 3 + 1] = c.g * v;
    out[i * 3 + 2] = c.b * v;
  }
  return out;
}

// Toda a animação por partícula (transformação entre formas, redemoinho, respiração, giro do poste
// e repulsão do mouse) roda no shader: a CPU só troca uniforms a cada quadro, sem laço de 8 mil
// partículas nem reenvio de buffers pra GPU. Os buffers de cada forma sobem uma vez só.
const VERT = `
  attribute vec3 posA;
  attribute vec3 posB;
  attribute vec3 corA;
  attribute vec3 corB;
  attribute float tam;
  attribute float atraso;
  attribute float fase;
  uniform float uPx;
  uniform float uFrac;
  uniform float uTempo;
  uniform float uPosteA;
  uniform float uPosteB;
  uniform float uAbertura;
  uniform vec2 uMouse;
  varying vec3 vCor;
  varying float vAlfa;

  vec3 forma(vec3 p, float poste) {
    // poste guarda (ângulo, altura, raio) e gira com o tempo
    if (poste > 0.5) {
      float ang = p.x + uTempo * 0.9;
      return vec3(cos(ang) * p.z, p.y, sin(ang) * p.z);
    }
    return p;
  }

  void main() {
    // cada partícula tem seu próprio atraso: a transformação "varre" o objeto
    float t = clamp((uFrac - atraso * 0.45) / 0.55, 0.0, 1.0);
    float e = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(forma(posA, uPosteA), forma(posB, uPosteB), e);
    float redemoinho = sin(3.14159265 * e) * 1.3;
    float ang = fase + uTempo * 0.4;
    p += vec3(cos(ang) * redemoinho, sin(ang * 1.3) * redemoinho * 0.7, sin(ang) * redemoinho);
    // respiração
    float resp = (uAbertura > 0.5 && e < 0.5) ? 0.12 : 0.025;
    p.x += sin(uTempo * 1.1 + fase) * resp;
    p.y += cos(uTempo * 0.9 + fase * 1.7) * resp;
    // repulsão do mouse
    vec2 d = p.xy - uMouse;
    float d2 = dot(d, d);
    if (d2 < 0.8) p.xy += d * (0.8 - d2) * 3.0;

    vCor = mix(corA, corB, e);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = tam * uPx * (6.0 / -mv.z);
    vAlfa = smoothstep(18.0, 4.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = `
  varying vec3 vCor;
  varying float vAlfa;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vCor * (0.75 + a * 1.1), a * vAlfa);
  }
`;

// Níveis de qualidade: 0 = cheio, 1 = médio, 2 = leve (notebook fraco, GPU integrada antiga,
// renderização por software). Começa por um palpite do hardware e desce sozinho se o FPS cair.
const NIVEIS = [
  { dpr: 1.75, fracao: 1, intervalo: 0 },
  { dpr: 1.25, fracao: 0.72, intervalo: 0 },
  { dpr: 1, fracao: 0.5, intervalo: 1 / 32 }
];

function nivelInicial(renderer) {
  let nivel = 0;
  const nucleos = navigator.hardwareConcurrency || 4;
  const memoria = navigator.deviceMemory || 8;
  if (nucleos <= 2 || memoria <= 2) nivel = 2;
  else if (nucleos <= 4 || memoria <= 4) nivel = 1;
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    if (/swiftshader|llvmpipe|software|basic render/i.test(gpu)) nivel = 2;
    else if (/intel.*\b(hd|uhd)\b|mali-[gt]?\d{1,3}\b|adreno.*\b[1-5]\d\d\b|powervr/i.test(gpu)) nivel = Math.max(nivel, 1);
  } catch (e) { /* sem info da GPU: fica o palpite pelos núcleos */ }
  return nivel;
}

export function criarParticulas(canvas, { mobile = false, reduzirMovimento = false, aoMudarNivel } = {}) {
  const N = mobile ? 3800 : 8000;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  let nivel = nivelInicial(renderer);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
  camera.position.set(0, 0, 8);

  const poste = formaPoste(N);
  const grade = formaGrade(N);

  // formas na ordem dos capítulos (poste guarda ângulo/altura/raio, girado no shader)
  const formas = [
    { pos: formaPoeira(N), cor: paleta(N, ['#22d3ee', '#e6fbff', '#2554eb'], [0.5, 0.25, 0.25]) },
    { pos: amostrarDesenho(DESENHOS.tesoura, N, 4.4), cor: paleta(N, ['#4c7dff', '#eaf1ff', '#22d3ee'], [0.5, 0.25, 0.25]) },
    { pos: amostrarDesenho(DESENHOS.secador, N, 4.3), cor: paleta(N, ['#22d3ee', '#effdff', '#0ea5e9'], [0.5, 0.25, 0.25]) },
    { pos: amostrarDesenho(DESENHOS.esmalte, N, 4.1), cor: paleta(N, ['#38bdf8', '#eef8ff', '#2554eb'], [0.5, 0.25, 0.25]) },
    { pos: amostrarDesenho(DESENHOS.gota, N, 4.0), cor: paleta(N, ['#2ee6d0', '#effffc', '#22d3ee'], [0.5, 0.25, 0.25]) },
    { pos: poste.base, cor: poste.cores, poste: true },
    { pos: grade.pos, cor: (() => {
      const c = new Float32Array(N * 3);
      const livre = new THREE.Color('#3b6cf0');
      const ocup = new THREE.Color('#5ee8f5');
      for (let i = 0; i < N; i++) {
        const k = grade.marcaOcupada[i] ? ocup : livre;
        c[i * 3] = k.r; c[i * 3 + 1] = k.g; c[i * 3 + 2] = k.b;
      }
      return c;
    })() }
  ].map((f) => ({ ...f, attrPos: new THREE.BufferAttribute(f.pos, 3), attrCor: new THREE.BufferAttribute(f.cor, 3) }));

  const tam = new Float32Array(N);
  const atraso = new Float32Array(N);
  const fase = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    atraso[i] = Math.random();
    fase[i] = Math.random() * Math.PI * 2;
    tam[i] = 0.6 + Math.random() * 1.1;
  }

  const geo = new THREE.BufferGeometry();
  // "position" só pro three.js saber quantos vértices desenhar; a posição real vem de posA/posB
  geo.setAttribute('position', formas[0].attrPos);
  geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('atraso', new THREE.BufferAttribute(atraso, 1));
  geo.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  const uniforms = {
    uPx: { value: 1 },
    uFrac: { value: 0 },
    uTempo: { value: 0 },
    uPosteA: { value: 0 },
    uPosteB: { value: 0 },
    uAbertura: { value: 1 },
    uMouse: { value: new THREE.Vector2(99, 99) }
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const pontos = new THREE.Points(geo, mat);
  pontos.frustumCulled = false;
  const grupo = new THREE.Group();
  grupo.add(pontos);
  cena.add(grupo);

  let parA = -1;
  let parB = -1;
  function usarPar(a, b) {
    if (a === parA && b === parB) return;
    parA = a;
    parB = b;
    geo.setAttribute('posA', formas[a].attrPos);
    geo.setAttribute('posB', formas[b].attrPos);
    geo.setAttribute('corA', formas[a].attrCor);
    geo.setAttribute('corB', formas[b].attrCor);
    uniforms.uPosteA.value = formas[a].poste ? 1 : 0;
    uniforms.uPosteB.value = formas[b].poste ? 1 : 0;
  }
  usarPar(0, 1);

  function redimensionar() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }
  function aplicarNivel() {
    const q = NIVEIS[nivel];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? Math.min(1.5, q.dpr) : q.dpr));
    redimensionar();
    geo.setDrawRange(0, Math.round(N * q.fracao));
    // menos partículas, cada uma um pouco maior: a forma continua cheia
    uniforms.uPx.value = renderer.getPixelRatio() * (mobile ? 3.0 : 3.8) * Math.pow(1 / q.fracao, 0.35);
    if (aoMudarNivel) aoMudarNivel(nivel);
  }
  aplicarNivel();
  window.addEventListener('resize', redimensionar);

  const estado = { alvo: 0, atual: 0, mx: 9, my: 9, mxS: 9, myS: 9 };
  let tempo = 0;
  let quadro = null;
  let ativo = true;
  let ultimo = 0;
  let acumulado = 0;
  // medidor de FPS: janela de quadros depois de um aquecimento (decodificação das imagens e
  // compilação do shader no começo não contam)
  const medidor = { desde: performance.now() + 2500, soma: 0, n: 0 };

  function medir(agora, dtReal) {
    if (nivel >= NIVEIS.length - 1 || agora < medidor.desde || document.hidden) return;
    medidor.soma += dtReal;
    medidor.n++;
    if (medidor.n < 90) return;
    const media = medidor.soma / medidor.n;
    medidor.soma = 0;
    medidor.n = 0;
    if (media > 1 / 42) {
      nivel++;
      aplicarNivel();
      medidor.desde = agora + 2000;
    }
  }

  function atualizar(agora) {
    quadro = requestAnimationFrame(atualizar);
    const dtReal = ultimo ? Math.min((agora - ultimo) / 1000, 0.25) : 1 / 60;
    ultimo = agora;
    medir(agora, dtReal);
    // nível leve: desenha a ~30 fps (o resto da página continua no ritmo da tela)
    acumulado += dtReal;
    const intervalo = NIVEIS[nivel].intervalo;
    if (acumulado < intervalo) return;
    const dt = Math.min(acumulado, 0.05);
    acumulado = intervalo ? acumulado % intervalo : 0;

    const k60 = (f) => 1 - Math.pow(1 - f, dt * 60);
    tempo += dt * (reduzirMovimento ? 0.3 : 1);
    estado.atual += (estado.alvo - estado.atual) * (1 - Math.pow(0.002, dt));
    estado.mxS += (estado.mx - estado.mxS) * k60(0.15);
    estado.myS += (estado.my - estado.myS) * k60(0.15);

    const s = Math.min(formas.length - 1, Math.max(0, estado.atual));
    const a = Math.floor(s);
    const b = Math.min(formas.length - 1, a + 1);
    const frac = s - a;
    usarPar(a, b);

    // posição do objeto: à direita no desktop, em cima no celular
    const alvoX = mobile ? 0 : (a === 0 && frac < 0.5 ? 0.6 : 2.15);
    const alvoY = mobile ? 1.15 : 0;
    grupo.position.x += (alvoX - grupo.position.x) * k60(0.06);
    grupo.position.y += (alvoY - grupo.position.y) * k60(0.06);
    const escalaMobile = mobile ? 0.54 : 1;
    grupo.scale.setScalar(escalaMobile);
    const emGrade = (a === 6 || (a === 5 && frac > 0.5));
    grupo.rotation.y = emGrade ? grupo.rotation.y * Math.pow(0.9, dt * 60) : Math.sin(tempo * 0.35) * 0.28;
    grupo.rotation.x = Math.sin(tempo * 0.27) * 0.08;

    // mouse no plano do objeto (coordenadas de mundo aproximadas)
    const mundoMX = (estado.mxS * 0.5) * 8 * camera.aspect * 0.36 - grupo.position.x;
    const mundoMY = (-estado.myS * 0.5) * 8 * 0.36 - grupo.position.y;
    uniforms.uMouse.value.set(mundoMX / escalaMobile, mundoMY / escalaMobile);
    uniforms.uFrac.value = frac;
    uniforms.uTempo.value = tempo;
    uniforms.uAbertura.value = a === 0 ? 1 : 0;

    renderer.render(cena, camera);
  }
  quadro = requestAnimationFrame(atualizar);

  return {
    // s: índice contínuo da forma (0 = poeira ... 6 = grade)
    setForma(s) { estado.alvo = s; },
    setMouse(x, y) { estado.mx = x; estado.my = y; },
    // palco fora da tela: para de desenhar (e de gastar GPU) até voltar
    setAtivo(v) {
      if (v === ativo) return;
      ativo = v;
      if (v) {
        ultimo = 0;
        medidor.desde = performance.now() + 1500;
        quadro = requestAnimationFrame(atualizar);
      } else cancelAnimationFrame(quadro);
    },
    destruir() {
      cancelAnimationFrame(quadro);
      window.removeEventListener('resize', redimensionar);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    }
  };
}
