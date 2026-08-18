import fs from 'fs';
import path from 'path';

const GEOCODE_CACHE_FILE = 'geocode-cache.json';

function resolveDatasetDir() {
  if (process.env.DATASET_DIR) return path.resolve(process.env.DATASET_DIR);
  const candidates = [
    path.resolve(process.cwd(), 'dataset'),
    path.resolve(process.cwd(), '..', 'dataset')
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

export function geocodeCachePath() {
  return process.env.GEOCODE_CACHE_PATH
    ? path.resolve(process.env.GEOCODE_CACHE_PATH)
    : path.join(resolveDatasetDir(), GEOCODE_CACHE_FILE);
}

export function geocodeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function readGeocodeCache() {
  const filePath = geocodeCachePath();
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return {};
  }
}
