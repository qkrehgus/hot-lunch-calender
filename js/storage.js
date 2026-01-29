const KEYS = {
  selectedSchool: "meal.selectedSchool.v1",
  favorites: "meal.favorites.v1",
  cache: "meal.cache.v1",
};

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getSelectedSchool() {
  const raw = localStorage.getItem(KEYS.selectedSchool);
  if (!raw) return null;
  return safeParse(raw, null);
}

export function setSelectedSchool(school) {
  localStorage.setItem(KEYS.selectedSchool, JSON.stringify(school));
}

export function getFavorites() {
  const raw = localStorage.getItem(KEYS.favorites);
  const parsed = raw ? safeParse(raw, []) : [];
  return Array.isArray(parsed) ? parsed : [];
}

export function setFavorites(list) {
  localStorage.setItem(KEYS.favorites, JSON.stringify(list));
}

export function toggleFavorite(school) {
  const list = getFavorites();
  const idx = list.findIndex(
    (s) => s.SD_SCHUL_CODE === school.SD_SCHUL_CODE && s.ATPT_OFCDC_SC_CODE === school.ATPT_OFCDC_SC_CODE,
  );

  if (idx >= 0) {
    list.splice(idx, 1);
    setFavorites(list);
    return { list, added: false, removed: true, reason: null };
  }

  if (list.length >= 3) {
    return { list, added: false, removed: false, reason: "limit" };
  }

  list.unshift(school);
  setFavorites(list);
  return { list, added: true, removed: false, reason: null };
}

export function removeFavorite(school) {
  const list = getFavorites().filter(
    (s) => !(s.SD_SCHUL_CODE === school.SD_SCHUL_CODE && s.ATPT_OFCDC_SC_CODE === school.ATPT_OFCDC_SC_CODE),
  );
  setFavorites(list);
  return list;
}

function getCacheAll() {
  const raw = localStorage.getItem(KEYS.cache);
  const parsed = raw ? safeParse(raw, { meals: {}, schools: {} }) : { meals: {}, schools: {} };
  if (!parsed || typeof parsed !== "object") return { meals: {}, schools: {} };
  parsed.meals ||= {};
  parsed.schools ||= {};
  return parsed;
}

function setCacheAll(cache) {
  localStorage.setItem(KEYS.cache, JSON.stringify(cache));
}

export function cacheGetMeal(key) {
  const c = getCacheAll();
  const item = c.meals[key];
  if (!item) return null;
  if (typeof item !== "object") return null;
  const { ts, data } = item;
  // 6시간 캐시
  if (!ts || Date.now() - ts > 6 * 60 * 60 * 1000) return null;
  return data ?? null;
}

export function cacheSetMeal(key, data) {
  const c = getCacheAll();
  c.meals[key] = { ts: Date.now(), data };
  setCacheAll(c);
}

export function cacheGetSchoolSearch(query) {
  const c = getCacheAll();
  const item = c.schools[query];
  if (!item) return null;
  const { ts, data } = item;
  // 12시간 캐시
  if (!ts || Date.now() - ts > 12 * 60 * 60 * 1000) return null;
  return data ?? null;
}

export function cacheSetSchoolSearch(query, data) {
  const c = getCacheAll();
  c.schools[query] = { ts: Date.now(), data };
  setCacheAll(c);
}

