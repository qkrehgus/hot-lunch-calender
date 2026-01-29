import { cacheGetMeal, cacheGetSchoolSearch, cacheSetMeal, cacheSetSchoolSearch } from "./storage.js";

function cfg() {
  const c = window.APP_CONFIG || {};
  return {
    base: c.NEIS_API_BASE || "https://open.neis.go.kr/hub",
    key: c.NEIS_API_KEY || "",
  };
}

function buildUrl(endpoint, params) {
  const { base } = cfg();
  const u = new URL(`${base}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    u.searchParams.set(k, String(v));
  });
  return u.toString();
}

async function fetchJson(url, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function parseNeisRows(payload, key) {
  // 성공: { [key]: [ {head:...}, {row:[...]} ] }
  // 실패/없음: { RESULT: { CODE: 'INFO-200', MESSAGE: '해당하는 데이터가 없습니다.' } } 또는 head만 존재
  if (!payload || typeof payload !== "object") return { rows: null, result: payload?.RESULT ?? null };
  const block = payload[key];
  if (!Array.isArray(block)) return { rows: null, result: payload.RESULT ?? null };
  const rowPart = block.find((x) => x && typeof x === "object" && Array.isArray(x.row));
  if (!rowPart) return { rows: [], result: payload.RESULT ?? null };
  return { rows: rowPart.row ?? [], result: payload.RESULT ?? null };
}

export async function searchSchools(query) {
  const q = query.trim();
  if (!q) return [];

  const cached = cacheGetSchoolSearch(q);
  if (cached) return cached;

  const { key } = cfg();
  if (!key) throw new Error("API_KEY_MISSING");

  const url = buildUrl("schoolInfo", {
    KEY: key,
    Type: "json",
    pIndex: 1,
    pSize: 50,
    SCHUL_NM: q,
  });

  const json = await fetchJson(url);
  const { rows } = parseNeisRows(json, "schoolInfo");
  const list = (rows || []).map((r) => ({
    ATPT_OFCDC_SC_CODE: r.ATPT_OFCDC_SC_CODE,
    ATPT_OFCDC_SC_NM: r.ATPT_OFCDC_SC_NM,
    SD_SCHUL_CODE: r.SD_SCHUL_CODE,
    SCHUL_NM: r.SCHUL_NM,
    SCHUL_KND_SC_NM: r.SCHUL_KND_SC_NM,
    ORG_RDNMA: r.ORG_RDNMA,
  }));

  cacheSetSchoolSearch(q, list);
  return list;
}

function mealCacheKey({ ATPT_OFCDC_SC_CODE, SD_SCHUL_CODE, fromYmd, toYmd }) {
  return `${ATPT_OFCDC_SC_CODE}:${SD_SCHUL_CODE}:${fromYmd}-${toYmd}`;
}

export async function getMealsForRange({ school, fromYmd, toYmd }) {
  const { key } = cfg();
  if (!key) throw new Error("API_KEY_MISSING");
  if (!school?.ATPT_OFCDC_SC_CODE || !school?.SD_SCHUL_CODE) throw new Error("SCHOOL_MISSING");

  const cacheKey = mealCacheKey({
    ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: school.SD_SCHUL_CODE,
    fromYmd,
    toYmd,
  });

  const cached = cacheGetMeal(cacheKey);
  if (cached) return cached;

  const url = buildUrl("mealServiceDietInfo", {
    KEY: key,
    Type: "json",
    pIndex: 1,
    pSize: 200,
    ATPT_OFCDC_SC_CODE: school.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: school.SD_SCHUL_CODE,
    MLSV_FROM_YMD: fromYmd,
    MLSV_TO_YMD: toYmd,
  });

  const json = await fetchJson(url);
  const { rows } = parseNeisRows(json, "mealServiceDietInfo");
  const meals = (rows || []).map((r) => ({
    ymd: r.MLSV_YMD,
    mealType: r.MMEAL_SC_NM,
    dish: r.DDISH_NM,
    calories: r.CAL_INFO,
    nutrition: r.NTR_INFO,
    origin: r.ORPLC_INFO,
  }));

  cacheSetMeal(cacheKey, meals);
  return meals;
}

