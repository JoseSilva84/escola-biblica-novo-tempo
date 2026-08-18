import fs from 'fs';
import path from 'path';
import { geocodeKey, readGeocodeCache } from './geocodeCache.js';

const DATASET_DIR = resolveConfiguredPath(process.env.DATASET_DIR)
  || firstExistingPath([
    path.resolve(process.cwd(), 'dataset'),
    path.resolve(process.cwd(), '..', 'dataset')
  ])
  || path.resolve(process.cwd(), 'dataset');
const ML_RANKING_FILE = 'ranking_nao_vip_ml_pandas.csv';
const ALUNOS_FILE = 'alunos.json';
const PAULISTANA_TERRITORY_FILE = 'regiaoDistritoIgreja.md';
const INTEREST_DATA_PATTERN = /^dados_interesse_(?!distritos_manifest)(.+)\.json$/i;
const UPDATE_STATUS_FILE = 'ultima_atualizacao_dataset.json';
const UPDATE_HISTORY_FILE = 'historico_atualizacoes_dataset.json';
let dashboardCache = null;

function resolveConfiguredPath(value) {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function firstExistingPath(paths) {
  return paths.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function fileCachePart(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return `${filePath || 'missing'}:missing`;
  const stat = fs.statSync(filePath);
  return `${filePath}:${stat.mtimeMs}:${stat.size}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function todayReferenceDate() {
  return new Date(`${todayKey()}T00:00:00`);
}

function dashboardCacheKey(alunosPath) {
  const territoryPath = firstExistingPath([
    resolveConfiguredPath(process.env.PAULISTANA_TERRITORY_PATH),
    path.join(DATASET_DIR, PAULISTANA_TERRITORY_FILE),
    path.resolve(DATASET_DIR, '..', PAULISTANA_TERRITORY_FILE)
  ]);
  const rankingPath = firstExistingPath([
    resolveConfiguredPath(process.env.ML_RANKING_PATH),
    path.join(DATASET_DIR, ML_RANKING_FILE)
  ]);
  const updatePath = firstExistingPath([
    resolveConfiguredPath(process.env.DATASET_UPDATE_STATUS_PATH),
    path.join(DATASET_DIR, UPDATE_STATUS_FILE)
  ]);
  const historyPath = firstExistingPath([
    resolveConfiguredPath(process.env.DATASET_UPDATE_HISTORY_PATH),
    path.join(DATASET_DIR, UPDATE_HISTORY_FILE)
  ]);
  const geocodePath = firstExistingPath([
    resolveConfiguredPath(process.env.GEOCODE_CACHE_PATH),
    path.join(DATASET_DIR, 'geocode-cache.json')
  ]);
  const interestDataPath = resolveConfiguredPath(process.env.INTEREST_DATA_PATH);
  const interestPaths = [];
  if (interestDataPath && fs.existsSync(interestDataPath) && fs.statSync(interestDataPath).isFile()) {
    interestPaths.push(interestDataPath);
  } else if (fs.existsSync(DATASET_DIR)) {
    for (const file of fs.readdirSync(DATASET_DIR)) {
      if (INTEREST_DATA_PATTERN.test(file)) interestPaths.push(path.join(DATASET_DIR, file));
    }
  }

  return [
    todayKey(),
    fileCachePart(alunosPath),
    fileCachePart(territoryPath),
    fileCachePart(rankingPath),
    fileCachePart(updatePath),
    fileCachePart(historyPath),
    fileCachePart(geocodePath),
    ...interestPaths.sort((a, b) => a.localeCompare(b)).map(fileCachePart)
  ].join('|');
}

export function invalidateDashboardCache() {
  dashboardCache = null;
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

function readLastDatasetUpdate() {
  const updatePath = firstExistingPath([
    resolveConfiguredPath(process.env.DATASET_UPDATE_STATUS_PATH),
    path.join(DATASET_DIR, UPDATE_STATUS_FILE)
  ]);
  if (!updatePath) return null;

  try {
    const update = JSON.parse(fs.readFileSync(updatePath, 'utf8'));
    return {
      ...update,
      updatePath
    };
  } catch {
    return null;
  }
}

function readDatasetUpdateHistory() {
  const historyPath = firstExistingPath([
    resolveConfiguredPath(process.env.DATASET_UPDATE_HISTORY_PATH),
    path.join(DATASET_DIR, UPDATE_HISTORY_FILE)
  ]);
  if (!historyPath) return [];

  try {
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    return Array.isArray(history) ? history.slice(0, 50) : [];
  } catch {
    return [];
  }
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
  return Math.max(0, Math.round((todayReferenceDate() - date) / 86400000));
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

function cachedCoordinatesForLead(lead, cache) {
  const fullAddress = lead.addr && lead.addr !== 'N/I'
    ? lead.addr
    : [lead.end, lead.d, 'SP', 'Brasil'].filter(Boolean).join(', ');
  const cached = cache[geocodeKey(fullAddress)];
  if (!cached || !Number.isFinite(Number(cached.lat)) || !Number.isFinite(Number(cached.lng))) return {};
  return {
    lat: Number(cached.lat),
    lng: Number(cached.lng),
    geoSource: cached.source || 'cache',
    geoPrecision: cached.type || 'endereco',
    geoDisplayName: cached.displayName || ''
  };
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

function transformRecord(row, ml, geocodeCache = {}) {
  const vip = normalize(row.Vip, 'Não').toLowerCase() === 'sim' ? 1 : 0;
  const mlRow = ml.get(Number(row.ID));
  const priorityScore = mlRow?.priority ?? (vip ? scoreForVip(row) : 0);
  const similarityScore = mlRow?.similarity ?? (vip ? 1 : 0);
  const priority = scoreBand(priorityScore);
  const digits = String(row.Telefone ?? '').replace(/\D/g, '');
  const email = normalize(row.Email, '');
  const religiao = normalize(row.Religião, 'Não informado');
  const descricao = normalize(row.Descrição, 'N/I');
  const lastContactDate = normalize(row['Data do Último Contato'], '');

  const lead = {
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
    c: daysSince(lastContactDate),
    lastContactDate,
    a: Number.parseInt(normalize(row.Idade, ''), 10) || null,
    birthDate: normalize(row['Data de aniversário'], 'N/I'),
    g: genderCode(row.Sexo),
    tm: mainMaterialType(row.Material),
    materialName: mainMaterialName(row.Material),
    tel: normalize(row.Telefone, ''),
    em: email === 'N/I' ? '' : email,
    addr: normalize(row['EndereÃ§o'] || row['Endereço'] || row.Endereco, ''),
    end: compactAddress(row),
    desc: descricao === 'N/I' ? 'N/I' : descricao
  };
  return {
    ...lead,
    ...cachedCoordinatesForLead(lead, geocodeCache)
  };
}

function readInterestDistrictData() {
  const territory = readPaulistanaTerritory();
  const configuredPath = resolveConfiguredPath(process.env.INTEREST_DATA_PATH);
  const files = [];
  if (configuredPath && fs.existsSync(configuredPath) && fs.statSync(configuredPath).isFile()) {
    files.push(configuredPath);
  } else if (fs.existsSync(DATASET_DIR)) {
    for (const file of fs.readdirSync(DATASET_DIR)) {
      if (INTEREST_DATA_PATTERN.test(file)) files.push(path.join(DATASET_DIR, file));
    }
  }

  const byDistrict = {};
  const districts = [];
  for (const interestPath of files.sort((a, b) => a.localeCompare(b))) {
    try {
      const payload = JSON.parse(fs.readFileSync(interestPath, 'utf8'));
      const rows = Array.isArray(payload.registros) ? payload.registros : [];
      const district = payload.distrito_piloto || rows[0]?.origem?.distrito || path.basename(interestPath, '.json').replace(/^dados_interesse_/i, '');
      const slug = districtSlug(district);
      if (territory.allowedDistrictSlugs && !territory.allowedDistrictSlugs.has(slug)) continue;
      const records = rows.map(transformInterestPilotRecord);
      byDistrict[slug] = records;
      districts.push({
        slug,
        name: district,
        file: interestPath,
        total: records.length,
        referenceDate: payload.data_referencia || null,
        source: payload.fonte || null,
        schemaVersion: payload.schema_version || null
      });
    } catch {
      // Ignora arquivos corrompidos para nao derrubar o dashboard inteiro.
    }
  }

  const alphaville = districts.find((item) => item.slug === 'alphaville');
  return {
    records: alphaville ? byDistrict.alphaville || [] : [],
    byDistrict,
    meta: {
      totalDistricts: districts.length,
      totalRecords: districts.reduce((sum, item) => sum + item.total, 0),
      districts
    }
  };
}

function buildInterestDistrictDataFromRecords(records = []) {
  const byDistrict = {};
  const districts = new Map();
  for (const record of records) {
    const district = record.d || 'Nao informado';
    const slug = districtSlug(district);
    if (!byDistrict[slug]) byDistrict[slug] = [];
    byDistrict[slug].push(transformDashboardRecordToInterest(record));
    if (!districts.has(slug)) {
      districts.set(slug, { slug, name: district, file: null, total: 0, generatedFrom: ALUNOS_FILE });
    }
    districts.get(slug).total += 1;
  }
  return {
    byDistrict,
    districts: Array.from(districts.values()).sort((a, b) => a.name.localeCompare(b.name))
  };
}

function normalizeAssociationLikeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'nao-informado';
}

export function districtSlug(value) {
  const slug = normalizeAssociationLikeSlug(value)
    .replace(/\bjd\b/g, 'jardim')
    .replace(/\bpq\b/g, 'parque')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const aliases = {
    'bairro-do-feital': 'feital',
    'barueri': 'barueri-central',
    'central-de-cotia': 'cotia',
    'central-de-sao-paulo': 'central-paulistana',
    'jardim-arpoador': 'jardim-arpoador',
    'jardim-bela-vista': 'jardim-bela-vista',
    'jardim-boa-vista': 'jardim-boa-vista',
    'jardim-da-graca': 'jardim-da-graca',
    'jardim-helena-maria': 'jardim-helena-maria',
    'jardim-rosemary': 'jardim-rosemary',
    'jardim-silveira': 'jardim-silveira',
    'jardim-silviania': 'jardim-silviania',
    'vargem-grande-paulista': 'vargem-grande-paulista'
  };
  return aliases[slug] || slug;
}

function readPaulistanaTerritory() {
  const territoryPath = firstExistingPath([
    resolveConfiguredPath(process.env.PAULISTANA_TERRITORY_PATH),
    path.join(DATASET_DIR, PAULISTANA_TERRITORY_FILE),
    path.resolve(DATASET_DIR, '..', PAULISTANA_TERRITORY_FILE)
  ]);

  if (!territoryPath) {
    throw new Error(`Arquivo ${PAULISTANA_TERRITORY_FILE} nao encontrado. Configure PAULISTANA_TERRITORY_PATH para filtrar a Associacao Paulistana.`);
  }

  const text = fs.readFileSync(territoryPath, 'utf8').replace(/^\uFEFF/, '');
  const districts = [];
  const churchesByDistrict = {};
  const districtNameBySlug = new Map();
  let currentDistrict = null;

  for (const line of text.split(/\r?\n/)) {
    const districtMatch = /^\*\*(.+?)\*\*/.exec(line.trim());
    if (districtMatch) {
      currentDistrict = normalize(districtMatch[1], '');
      const slug = districtSlug(currentDistrict);
      districts.push({ name: currentDistrict, slug });
      districtNameBySlug.set(slug, currentDistrict);
      churchesByDistrict[slug] = [];
      continue;
    }

    const churchMatch = /^-\s+(.+)$/.exec(line.trim());
    if (churchMatch && currentDistrict) {
      churchesByDistrict[districtSlug(currentDistrict)].push(
        parseChurchEntry(churchMatch[1])
      );
    }
  }

  return {
    path: territoryPath,
    districts,
    districtNameBySlug,
    churchesByDistrict,
    allowedDistrictSlugs: new Set(districts.map((district) => district.slug))
  };
}

function parseChurchEntry(value) {
  const parts = String(value || '')
    .replace(/\s+\(GP\)\s*$/i, '')
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);
  const [name = '', address = '', coordinates = ''] = parts;
  const coordinateMatch = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(coordinates);
  return {
    name,
    address,
    lat: coordinateMatch ? Number(coordinateMatch[1]) : null,
    lng: coordinateMatch ? Number(coordinateMatch[2]) : null
  };
}

function transformDashboardRecordToInterest(row) {
  const [cidade, bairro] = String(row.end || '').split(' - ');
  const email = normalize(row.em, '');
  const hasEmail = Boolean(email && email !== 'N/I');
  const hasPhone = Boolean(row.t);
  const days = Number(row.c);
  return {
    id: normalize(row.id, ''),
    n: normalize(row.n, 'Lead sem nome'),
    tel: normalize(row.tel, ''),
    em: hasEmail ? email : '',
    d: normalize(row.d, 'Nao informado'),
    cidade: normalize(cidade, 'Nao informado'),
    bairro: normalize(bairro, 'Nao informado'),
    material: normalize(row.materialName || row.tm, 'N/I'),
    materialPrincipal: normalize(row.materialName || row.tm, 'Nao informado'),
    ultimoContato: row.lastContactDate || null,
    vipHistorico: Boolean(row.v),
    materiaisQuantidade: Number(row.m) || 0,
    temTelefone: hasPhone ? 1 : 0,
    telefoneValido: hasPhone ? 1 : 0,
    temEmail: hasEmail ? 1 : 0,
    emailValido: hasEmail ? 1 : 0,
    temDescricao: row.desc && row.desc !== 'N/I' ? 1 : 0,
    logDiasDesdeContato: Number.isFinite(days) ? Math.log1p(days) : null,
    tentativaContato: false,
    dataTentativa: null,
    canal: null,
    respondeu: null,
    demonstrouInteresse: null,
    aceitouVisita: null,
    participou: null,
    observacao: null,
    score: Number(row.s) || 0,
    priority: row.p || 'Cold',
    priorityLabel: row.p === 'Hot' ? 'Quente' : row.p === 'Warm' ? 'Potencial' : row.p === 'Cool' ? 'Morno' : 'Frio',
    ml: Number(row.ml) || 0,
    faixa: row.faixa || null,
    idade: row.a || null,
    genero: row.g || null,
    estudoAtivo: Boolean(row.e)
  };
}

function enrichInterestRowsWithDashboardData(rows = [], recordsById = new Map()) {
  return rows.map((row) => {
    const dashboard = recordsById.get(String(row.id));
    if (!dashboard) return row;
    return {
      ...row,
      score: Number(dashboard.s) || 0,
      priority: dashboard.p || row.priority || 'Cold',
      priorityLabel: dashboard.p === 'Hot' ? 'Quente' : dashboard.p === 'Warm' ? 'Potencial' : dashboard.p === 'Cool' ? 'Morno' : 'Frio',
      ml: Number(dashboard.ml) || 0,
      faixa: dashboard.faixa || row.faixa || null,
      idade: dashboard.a || row.idade || null,
      genero: dashboard.g || row.genero || null,
      estudoAtivo: Boolean(dashboard.e),
      raw: dashboard
    };
  });
}

function transformInterestPilotRecord(row) {
  const contato = row?.contato || {};
  const origem = row?.origem || {};
  const atributos = row?.atributos_modelo || {};
  const resultados = row?.resultados || {};
  const email = normalize(contato.email, '');

  return {
    id: normalize(row?.id, ''),
    n: normalize(contato.nome, 'Lead sem nome'),
    tel: normalize(contato.telefone, ''),
    em: email === 'N/I' ? '' : email,
    d: normalize(origem.distrito, 'Alphaville'),
    cidade: normalize(origem.cidade || atributos.cidade, 'NÃ£o informado'),
    bairro: normalize(origem.bairro || atributos.bairro, 'NÃ£o informado'),
    material: normalize(origem.material, 'N/I'),
    materialPrincipal: normalize(atributos.material_principal, 'NÃ£o informado'),
    ultimoContato: origem.ultimo_contato || null,
    vipHistorico: Boolean(origem.vip_historico),
    materiaisQuantidade: Number(atributos.materiais_quantidade) || 0,
    temTelefone: Number(atributos.tem_telefone) || 0,
    telefoneValido: Number(atributos.telefone_valido) || 0,
    temEmail: Number(atributos.tem_email) || 0,
    emailValido: Number(atributos.email_valido) || 0,
    temDescricao: Number(atributos.tem_descricao) || 0,
    logDiasDesdeContato: Number.isFinite(Number(atributos.log_dias_desde_contato)) ? Number(atributos.log_dias_desde_contato) : null,
    tentativaContato: resultados.tentativa_contato,
    dataTentativa: resultados.data_tentativa || null,
    canal: resultados.canal || null,
    respondeu: resultados.respondeu,
    demonstrouInteresse: resultados.demonstrou_interesse,
    aceitouVisita: resultados.aceitou_visita,
    participou: resultados.participou,
    observacao: resultados.observacao || null,
    raw: row
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

  const cacheKey = dashboardCacheKey(alunosPath);
  if (dashboardCache?.key === cacheKey) {
    return dashboardCache.payload;
  }

  const territory = readPaulistanaTerritory();
  const alunos = JSON.parse(fs.readFileSync(alunosPath, 'utf8'));
  const ranking = readMlRanking();
  const lastDatasetUpdate = readLastDatasetUpdate();
  const datasetUpdateHistory = readDatasetUpdateHistory();
  const geocodeCache = readGeocodeCache();
  const paulistanaRows = territory.allowedDistrictSlugs
    ? alunos.filter((row) => territory.allowedDistrictSlugs.has(districtSlug(row.Distrito)))
    : alunos;
  const records = paulistanaRows.map((row) => {
    const record = transformRecord(row, ranking.byId, geocodeCache);
    const officialName = territory.districtNameBySlug?.get(districtSlug(row.Distrito));
    return officialName ? { ...record, d: officialName } : record;
  });
  const interestPilot = readInterestDistrictData();
  const generatedInterest = buildInterestDistrictDataFromRecords(records);
  const recordsById = new Map(records.map((record) => [String(record.id), record]));
  const enrichedPilotByDistrict = Object.fromEntries(
    Object.entries(interestPilot.byDistrict).map(([slug, rows]) => [
      slug,
      enrichInterestRowsWithDashboardData(rows, recordsById)
    ])
  );
  const interestRecordsByDistrict = {
    ...generatedInterest.byDistrict,
    ...enrichedPilotByDistrict
  };
  const interestDistrictMeta = [
    ...generatedInterest.districts,
    ...interestPilot.meta.districts
  ].reduce((map, item) => {
    map.set(item.slug, { ...(map.get(item.slug) || {}), ...item });
    return map;
  }, new Map());

  const payload = {
    records,
    interestRecords: interestRecordsByDistrict.alphaville || [],
    interestRecordsByDistrict,
    meta: {
      total: records.length,
      alunosPath,
      territory: {
        path: territory.path,
        districts: territory.districts,
        churchesByDistrict: territory.churchesByDistrict,
        originalDistricts: new Set(alunos.map((row) => districtSlug(row.Distrito))).size,
        filteredOutRecords: alunos.length - paulistanaRows.length
      },
      interestPilot: {
        ...interestPilot.meta,
        totalDistricts: interestDistrictMeta.size,
        totalRecords: Object.values(interestRecordsByDistrict).reduce((sum, rows) => sum + rows.length, 0),
        districts: Array.from(interestDistrictMeta.values()).sort((a, b) => a.name.localeCompare(b.name))
      },
      mlSource: ranking.source,
      mlRecords: ranking.byId.size,
      lastDatasetUpdate,
      datasetUpdateHistory,
      referenceDate: todayKey(),
      model: 'ranking_nao_vip_ml_pandas.csv + regra operacional do notebook analise_vip_ml.ipynb'
    }
  };
  dashboardCache = { key: cacheKey, payload };
  return payload;
}
