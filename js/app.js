(function () {
  "use strict";

  const PARKS = window.PARKS || [];
  const SIZE_TITLE = { L: "大きな公園", M: "中くらいの公園", S: "小さな公園" };
  const AREAS = ["北部", "中部", "南部", "宮古", "八重山"];

  const state = { size: "ALL", area: "ALL", q: "" };

  const $list = document.getElementById("list");
  const $count = document.getElementById("result-count");
  const $q = document.getElementById("q");
  const $areas = document.getElementById("areas");
  const $sizes = document.querySelector(".sizes");
  const $showAll = document.getElementById("show-all");

  // 地域ボタン
  ["ALL", ...AREAS].forEach((a) => {
    const b = document.createElement("button");
    b.className = "area";
    b.dataset.area = a;
    b.textContent = a === "ALL" ? "すべて" : a;
    b.setAttribute("aria-pressed", String(a === "ALL"));
    $areas.appendChild(b);
  });

  // 広さごとの件数
  document.querySelectorAll("[data-count]").forEach((el) => {
    el.textContent = PARKS.filter((p) => p.size === el.dataset.count).length;
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function matches(p) {
    if (state.size !== "ALL" && p.size !== state.size) return false;
    if (state.area !== "ALL" && p.area !== state.area) return false;
    if (state.q) {
      const hay = [p.name, p.city, p.area, p.description, ...(p.tags || [])].join(" ").toLowerCase();
      if (!state.q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  function park(p) {
    const mapUrl = "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(p.name.replace(/（.*?）/g, "") + " " + p.city);
    const tags = (p.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
    const notice = p.notice ? `<p class="notice"><b>お知らせ</b>${escapeHtml(p.notice)}</p>` : "";
    const official = /^https:\/\//.test(p.officialUrl || "")
      ? `<a class="map" href="${escapeHtml(p.officialUrl)}" target="_blank" rel="noopener">公式ページ</a>` : "";
    return `
      <article class="park">
        <h3>${escapeHtml(p.name)}</h3>
        <span class="where">${escapeHtml(p.city)}（<b>${escapeHtml(p.area)}</b>）</span>
        ${notice}
        <p>${escapeHtml(p.description)}</p>
        <ul class="tags">${tags}</ul>
        <span class="links">
          <a class="map" href="${mapUrl}" target="_blank" rel="noopener">Googleマップで開く</a>
          ${official}
        </span>
      </article>`;
  }

  function render() {
    const hits = PARKS.filter(matches);
    $count.innerHTML = `<b>${hits.length}</b> か所`;

    if (!hits.length) {
      $list.innerHTML = `
        <div class="empty">
          <p>条件に合う公園はありません。地域や検索語を変えてみてください。</p>
          <button type="button" id="reset">条件をリセット</button>
        </div>`;
      return;
    }

    $list.innerHTML = ["L", "M", "S"].map((s) => {
      const group = hits.filter((p) => p.size === s);
      if (!group.length) return "";
      return `
        <section class="group group-${s}" aria-labelledby="g-${s}">
          <div class="group-head">
            <h2 class="group-title" id="g-${s}">${SIZE_TITLE[s]}</h2>
            <span class="group-count">${group.length}か所</span>
          </div>
          <div class="list-${s}">${group.map(park).join("")}</div>
        </section>`;
    }).join("");
  }

  function setSize(size) {
    state.size = size;
    $sizes.classList.toggle("has-selection", size !== "ALL");
    $sizes.querySelectorAll(".size").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.size === size));
    });
    $showAll.hidden = size === "ALL";
    render();
  }

  function setArea(area) {
    state.area = area;
    $areas.querySelectorAll(".area").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.area === area));
    });
    render();
  }

  $sizes.addEventListener("click", (e) => {
    const btn = e.target.closest(".size");
    if (!btn) return;
    // 選択中の字をもう一度押すと解除
    setSize(state.size === btn.dataset.size ? "ALL" : btn.dataset.size);
  });

  $showAll.addEventListener("click", () => setSize("ALL"));

  $areas.addEventListener("click", (e) => {
    const btn = e.target.closest(".area");
    if (btn) setArea(btn.dataset.area);
  });

  $q.addEventListener("input", () => {
    state.q = $q.value.trim().toLowerCase();
    render();
  });

  $list.addEventListener("click", (e) => {
    if (e.target.id !== "reset") return;
    $q.value = "";
    state.q = "";
    setArea("ALL");
    setSize("ALL");
  });

  render();
})();
