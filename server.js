const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const SESSION_SECRET = process.env.SESSION_SECRET;
const REWARD_CODE = process.env.REWARD_CODE;

if (!SESSION_SECRET || !REWARD_CODE || !process.env.ANSWERS_JSON) {
  console.error('Defina SESSION_SECRET, REWARD_CODE e ANSWERS_JSON nas variáveis de ambiente.');
  process.exit(1);
}

let answers;
try {
  answers = JSON.parse(process.env.ANSWERS_JSON);
  if (!Array.isArray(answers) || answers.length !== 11 || !answers.every(value => typeof value === 'string')) throw new Error();
} catch {
  console.error('ANSWERS_JSON deve ser uma lista JSON com exatamente 11 textos.');
  process.exit(1);
}

const chapters = [
  ['Amizade', 'Lembro-me dos dias em que percorríamos Orbis sem temer o amanhã. Bastava-nos a companhia uns dos outros.\n\nUnidos ao redor da fogueira, compartilhávamos histórias e promessas.\n\nZelávamos uns pelos outros como irmãos enquanto sonhávamos com o futuro. Se soubesse o que estava por vir, teria prolongado cada abraço.'],
  ['Catástrofe', 'Jamais esquecerei as ruínas de Zascin. Foi ali que o fogo consumiu meus companheiros e reduziu nossas promessas a pó. O que deveria ser mais uma jornada tornou-se a última.\n\nEntre os destroços encontrei apenas aquilo que as chamas não puderam devorar. Naquele instante, uma parte de mim também morreu.'],
  ['Escuridão', 'Desde aquele dia, meu lar perdeu toda a vida. Escrevi estes versos enquanto esperava uma claridade que jamais chegava.\n\nAinda carrego a dor de tudo que perdi\nMinha existência tornou-se um tormento cruel\nA esperança que me sustentava desapareceu\nAs sombras da noite jamais me abandonam\nJá não reconheço aquele que um dia fui\nEm meus sonhos, ainda escuto a voz de Aedan\nMas, ao despertar, encontro somente a morte\n\nQue alguma luz alcance estas sombras.'],
  ['Inconformismo', 'Dizem que a morte é uma lei inviolável. Recuso-me a acreditar nisso.\n\nEm um tratado antigo, encontrei uma definição: somos aquilo que habita a carne, mas não somos carne. Não temos peso nem forma. Quando o corpo perece, dizem que seguimos para além do mundo dos vivos.\n\nQue nome dão àquilo que ainda procuro em meus companheiros?'],
  ['Tormento', 'Perdi toda a serenidade, roguei aos mortos, esperei em vão, temi o silêncio, odiei o destino, reneguei minhas crenças, neguei a realidade, exigi respostas, maldisse minha existência.\n\nPor que fui poupado? Talvez o verdadeiro castigo tenha sido permanecer vivo.'],
  ['Alento', 'Encontrei um tratado de arcanistas que jamais escreviam seus nomes por inteiro. Cada selo guardava a inicial de uma virtude ou de um temor.\n\n◇ Esperança   △ Retorno   ○ Graça\n□ Ausência   ☆ Memória   ♢ Silêncio\n☽ Vigília   ☉ Destino\n\nNa última folha, encontrei uma inscrição:\n\n◇ △ ○ □ ☆ - ♢ ◇\n\nPela primeira vez desde a tragédia, acreditei que ainda poderia ouvir suas vozes.'],
  ['Chamado', 'Reuni os restos de meus companheiros e preparei o círculo. O fogo vacilava diante do altar. A ausência parecia ocupar todo o recinto. A lágrima que derramei caiu sobre a pedra. Minha esperança resistia. A memória deles guiava minhas mãos.\n\nNo fogo depositei nossas promessas. Contra a ausência ergui minha voz. Com uma lágrima tracei o último selo. Pela esperança desafiei a morte. Pela memória pedi apenas uma despedida.\n\nOs ossos começaram a se mover. Eu havia conseguido. Ou assim acreditava.'],
  ['Arrependimento', 'Tentaram falar, mas suas vozes já não eram as mesmas. Minha saudade tornara-se a prisão daqueles que desejava libertar.\n\nCada letra possui seu lugar no alfabeto. No rodapé da minha confissão, deixei uma sequência de números:\n\n4 · 5 · 19 · 16 · 5 · 3 · 1 · 13 — 19 · 5\n\nEu acreditava agir por amor. Hoje compreendo que agi por egoísmo. Que direito possuía de perturbar seu descanso?'],
  ['Oferenda', 'Deixei junto aos túmulos os últimos objetos de meus companheiros. Já não ouso pedir que retornem.\n\nNo altar, encontrei uma antiga bênção inscrita em duas colunas.\n\nD R S O A G S A M\nP E R C D N A E O\n\nA tradição dizia que somente a voz dos mortos deveria ser ouvida: uma letra de cima, outra de baixo, alternadamente.\n\nQue encontrem a paz que lhes roubei.'],
  ['O Último Manuscrito', 'Passei tanto tempo procurando uma maneira de trazê-los de volta que jamais aprendi a viver sem eles. A cada lembrança, desejava mudar o passado. Confundi o amor com a necessidade de mantê-los ao meu lado.\n\nDeixei minhas últimas palavras espalhadas nestas páginas. Reúne as nove palavras em latim, na ordem dos manuscritos, para revelar o encantamento.\n\nSe ao menos eu tivesse compreendido que uma despedida não exige o retorno daqueles que partiram.']
];
const latinWords = ['Lux', 'cineres', 'illuminet', 'animae', 'redeant', 'surgant', 'loquantur', 'valeant', 'quiescant'];
const sessions = new Map();
const ipAttempts = new Map();

function norm(value) { return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function sign(id) { return crypto.createHmac('sha256', SESSION_SECRET).update(id).digest('base64url'); }
function cookieValue(req) { const raw = req.headers.cookie || ''; const item = raw.split(';').map(x => x.trim()).find(x => x.startsWith('orbis_session=')); return item?.slice(14); }
function getSession(req, res) {
  const token = cookieValue(req); const [id, signature] = (token || '').split('.');
  const supplied = Buffer.from(signature || ''); const expected = Buffer.from(id ? sign(id) : '');
  if (!id || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return newSession(res);
  let session = sessions.get(id);
  if (!session) { session = { solved: new Set(), spellComplete: false, completed: false, attempts: [] }; sessions.set(id, session); }
  return session;
}
function newSession(res) {
  const id = crypto.randomBytes(32).toString('base64url');
  const session = { solved: new Set(), spellComplete: false, completed: false, attempts: [] };
  sessions.set(id, session);
  res.setHeader('Set-Cookie', `orbis_session=${id}.${sign(id)}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=2592000`);
  return session;
}
function state(session) { return { solved: [...session.solved], spellComplete: session.spellComplete, completed: session.completed, latinWords: [...session.solved].sort((a,b) => a-b).map(i => ({ index: i, word: latinWords[i] })) }; }
function json(res, code, body) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
function limited(req, session) {
  const now = Date.now(); const cutoff = now - 60_000; const ip = req.socket.remoteAddress || 'unknown';
  const attempts = ipAttempts.get(ip)?.filter(time => time > cutoff) || []; session.attempts = session.attempts.filter(time => time > cutoff);
  if (attempts.length >= 30 || session.attempts.length >= 12) return true;
  attempts.push(now); session.attempts.push(now); ipAttempts.set(ip, attempts); return false;
}
function serveStatic(req, res) {
  const target = req.url === '/' ? 'index.html' : req.url.slice(1);
  if (!/^[a-zA-Z0-9._/-]+$/.test(target)) return json(res, 404, { error: 'Não encontrado.' });
  const file = path.resolve(PUBLIC_DIR, target); if (!file.startsWith(PUBLIC_DIR + path.sep)) return json(res, 404, { error: 'Não encontrado.' });
  fs.readFile(file, (error, data) => { if (error) return json(res, 404, { error: 'Não encontrado.' }); const type = file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8'; res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' }); res.end(data); });
}
http.createServer((req, res) => {
  res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'same-origin');
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && req.url === '/api/game') { const session = getSession(req, res); return json(res, 200, { chapters, ...state(session) }); }
  if (req.method === 'POST' && req.url === '/api/answer') {
    const session = getSession(req, res); let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 2048) req.destroy(); }); req.on('end', () => {
      let data; try { data = JSON.parse(raw); } catch { return json(res, 400, { error: 'Pedido inválido.' }); }
      if (limited(req, session)) return json(res, 429, { error: 'Muitas tentativas. Aguarde um minuto.' });
      const chapter = data.chapter; const answer = norm(data.answer);
      const allowed = (Number.isInteger(chapter) && chapter >= 0 && chapter < 9) || (chapter === 9 && session.solved.size === 9) || (chapter === 'final' && session.spellComplete);
      if (!allowed) return json(res, 403, { error: 'Este manuscrito ainda está selado.' });
      const index = chapter === 'final' ? 10 : chapter;
      const alternatives = index === 3 ? ['ALMAS', 'ALMA'] : index === 10 ? ['ACEITACAO', 'ACEITARCAO', 'ACEITAR'] : [norm(answers[index])];
      if (!alternatives.includes(answer)) return json(res, 200, { correct: false, message: 'Enigma não resolvido. Tente novamente.' });
      if (typeof chapter === 'number' && chapter < 9) session.solved.add(chapter);
      if (chapter === 9) session.spellComplete = true;
      if (chapter === 'final') session.completed = true;
      return json(res, 200, { correct: true, state: state(session), rewardCode: session.completed ? REWARD_CODE : undefined });
    }); return;
  }
  if (req.method === 'GET') return serveStatic(req, res);
  return json(res, 405, { error: 'Método não permitido.' });
}).listen(PORT, () => console.log(`Servidor iniciado na porta ${PORT}`));
