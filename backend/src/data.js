import fs from 'fs';
import path from 'path';

const DATA_REFERENCIA = new Date('2026-06-08T00:00:00');
const DATASET_DIR = resolveConfiguredPath(process.env.DATASET_DIR)
  || firstExistingPath([
    path.resolve(process.cwd(), 'dataset'),
    path.resolve(process.cwd(), '..', 'dataset')
  ])
  || path.resolve(process.cwd(), 'dataset');
const ML_RANKING_FILE = 'ranking_nao_vip_ml_pandas.csv';
const ALUNOS_FILE = 'alunos.json';

function resolveConfiguredPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function firstExistingPath(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}
function splitCsvLine(line) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (ch === ',' && !quoted) {
      cells.push(value);
      value = '';
    } else {
      value += ch;
    }
  }
  cells.push(value);
  return cells;
}

function readMlRanking() {
  const rankingPath = firstExistingPath([
    resolveConfiguredPath(process.env.ML_RANKING_PATH),
    path.join(DATASET_DIR, ML_RANKING_FILE)
  ]);
  if (!rankingPath) return { byId: new Map(), source: null };

  const lines = fs.readFileSync(rankingPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const headers = splitCsvLine(lines.shift());
  const idIndex = headers.indexOf('ID');
  const similarityIndex = headers.indexOf('score_similaridade_vip');
  const priorityIndex = headers.indexOf('score_prioridade_operacional');
  const bandIndex = headers.indexOf('faixa_prioridade');
  const byId = new Map();

  for (const line of lines) {
    const cells = splitCsvLine(line);
    const id = Number(cells[idIndex]);
    if (!Number.isFinite(id)) continue;
    byId.set(id, {
      similarity: Number(cells[similarityIndex]) || 0,
      priority: Number(cells[priorityIndex]) || 0,
      band: cells[bandIndex] || 'baixa'
    });
  }

  return { byId, source: rankingPath };
}

function normalize(value, fallback = 'N/I') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function parseBrDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value ?? '').trim());
  if (!match) return null;
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00`);
}

function daysSince(value) {
  const date = parseBrDate(value);
  if (!date) return null;
  return Math.max(0, Math.round((DATA_REFERENCIA - date) / 86400000));
}

function materialCount(value) {
  const text = normalize(value, '');
  return text ? text.split(/\s*\*-\*\s*/).filter(Boolean).length : 0;
}

function mainMaterialType(value) {
  const text = normalize(value, '');
  if (/on-line|online/i.test(text)) return 'Online';
  if (/pdf|digital/i.test(text)) return 'PDF';
  if (/impresso/i.test(text)) return 'Impresso';
  return 'N/I';
}

function mainMaterialName(value) {
  const text = normalize(value, '');
  const firstMaterial = text.split(/\s*\*-\*\s*/).find(Boolean) || '';
  const withoutDate = firstMaterial.split('|')[0]?.trim() || '';
  const name = withoutDate.replace(/\s+-\s+(?:on-line|online|impresso|pdf|digital).*$/i, '').trim();
  return name || 'N/I';
}

function compactAddress(row) {
  const cidade = normalize(row.Cidade, '');
  const bairro = normalize(row.Bairro, '');
  return [cidade, bairro].filter(Boolean).join(' - ') || 'N/I';
}

function genderCode(value) {
  const text = normalize(value, '').toLowerCase();
  if (text.startsWith('masc')) return 'M';
  if (text.startsWith('fem')) return 'F';
  return 'N';
}

function scoreBand(score) {
  if (score >= 0.7) return 'Hot';
  if (score >= 0.45) return 'Warm';
  if (score >= 0.25) return 'Cool';
  return 'Cold';
}

function scoreForVip(row) {
  const contactDays = daysSince(row['Data do Último Contato']);
  const recency = Math.exp(-(contactDays ?? 365 * 20) / (365 * 3));
  const digits = String(row.Telefone ?? '').replace(/\D/g, '');
  const email = normalize(row.Email, '');
  const validPhone = digits.length >= 10 && digits.length <= 13 ? 1 : 0;
  const hasPhone = digits.length > 0 ? 1 : 0;
  const validEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? 1 : 0;
  const hasEmail = email && email !== 'N/I' ? 1 : 0;
  const contact = Math.min(1, 0.55 * validPhone + 0.3 * validEmail + 0.1 * hasPhone + 0.05 * hasEmail);
  return 0.4 + 0.4 * recency + 0.2 * contact;
}

function transformRecord(row, ml) {
  const vip = normalize(row.Vip, 'Não').toLowerCase() === 'sim' ? 1 : 0;
  const mlRow = ml.get(Number(row.ID));
  const priorityScore = mlRow?.priority ?? (vip ? scoreForVip(row) : 0);
  const similarityScore = mlRow?.similarity ?? (vip ? 1 : 0);
  const priority = scoreBand(priorityScore);
  const digits = String(row.Telefone ?? '').replace(/\D/g, '');
  const email = normalize(row.Email, '');
  const religiao = normalize(row.Religião, 'Não informado');
  const descricao = normalize(row.Descrição, 'N/I');

  return {
    id: Number(row.ID),
    d: normalize(row.Distrito, 'Não informado'),
    n: `${normalize(row.Aluno, '')} ${normalize(row.Sobrenome, '')}`.trim() || 'N/I',
    s: Number((priorityScore * 20).toFixed(1)),
    p: priority,
    ml: Number(priorityScore.toFixed(4)),
    sim: Number(similarityScore.toFixed(4)),
    faixa: mlRow?.band || (priorityScore >= 0.7 ? 'alta' : priorityScore >= 0.45 ? 'media' : 'baixa'),
    r: religiao === 'N/I' ? 'Não informado' : religiao,
    v: vip,
    t: digits.length >= 10 ? 1 : 0,
    e: /\(em andamento\)/i.test(String(row.Material ?? '')) ? 1 : 0,
    m: materialCount(row.Material),
    c: daysSince(row['Data do Último Contato']),
    a: Number.parseInt(normalize(row.Idade, ''), 10) || null,
    birthDate: normalize(row['Data de aniversário'], 'N/I'),
    g: genderCode(row.Sexo),
    tm: mainMaterialType(row.Material),
    materialName: mainMaterialName(row.Material),
    tel: normalize(row.Telefone, ''),
    em: email === 'N/I' ? '' : email,
    end: compactAddress(row),
    desc: descricao === 'N/I' ? 'N/I' : descricao
  };
}

export function getDashboardData() {
  const alunosPath = firstExistingPath([
    resolveConfiguredPath(process.env.ALUNOS_DATA_PATH),
    path.join(DATASET_DIR, ALUNOS_FILE)
  ]);
  if (!alunosPath) {
    throw new Error(`Arquivo ${ALUNOS_FILE} nao encontrado. Configure ALUNOS_DATA_PATH ou coloque o arquivo em ${DATASET_DIR}.`);
  }
  const alunos = JSON.parse(fs.readFileSync(alunosPath, 'utf8'));
  const ranking = readMlRanking();
  const records = alunos.map((row) => transformRecord(row, ranking.byId));

  return {
    records,
    meta: {
      total: records.length,
      alunosPath,
      mlSource: ranking.source,
      mlRecords: ranking.byId.size,
      referenceDate: '2026-06-08',
      model: 'ranking_nao_vip_ml_pandas.csv + regra operacional do notebook analise_vip_ml.ipynb'
    }
  };
}
