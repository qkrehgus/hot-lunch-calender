import { escapeHtml, formatPrettyYmd, dayLabel } from "./utils.js";

export function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

export function showToast(toastEl, message, { ms = 1800 } = {}) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("is-show");
  window.clearTimeout(showToast._t);
  showToast._t = window.setTimeout(() => toastEl.classList.remove("is-show"), ms);
}

export function openModal(modalEl, overlayEl) {
  modalEl?.classList.add("is-open");
  overlayEl?.classList.add("is-open");
  modalEl?.setAttribute("aria-hidden", "false");
  overlayEl?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

export function closeModal(modalEl, overlayEl) {
  modalEl?.classList.remove("is-open");
  overlayEl?.classList.remove("is-open");
  modalEl?.setAttribute("aria-hidden", "true");
  overlayEl?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

export function renderSkeleton(containerEl, { blocks = 1 } = {}) {
  if (!containerEl) return;
  const parts = [];
  for (let i = 0; i < blocks; i += 1) {
    parts.push(`
      <div class="skeleton" aria-hidden="true">
        <div class="sk-line sm"></div>
        <div class="sk-line md"></div>
        <div class="sk-line lg"></div>
        <div class="sk-block"></div>
      </div>
    `);
  }
  containerEl.innerHTML = parts.join("");
}

export function renderError(containerEl, { title, desc, onRetryLabel = "재시도" } = {}) {
  if (!containerEl) return;
  containerEl.innerHTML = `
    <div class="error">
      <div class="error__title">${escapeHtml(title || "오류가 발생했어요")}</div>
      <div class="error__desc">${escapeHtml(desc || "잠시 후 다시 시도해주세요.")}</div>
      <div class="error__actions">
        <button class="btn btn--soft" type="button" data-role="retry">${escapeHtml(onRetryLabel)}</button>
      </div>
    </div>
  `;
  return containerEl.querySelector('[data-role="retry"]');
}

// 예) "김치(9.13.)" -> { name:"김치", allergy:["9","13"] }
export function parseDishLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;

  // 괄호 안 숫자만 추출
  const allergyMatches = [...trimmed.matchAll(/\(([\d.\s]+)\)/g)].map((m) => m[1]);
  const allergyNums = allergyMatches
    .flatMap((s) => s.split("."))
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));

  const name = trimmed.replaceAll(/\(([\d.\s]+)\)/g, "").replaceAll(/\s+/g, " ").trim();
  return { name, allergyNums };
}

export function parseDishText(ddishNm) {
  const lines = String(ddishNm || "")
    .split("<br/>")
    .map((s) => s.replace(/<br\s*\/?>/g, "").trim())
    .filter(Boolean);
  return lines.map(parseDishLine).filter(Boolean);
}

export function renderMeal(containerEl, { date, mealType, ddishNm, calories } = {}) {
  if (!containerEl) return;
  const items = parseDishText(ddishNm);
  if (!items.length) {
    containerEl.innerHTML = `<div class="empty-state">급식 정보가 없어요.</div>`;
    return;
  }

  const pretty = formatPrettyYmd(date);
  const dLabel = dayLabel(date);
  const cal = calories ? ` · ${escapeHtml(calories)}` : "";

  containerEl.innerHTML = `
    <div class="meal">
      <div class="meal__row">
        <div class="meal__date">${escapeHtml(pretty)} (${escapeHtml(dLabel)})</div>
        <div class="meal__type">${escapeHtml(mealType || "급식")}${cal}</div>
      </div>
      <div class="meal__items">
        ${items
          .map((it) => {
            const allergy = it.allergyNums?.length ? it.allergyNums.join(",") : "";
            return `
              <span class="pill">
                <span class="pill__name">${escapeHtml(it.name)}</span>
                ${allergy ? `<span class="pill__allergy">알레르기 ${escapeHtml(allergy)}</span>` : ""}
              </span>
            `;
          })
          .join("")}
      </div>
      <div class="subtle" style="margin-top:10px;">
        알레르기 숫자는 식단 표기 기준(나이스 원문)을 따릅니다.
      </div>
    </div>
  `;
}

export function renderWeek(containerEl, { days } = {}) {
  if (!containerEl) return;
  if (!Array.isArray(days) || !days.length) {
    containerEl.innerHTML = `<div class="empty-state">주간 급식 정보가 없어요.</div>`;
    return;
  }

  containerEl.innerHTML = `
    <div class="week-list">
      ${days
        .map((d) => {
          const pretty = formatPrettyYmd(d.date);
          const dLabel = dayLabel(d.date);
          const badgeClass = d.meal ? "badge--ok" : "badge--none";
          const badgeLabel = d.meal ? "제공" : "미제공";
          const items = d.meal ? parseDishText(d.meal.dish).slice(0, 5) : [];
          return `
            <div class="week-item">
              <div class="week-item__head">
                <div class="week-item__day">${escapeHtml(pretty)} (${escapeHtml(dLabel)})</div>
                <div class="badge ${badgeClass}">${badgeLabel}</div>
              </div>
              ${
                d.meal
                  ? `
                    <div class="subtle" style="font-weight:900;margin-bottom:8px;">
                      ${escapeHtml(d.meal.mealType || "급식")}
                    </div>
                    <div class="meal__items">
                      ${items
                        .map((it) => `<span class="pill"><span class="pill__name">${escapeHtml(it.name)}</span></span>`)
                        .join("")}
                      ${parseDishText(d.meal.dish).length > items.length ? `<span class="pill"><span class="pill__name">…더보기</span></span>` : ""}
                    </div>
                  `
                  : `<div class="subtle">급식이 제공되지 않는 날이에요.</div>`
              }
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

