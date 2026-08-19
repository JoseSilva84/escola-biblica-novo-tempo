import fsp from 'fs/promises';
import path from 'path';
import { getDashboardData, invalidateDashboardCache, readChurchAddressBook } from './data.js';
import { geocodeCachePath, geocodeKey, readGeocodeCache } from './geocodeCache.js';
import { prisma } from './prisma.js';

const GEOCODE_DELAY_MS = Number(process.env.GEOCODE_DELAY_MS || 1100);
const NOMINATIM_URL = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'AmigosNT-CRM/1.0 contato@sevenflowia.tech';

let job = {
  running: false,
  startedAt: null,
  finishedAt: null,
  processed: 0,
  saved: 0,
  failed: 0,
  skipped: 0,
  limit: 0,
  district: '',
  scope: 'leads',
  message: 'Nenhuma rotina em execucao.',
  notFoundItems: []
};

let geocodeTableReady = null;

async function ensureLeadGeocodeTable() {
  if (geocodeTableReady) return geocodeTableReady;
  geocodeTableReady = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "LeadGeocode" (
        "addressHash" TEXT NOT NULL,
        "externalLeadId" INTEGER,
        "leadName" TEXT,
        "address" TEXT NOT NULL,
        "district" TEXT,
        "neighborhood" TEXT,
        "latitude" DOUBLE PRECISION,
        "longitude" DOUBLE PRECISION,
        "provider" TEXT NOT NULL DEFAULT 'nominatim',
        "precision" TEXT,
        "displayName" TEXT,
        "notFound" BOOLEAN NOT NULL DEFAULT false,
        "geocodedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "LeadGeocode_pkey" PRIMARY KEY ("addressHash")
      )
    `);
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LeadGeocode_externalLeadId_idx" ON "LeadGeocode"("externalLeadId")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LeadGeocode_district_idx" ON "LeadGeocode"("district")');
    await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "LeadGeocode_notFound_idx" ON "LeadGeocode"("notFound")');
  })();
  try {
    return await geocodeTableReady;
  } catch (error) {
    geocodeTableReady = null;
    throw error;
  }
}

async function writeGeocodeCache(cache) {
  const filePath = geocodeCachePath();
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(cache, null, 2), 'utf8');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fullLeadAddress(lead) {
  const address = String(lead?.addr || '').trim();
  if (address && address !== 'N/I') return address;
  return [lead?.end, lead?.d, 'SP', 'Brasil'].filter(Boolean).join(', ');
}

function leadNeighborhood(lead) {
  const [, bairro] = String(lead?.end || '').split(' - ');
  return String(bairro || '').trim() || null;
}

function compactText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s+-\s+/g, ' - ')
    .trim();
}

function stripCep(value) {
  return compactText(value).replace(/\s*-\s*CEP:?\s*\d{5}-?\d{3}\s*$/i, '').trim();
}

function cityFromLead(lead) {
  const parts = String(lead?.addr || lead?.end || '').split(' - ').map((part) => part.trim()).filter(Boolean);
  const stateIndex = parts.findIndex((part) => /^[A-Z]{2}$/i.test(part));
  if (stateIndex > 0) return parts[stateIndex - 1];
  const [city] = String(lead?.end || '').split(' - ');
  return compactText(city || lead?.d || 'Sao Paulo');
}

function streetNumberFromAddress(address) {
  const firstPart = stripCep(address).split(' - ')[0] || '';
  const match = /^(.+?),\s*(\d+[A-Za-z]?)\b/.exec(firstPart);
  if (!match) return compactText(firstPart);
  return compactText(`${match[1]}, ${match[2]}`);
}

function geocodeQueriesForLead(lead, address) {
  const cleanAddress = stripCep(address);
  const streetNumber = streetNumberFromAddress(cleanAddress);
  const neighborhood = leadNeighborhood(lead);
  const city = cityFromLead(lead);
  const queries = [
    cleanAddress,
    [streetNumber, neighborhood, city, 'SP', 'Brasil'].filter(Boolean).join(', '),
    [streetNumber, city, 'SP', 'Brasil'].filter(Boolean).join(', '),
    [neighborhood, city, 'SP', 'Brasil'].filter(Boolean).join(', ')
  ];
  return [...new Set(queries.map(compactText).filter((query) => query.length > 10))];
}

function geocodeQueriesForChurch(church, address) {
  const cleanAddress = stripCep(address);
  const streetNumber = streetNumberFromAddress(cleanAddress);
  const queries = [
    cleanAddress,
    [streetNumber, church?.neighborhood, church?.city, 'SP', 'Brasil'].filter(Boolean).join(', '),
    [church?.name, church?.city, 'SP', 'Brasil'].filter(Boolean).join(', ')
  ];
  return [...new Set(queries.map(compactText).filter((query) => query.length > 10))];
}

async function saveLeadGeocodeToDb({ key, lead, address, entry }) {
  try {
    await ensureLeadGeocodeTable();
    await prisma.$executeRaw`
      INSERT INTO "LeadGeocode" (
        "addressHash",
        "externalLeadId",
        "leadName",
        "address",
        "district",
        "neighborhood",
        "latitude",
        "longitude",
        "provider",
        "precision",
        "displayName",
        "notFound",
        "geocodedAt",
        "updatedAt"
      )
      VALUES (
        ${key},
        ${Number.isFinite(Number(lead?.id)) ? Number(lead.id) : null},
        ${lead?.n || null},
        ${address},
        ${lead?.d || null},
        ${leadNeighborhood(lead)},
        ${Number.isFinite(Number(entry?.lat)) ? Number(entry.lat) : null},
        ${Number.isFinite(Number(entry?.lng)) ? Number(entry.lng) : null},
        ${entry?.source || 'nominatim'},
        ${entry?.type || null},
        ${entry?.displayName || null},
        ${Boolean(entry?.notFound)},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("addressHash") DO UPDATE SET
        "externalLeadId" = EXCLUDED."externalLeadId",
        "leadName" = EXCLUDED."leadName",
        "address" = EXCLUDED."address",
        "district" = EXCLUDED."district",
        "neighborhood" = EXCLUDED."neighborhood",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "provider" = EXCLUDED."provider",
        "precision" = EXCLUDED."precision",
        "displayName" = EXCLUDED."displayName",
        "notFound" = EXCLUDED."notFound",
        "geocodedAt" = CURRENT_TIMESTAMP,
        "updatedAt" = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error('[geocode:db-save:error]', error.message);
  }
}

export async function hydrateGeocodeCacheFromDb() {
  let rows = [];
  try {
    await ensureLeadGeocodeTable();
    rows = await prisma.$queryRaw`
      SELECT
        "addressHash",
        "address",
        "externalLeadId",
        "leadName",
        "district",
        "neighborhood",
        "latitude",
        "longitude",
        "provider",
        "precision",
        "displayName",
        "notFound",
        "geocodedAt"
      FROM "LeadGeocode"
    `;
  } catch (error) {
    console.error('[geocode:db-read:error]', error.message);
    return readGeocodeCache();
  }
  if (!rows.length) return readGeocodeCache();
  const cache = readGeocodeCache();
  let changed = false;
  for (const row of rows) {
    const next = {
      address: row.address,
      id: row.externalLeadId,
      name: row.leadName || '',
      district: row.district || '',
      neighborhood: row.neighborhood || '',
      lat: row.latitude === null || row.latitude === undefined ? null : Number(row.latitude),
      lng: row.longitude === null || row.longitude === undefined ? null : Number(row.longitude),
      source: row.provider || 'nominatim',
      type: row.precision || '',
      displayName: row.displayName || '',
      notFound: Boolean(row.notFound),
      updatedAt: row.geocodedAt ? new Date(row.geocodedAt).toISOString() : new Date().toISOString()
    };
    if (JSON.stringify(cache[row.addressHash]) !== JSON.stringify(next)) {
      cache[row.addressHash] = next;
      changed = true;
    }
  }
  if (changed) {
    await writeGeocodeCache(cache);
    invalidateDashboardCache();
  }
  return cache;
}

function notFoundItemsFromCache(cache, limit = 100) {
  return Object.entries(cache)
    .filter(([, entry]) => entry?.notFound)
    .map(([key, entry]) => ({
      key,
      id: entry.id || null,
      name: entry.name || 'Lead sem nome',
      address: entry.address || '',
      district: entry.district || '',
      neighborhood: entry.neighborhood || '',
      attempts: entry.attempts || [],
      updatedAt: entry.updatedAt || null
    }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, limit);
}

async function notFoundItemsFromDb(limit = 100) {
  try {
    await ensureLeadGeocodeTable();
    const rows = await prisma.$queryRaw`
      SELECT
        "addressHash",
        "externalLeadId",
        "leadName",
        "address",
        "district",
        "neighborhood",
        "geocodedAt"
      FROM "LeadGeocode"
      WHERE "notFound" = true
      ORDER BY "geocodedAt" DESC
      LIMIT ${limit}
    `;
    return rows.map((row) => ({
      key: row.addressHash,
      id: row.externalLeadId,
      name: row.leadName || 'Lead sem nome',
      address: row.address || '',
      district: row.district || '',
      neighborhood: row.neighborhood || '',
      attempts: [],
      updatedAt: row.geocodedAt ? new Date(row.geocodedAt).toISOString() : null
    }));
  } catch (error) {
    console.error('[geocode:not-found-history:error]', error.message);
    return null;
  }
}

function hasCompletedGeocode(entry) {
  return Boolean(entry?.notFound)
    || (Number.isFinite(Number(entry?.lat)) && Number.isFinite(Number(entry?.lng)));
}

function pendingLeads(records, cache, limit, district = '') {
  const seen = new Set();
  const targetDistrict = compactText(district).toLowerCase();
  return records
    .map((lead) => ({ lead, address: fullLeadAddress(lead) }))
    .filter(({ lead, address }) => {
      if (targetDistrict && compactText(lead?.d).toLowerCase() !== targetDistrict) return false;
      const key = geocodeKey(address);
      if (!address || address === 'N/I' || seen.has(key) || hasCompletedGeocode(cache[key])) return false;
      seen.add(key);
      return lead?.d && key.length > 10;
    })
    .slice(0, limit);
}

async function geocodeQuery(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': USER_AGENT
    }
  });
  if (!response.ok) throw new Error(`Nominatim respondeu ${response.status}`);
  const results = await response.json();
  const result = Array.isArray(results) ? results[0] : null;
  if (!result?.lat || !result?.lon) return null;
  return {
    lat: Number(result.lat),
    lng: Number(result.lon),
    displayName: result.display_name || '',
    type: result.type || '',
    importance: Number(result.importance) || null
  };
}

async function geocodeLeadAddress(lead, address) {
  const queries = geocodeQueriesForLead(lead, address);
  for (let index = 0; index < queries.length; index++) {
    const query = queries[index];
    const point = await geocodeQuery(query);
    if (point) return { ...point, matchedQuery: query, attempts: queries };
    if (index < queries.length - 1) await sleep(GEOCODE_DELAY_MS);
  }
  return { point: null, attempts: queries };
}

export async function geocodeStatus() {
  const cache = await hydrateGeocodeCacheFromDb();
  const dbNotFoundItems = await notFoundItemsFromDb(100);
  const notFoundItems = dbNotFoundItems || notFoundItemsFromCache(cache, 100);
  if (!job.running && job.finishedAt) {
    invalidateDashboardCache();
  }
  const payload = getDashboardData();
  const churchAddressBook = readChurchAddressBook();
  const total = payload.records.length;
  const withCoordinates = payload.records.filter((lead) => Number.isFinite(Number(lead.lat)) && Number.isFinite(Number(lead.lng))).length;
  const churchRows = churchAddressBook.rows || [];
  const churchesWithCoordinates = churchRows.filter((church) => {
    const cached = cache[geocodeKey(church.address)];
    return cached && !cached.notFound && Number.isFinite(Number(cached.lat)) && Number.isFinite(Number(cached.lng));
  }).length;
  return {
    ...job,
    cachePath: geocodeCachePath(),
    cachedAddresses: Object.keys(cache).length,
    notFoundTotal: notFoundItems.length,
    notFoundItems: job.running && job.notFoundItems.length ? job.notFoundItems : notFoundItems,
    totalLeads: total,
    leadsWithCoordinates: withCoordinates,
    pendingEstimate: Math.max(0, total - withCoordinates),
    totalChurches: churchRows.length,
    churchesWithCoordinates,
    churchPendingEstimate: Math.max(0, churchRows.length - churchesWithCoordinates)
  };
}

export function startGeocodingBatch({ limit = 100, district = '', scope = 'leads' } = {}) {
  if (job.running) return { started: false, status: job };
  const batchLimit = Math.max(1, Math.min(Number(limit) || 100, 1000));
  const targetDistrict = compactText(district);
  const targetScope = scope === 'churches' ? 'churches' : 'leads';
  job = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    processed: 0,
    saved: 0,
    failed: 0,
    skipped: 0,
    limit: batchLimit,
    district: targetDistrict,
    scope: targetScope,
    message: targetScope === 'churches'
      ? 'Geocodificacao iniciada para igrejas.'
      : targetDistrict ? `Geocodificacao iniciada para ${targetDistrict}.` : 'Geocodificacao iniciada.',
    notFoundItems: []
  };

  const runner = targetScope === 'churches'
    ? runChurchBatch(batchLimit)
    : runBatch(batchLimit, targetDistrict);
  runner.catch((error) => {
    job = {
      ...job,
      running: false,
      finishedAt: new Date().toISOString(),
      message: error.message || 'A rotina de geocodificacao falhou.'
    };
  });

  return { started: true, status: job };
}

function hasCompletedChurchGeocode(church, cache) {
  return hasCompletedGeocode(cache[geocodeKey(church.address)]);
}

function pendingChurches(cache, limit) {
  const addressBook = readChurchAddressBook();
  const seen = new Set();
  return addressBook.rows
    .filter((church) => {
      const key = geocodeKey(church.address);
      if (!church.address || church.address === 'N/I' || seen.has(key) || hasCompletedChurchGeocode(church, cache)) return false;
      seen.add(key);
      return key.length > 10;
    })
    .slice(0, limit);
}

async function geocodeChurchAddress(church) {
  const queries = geocodeQueriesForChurch(church, church.address);
  for (let index = 0; index < queries.length; index++) {
    const query = queries[index];
    const point = await geocodeQuery(query);
    if (point) return { ...point, matchedQuery: query, attempts: queries };
    if (index < queries.length - 1) await sleep(GEOCODE_DELAY_MS);
  }
  return { point: null, attempts: queries };
}

async function runChurchBatch(limit) {
  const cache = await hydrateGeocodeCacheFromDb();
  const batch = pendingChurches(cache, limit);
  job.message = `Processando ${batch.length} endereco(s) de igreja pendente(s).`;

  for (const church of batch) {
    const address = church.address;
    const key = geocodeKey(address);
    const leadLikeChurch = {
      id: null,
      n: church.name || 'Igreja Adventista',
      d: church.city || '',
      end: [church.city, church.neighborhood].filter(Boolean).join(' - ')
    };
    try {
      const result = await geocodeChurchAddress(church);
      const point = result?.lat ? result : null;
      const entry = point
        ? { ...point, source: 'nominatim', address, id: null, name: church.name || '', district: church.city || '', neighborhood: church.neighborhood || '', updatedAt: new Date().toISOString() }
        : { notFound: true, source: 'nominatim', address, id: null, name: church.name || '', district: church.city || '', neighborhood: church.neighborhood || '', attempts: result?.attempts || [], updatedAt: new Date().toISOString() };
      cache[key] = entry;
      await saveLeadGeocodeToDb({ key, lead: leadLikeChurch, address, entry });
      if (point) job.saved += 1;
      else {
        job.skipped += 1;
        job.notFoundItems = [
          ...job.notFoundItems,
          {
            id: null,
            name: church.name || 'Igreja Adventista',
            address,
            district: church.city || '',
            neighborhood: church.neighborhood || '',
            attempts: entry.attempts || []
          }
        ].slice(-50);
      }
      job.processed += 1;
      job.message = `${job.processed}/${batch.length} igrejas processadas. Ultima: ${church.name || address}`;
      await writeGeocodeCache(cache);
    } catch (error) {
      job.failed += 1;
      job.processed += 1;
      job.message = `${job.processed}/${batch.length} igrejas processadas. Falha: ${error.message}`;
    }
    if (job.processed < batch.length) await sleep(GEOCODE_DELAY_MS);
  }

  job = {
    ...job,
    running: false,
    finishedAt: new Date().toISOString(),
    message: `Concluido em igrejas: ${job.saved} coordenada(s) salvas, ${job.skipped} sem resultado, ${job.failed} falha(s).`
  };
  invalidateDashboardCache();
}

async function runBatch(limit, district = '') {
  const cache = await hydrateGeocodeCacheFromDb();
  const payload = getDashboardData();
  const batch = pendingLeads(payload.records, cache, limit, district);
  job.message = district
    ? `Processando ${batch.length} endereco(s) pendente(s) em ${district}.`
    : `Processando ${batch.length} endereco(s) pendente(s).`;

  for (const { address, lead } of batch) {
    const key = geocodeKey(address);
    try {
      const result = await geocodeLeadAddress(lead, address);
      const point = result?.lat ? result : null;
      const entry = point
        ? { ...point, source: 'nominatim', address, id: lead.id, name: lead.n || '', district: lead.d || '', neighborhood: leadNeighborhood(lead) || '', updatedAt: new Date().toISOString() }
        : { notFound: true, source: 'nominatim', address, id: lead.id, name: lead.n || '', district: lead.d || '', neighborhood: leadNeighborhood(lead) || '', attempts: result?.attempts || [], updatedAt: new Date().toISOString() };
      cache[key] = entry;
      await saveLeadGeocodeToDb({ key, lead, address, entry });
      if (point) job.saved += 1;
      else {
        job.skipped += 1;
        job.notFoundItems = [
          ...job.notFoundItems,
          {
            id: lead.id,
            name: lead.n || 'Lead sem nome',
            address,
            district: lead.d || '',
            neighborhood: leadNeighborhood(lead) || '',
            attempts: entry.attempts || []
          }
        ].slice(-50);
      }
      job.processed += 1;
      job.message = `${job.processed}/${batch.length} processados. Ultimo: ${lead.n || address}`;
      await writeGeocodeCache(cache);
    } catch (error) {
      job.failed += 1;
      job.processed += 1;
      job.message = `${job.processed}/${batch.length} processados. Falha: ${error.message}`;
    }
    if (job.processed < batch.length) await sleep(GEOCODE_DELAY_MS);
  }

  job = {
    ...job,
    running: false,
    finishedAt: new Date().toISOString(),
    message: district
      ? `Concluido em ${district}: ${job.saved} coordenada(s) salvas, ${job.skipped} sem resultado, ${job.failed} falha(s).`
      : `Concluido: ${job.saved} coordenada(s) salvas, ${job.skipped} sem resultado, ${job.failed} falha(s).`
  };
  invalidateDashboardCache();
}
