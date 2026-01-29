import { getMealsForRange, searchSchools } from "./api.js";
import {
  getFavorites,
  getSelectedSchool,
  removeFavorite,
  setSelectedSchool,
  toggleFavorite,
} from "./storage.js";
import { addDays, debounce, escapeHtml, formatPrettyYmd, formatYmd, startOfWeekMon } from "./utils.js";
import {
  closeModal,
  openModal,
  renderError,
  renderMeal,
  renderSkeleton,
  renderWeek,
  setText,
  showToast,
} from "./ui.js";

const $ = (sel) => document.querySelector(sel);

const els = {
  selectedSchoolName: $("#selectedSchoolName"),
  openSchoolModalBtn: $("#openSchoolModalBtn"),
  closeSchoolModalBtn: $("#closeSchoolModalBtn"),
  modalOverlay: $("#modalOverlay"),
  schoolModal: $("#schoolModal"),
  schoolSearchInput: $("#schoolSearchInput"),
  schoolSearchClearBtn: $("#schoolSearchClearBtn"),
  schoolResults: $("#schoolResults"),
  schoolResultsHint: $("#schoolResultsHint"),
  favoriteChips: $("#favoriteChips"),
  favoritesHint: $("#favoritesHint"),
  manageFavoritesBtn: $("#manageFavoritesBtn"),
  todayMeta: $("#todayMeta"),
  weekMeta: $("#weekMeta"),
  todayCardBody: $("#todayCardBody"),
  weekCardBody: $("#weekCardBody"),
  refreshBtn: $("#refreshBtn"),
  tabTodayBtn: $("#tabTodayBtn"),
  tabWeekBtn: $("#tabWeekBtn"),
  toast: $("#toast"),
  buildInfo: $("#buildInfo"),
};

const state = {
  selectedSchool: null,
  favorites: [],
  manageMode: false,
  view: "today", // today | week
  lastSchoolQuery: "",
  lastMeals: [],
};

function ensureApiKey() {
  const key = window.APP_CONFIG?.NEIS_API_KEY;
  if (!key) {
    const retryBtn = renderError(els.todayCardBody, {
      title: "API 키가 필요해요",
      desc: "나이스 Open API 키를 발급받아 `js/config.js`의 NEIS_API_KEY에 넣어주세요.",
      onRetryLabel: "확인했어요",
    });
    retryBtn?.addEventListener("click", () => showToast(els.toast, "config.js에 키를 넣고 새로고침 해주세요."));
    renderError(els.weekCardBody, {
      title: "API 키가 필요해요",
      desc: "나이스 Open API 키를 발급받아 `js/config.js`의 NEIS_API_KEY에 넣어주세요.",
      onRetryLabel: "확인했어요",
    });
    return false;
  }
  return true;
}

function setView(view) {
  state.view = view;
  const isToday = view === "today";
  els.tabTodayBtn.classList.toggle("is-active", isToday);
  els.tabWeekBtn.classList.toggle("is-active", !isToday);
  els.tabTodayBtn.setAttribute("aria-selected", isToday ? "true" : "false");
  els.tabWeekBtn.setAttribute("aria-selected", !isToday ? "true" : "false");
  els.weekCardBody.closest(".card")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  renderFromState();
}

function renderFavorites() {
  const list = state.favorites;
  const selected = state.selectedSchool;

  if (!list.length) {
    els.favoriteChips.innerHTML = "";
    els.favoritesHint.style.display = "block";
    return;
  }

  els.favoritesHint.style.display = "none";
  els.favoriteChips.innerHTML = list
    .map((s) => {
      const isActive =
        selected &&
        selected.SD_SCHUL_CODE === s.SD_SCHUL_CODE &&
        selected.ATPT_OFCDC_SC_CODE === s.ATPT_OFCDC_SC_CODE;

      return `
        <button class="chip ${isActive ? "is-active" : ""}" type="button"
          data-role="fav"
          data-atpt="${s.ATPT_OFCDC_SC_CODE}"
          data-code="${s.SD_SCHUL_CODE}">
          <span class="chip__name">${escapeHtml(s.SCHUL_NM)}</span>
          <span class="chip__meta">${escapeHtml(s.ATPT_OFCDC_SC_NM)}</span>
          ${state.manageMode ? `<span class="chip__x" aria-hidden="true">✕</span>` : ""}
        </button>
      `;
    })
    .join("");

  els.favoriteChips.querySelectorAll('[data-role="fav"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const atpt = btn.getAttribute("data-atpt");
      const code = btn.getAttribute("data-code");
      const school = state.favorites.find((x) => x.ATPT_OFCDC_SC_CODE === atpt && x.SD_SCHUL_CODE === code);
      if (!school) return;

      if (state.manageMode) {
        state.favorites = removeFavorite(school);
        showToast(els.toast, "즐겨찾기에서 삭제했어요.");
        renderFavorites();
        return;
      }

      pickSchool(school, { close: false });
    });
  });
}

function renderSelectedSchoolName() {
  setText(els.selectedSchoolName, state.selectedSchool ? state.selectedSchool.SCHUL_NM : "학교 선택");
}

function renderSchoolResults(list) {
  if (!list.length) {
    els.schoolResults.innerHTML = "";
    els.schoolResultsHint.style.display = "block";
    return;
  }

  els.schoolResultsHint.style.display = "none";

  const favs = state.favorites;
  els.schoolResults.innerHTML = list
    .map((s) => {
      const isFav = favs.some(
        (f) => f.SD_SCHUL_CODE === s.SD_SCHUL_CODE && f.ATPT_OFCDC_SC_CODE === s.ATPT_OFCDC_SC_CODE,
      );
      const meta = `${s.ATPT_OFCDC_SC_NM} · ${s.SCHUL_KND_SC_NM || "학교"}${s.ORG_RDNMA ? " · " + s.ORG_RDNMA : ""}`;
      return `
        <div class="list-item" role="listitem"
          data-role="school"
          data-atpt="${s.ATPT_OFCDC_SC_CODE}"
          data-code="${s.SD_SCHUL_CODE}">
          <div class="list-item__name">${escapeHtml(s.SCHUL_NM)}</div>
          <div class="list-item__meta">${escapeHtml(meta)}</div>
          <div class="list-item__actions">
            <button class="btn btn--soft" type="button" data-role="choose">선택</button>
            <button class="btn" type="button" data-role="fav">${isFav ? "즐겨찾기 해제" : "즐겨찾기 추가"}</button>
          </div>
        </div>
      `;
    })
    .join("");

  els.schoolResults.querySelectorAll('[data-role="school"]').forEach((rowEl) => {
    const atpt = rowEl.getAttribute("data-atpt");
    const code = rowEl.getAttribute("data-code");
    const school = list.find((x) => x.ATPT_OFCDC_SC_CODE === atpt && x.SD_SCHUL_CODE === code);
    if (!school) return;

    rowEl.querySelector('[data-role="choose"]')?.addEventListener("click", () => {
      pickSchool(school, { close: true });
    });

    rowEl.querySelector('[data-role="fav"]')?.addEventListener("click", () => {
      const res = toggleFavorite(school);
      state.favorites = res.list;
      renderFavorites();
      if (res.reason === "limit") {
        showToast(els.toast, "즐겨찾기는 최대 3개까지 저장할 수 있어요.");
        return;
      }
      showToast(els.toast, res.added ? "즐겨찾기에 추가했어요." : "즐겨찾기를 해제했어요.");
      // 버튼 텍스트 갱신
      const btn = rowEl.querySelector('[data-role="fav"]');
      if (btn) btn.textContent = res.added ? "즐겨찾기 해제" : "즐겨찾기 추가";
    });
  });
}

function getWeekDates(baseDate = new Date()) {
  const mon = startOfWeekMon(baseDate);
  return [0, 1, 2, 3, 4].map((i) => addDays(mon, i));
}

function pickSchool(school, { close } = {}) {
  state.selectedSchool = school;
  setSelectedSchool(school);
  renderSelectedSchoolName();
  showToast(els.toast, `${school.SCHUL_NM} 선택 완료`);
  if (close) closeModal(els.schoolModal, els.modalOverlay);
  loadMeals();
}

function renderFromState() {
  renderSelectedSchoolName();
  renderFavorites();
  const today = new Date();
  setText(els.todayMeta, `${formatPrettyYmd(today)} (${["일","월","화","수","목","금","토"][today.getDay()]})`);
  const week = getWeekDates(today);
  setText(els.weekMeta, `${formatPrettyYmd(week[0])} ~ ${formatPrettyYmd(week[4])}`);
}

function findMealForDay(meals, ymd) {
  // 한 날짜에 조식/중식/석식 등이 있을 수 있는데, 기본은 '중식' 우선
  const byDay = meals.filter((m) => m.ymd === ymd);
  if (!byDay.length) return null;
  const lunch = byDay.find((m) => m.mealType?.includes("중식"));
  return lunch || byDay[0];
}

async function loadMeals() {
  if (!ensureApiKey()) return;
  if (!state.selectedSchool) {
    els.todayCardBody.innerHTML = `<div class="empty-state">학교를 선택하면 오늘 급식이 바로 보여요.</div>`;
    els.weekCardBody.innerHTML = `<div class="empty-state">학교를 선택하면 주간 급식이 보여요.</div>`;
    return;
  }

  renderSkeleton(els.todayCardBody, { blocks: 1 });
  renderSkeleton(els.weekCardBody, { blocks: 1 });

  const today = new Date();
  const weekDates = getWeekDates(today);
  const fromYmd = formatYmd(weekDates[0]);
  const toYmd = formatYmd(weekDates[4]);

  try {
    const meals = await getMealsForRange({ school: state.selectedSchool, fromYmd, toYmd });
    state.lastMeals = meals;
    renderMealsUI();
  } catch (e) {
    const msg = e?.message || String(e);
    const desc =
      msg === "API_KEY_MISSING"
        ? "나이스 Open API 키가 비어있어요. `js/config.js`를 확인해주세요."
        : "네트워크/서버 문제로 급식을 불러오지 못했어요.";

    const retry1 = renderError(els.todayCardBody, { title: "급식 불러오기 실패", desc, onRetryLabel: "재시도" });
    retry1?.addEventListener("click", () => loadMeals());

    const retry2 = renderError(els.weekCardBody, { title: "급식 불러오기 실패", desc, onRetryLabel: "재시도" });
    retry2?.addEventListener("click", () => loadMeals());
  }
}

function renderMealsUI() {
  const meals = state.lastMeals || [];
  const today = new Date();
  const todayYmd = formatYmd(today);
  const todayMeal = findMealForDay(meals, todayYmd);

  if (!todayMeal) {
    els.todayCardBody.innerHTML = `<div class="empty-state">오늘은 급식이 제공되지 않아요.</div>`;
  } else {
    renderMeal(els.todayCardBody, {
      date: today,
      mealType: todayMeal.mealType,
      ddishNm: todayMeal.dish,
      calories: todayMeal.calories,
    });
  }

  const weekDates = getWeekDates(today);
  const days = weekDates.map((d) => {
    const ymd = formatYmd(d);
    const meal = findMealForDay(meals, ymd);
    return { date: d, meal };
  });
  renderWeek(els.weekCardBody, { days });

  // 탭 상태에 따라 스크롤/포커스 느낌만 주고, 두 카드 모두는 항상 최신 유지
  if (state.view === "week") {
    els.weekCardBody.closest(".card")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

async function doSchoolSearch(q) {
  const query = q.trim();
  state.lastSchoolQuery = query;

  if (!query) {
    renderSchoolResults([]);
    return;
  }

  // 로딩 표시 (모달 내부)
  els.schoolResultsHint.style.display = "none";
  els.schoolResults.innerHTML = `
    <div class="skeleton" aria-hidden="true">
      <div class="sk-line sm"></div>
      <div class="sk-line md"></div>
      <div class="sk-line lg"></div>
    </div>
  `;

  try {
    const results = await searchSchools(query);
    if (state.lastSchoolQuery !== query) return; // stale
    renderSchoolResults(results);
  } catch (e) {
    const msg = e?.message || String(e);
    const desc =
      msg === "API_KEY_MISSING"
        ? "나이스 Open API 키가 비어있어요. `js/config.js`를 확인해주세요."
        : "검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
    const retry = renderError(els.schoolResults, { title: "학교 검색 실패", desc, onRetryLabel: "다시 검색" });
    retry?.addEventListener("click", () => doSchoolSearch(query));
  }
}

function wireEvents() {
  els.openSchoolModalBtn.addEventListener("click", () => {
    openModal(els.schoolModal, els.modalOverlay);
    els.schoolSearchInput.focus();
  });
  els.closeSchoolModalBtn.addEventListener("click", () => closeModal(els.schoolModal, els.modalOverlay));
  els.modalOverlay.addEventListener("click", () => closeModal(els.schoolModal, els.modalOverlay));
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal(els.schoolModal, els.modalOverlay);
  });

  const onInput = debounce((e) => doSchoolSearch(e.target.value), 260);
  els.schoolSearchInput.addEventListener("input", onInput);
  els.schoolSearchClearBtn.addEventListener("click", () => {
    els.schoolSearchInput.value = "";
    els.schoolSearchInput.focus();
    renderSchoolResults([]);
  });

  els.manageFavoritesBtn.addEventListener("click", () => {
    state.manageMode = !state.manageMode;
    els.manageFavoritesBtn.textContent = state.manageMode ? "완료" : "관리";
    renderFavorites();
    showToast(els.toast, state.manageMode ? "삭제할 즐겨찾기를 눌러주세요." : "즐겨찾기 관리 종료");
  });

  els.refreshBtn.addEventListener("click", () => loadMeals());

  els.tabTodayBtn.addEventListener("click", () => setView("today"));
  els.tabWeekBtn.addEventListener("click", () => setView("week"));
}

function bootstrap() {
  state.favorites = getFavorites();
  state.selectedSchool = getSelectedSchool();
  renderFromState();
  wireEvents();
  els.buildInfo.textContent = `Vanilla JS · ${new Date().getFullYear()}`;

  if (state.selectedSchool) {
    loadMeals();
  } else {
    ensureApiKey(); // 키 안내는 미리 보여주기
  }
}

bootstrap();

