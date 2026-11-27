(function () {
  "use strict";

  const PARKS = window.PARKS || [];
  const SIZE_TITLE = { L: "大きな公園", M: "中くらいの公園", S: "小さな公園" };
  const AREAS = ["北部", "中部", "南部", "宮古", "八重山"];
  const REMOTE = ["宮古", "八重山"]; // 本島から離れていて、初期表示の地図には入らない地域

  const state = { size: "ALL", area: "ALL", q: "", view: location.hash === "#map" ? "map" : "list" };

  const $list = document.getElementById("list");
  const $count = document.getElementById("result-count");
  const $q = document.getElementById("q");
  const $areas = document.getElementById("areas");
  const $sizes = document.querySelector(".sizes");
  const $showAll = document.getElementById("show-all");
  const $views = document.querySelector(".views");
  const $mapView = document.getElementById("map-view");
  const $mapNote = document.getElementById("map-note");

  const hasCoords = (p) => typeof p.lat === "number" && typeof p.lng === "number";

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

  function googleMapsUrl(p) {
    const q = hasCoords(p) ? `${p.lat},${p.lng}` : p.name.replace(/（.*?）/g, "") + " " + p.city;
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }

  // 一覧のカードと地図のポップアップで共通の部分
  function details(p) {
    const notice = p.notice ? `<p class="notice"><b>お知らせ</b>${escapeHtml(p.notice)}</p>` : "";
    return `
      <span class="where">${escapeHtml(p.city)}（<b>${escapeHtml(p.area)}</b>）</span>
      ${notice}
      <p>${escapeHtml(p.description)}</p>`;
  }

  function outLinks(p) {
    const official = /^https:\/\//.test(p.officialUrl || "")
      ? `<a class="map" href="${escapeHtml(p.officialUrl)}" target="_blank" rel="noopener">公式ページ</a>` : "";
    return `<a class="map" href="${googleMapsUrl(p)}" target="_blank" rel="noopener">Googleマップで開く</a>${official}`;
  }

  function card(p) {
    const i = PARKS.indexOf(p);
    const tags = (p.tags || []).map((t) => `<li>${escapeHtml(t)}</li>`).join("");
    const onMap = hasCoords(p)
      ? `<button type="button" class="map to-map" data-park="${i}">地図で見る</button>` : "";
    return `
      <article class="park">
        <h3>${escapeHtml(p.name)}</h3>
        ${details(p)}
        <ul class="tags">${tags}</ul>
        <span class="links">${onMap}${outLinks(p)}</span>
      </article>`;
  }

  /* ───────── 地図 ───────── */
  let map = null;
  const markers = new Map(); // PARKS の番号 → マーカー

  function initMap() {
    if (map || !window.L) return;
    const css = getComputedStyle(document.documentElement);
    const color = { L: css.getPropertyValue("--ai").trim(), M: css.getPropertyValue("--pine").trim(), S: css.getPropertyValue("--kawara").trim() };
    const radius = { L: 12, M: 9, S: 6 }; // ピンの大きさも公園の広さを表す

    map = L.map("map", { scrollWheelZoom: false, zoomSnap: 0.5 }).setView([26.4, 127.85], 9);
    // 国土地理院の淡色地図（色のついたピンが見やすい。出典の表示が利用条件）
    L.tileLayer("https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank" rel="noopener">地理院タイル</a>'
    }).addTo(map);

    // 大きい公園のピンが小さい公園を隠さないよう、大→中→小の順に重ねる
    ["L", "M", "S"].forEach((s) => {
      PARKS.forEach((p, i) => {
        if (p.size !== s || !hasCoords(p)) return;
        const m = L.circleMarker([p.lat, p.lng], {
          radius: radius[s], color: "#fbfaf5", weight: 2, fillColor: color[s], fillOpacity: 1
        })
          .bindTooltip(p.name, { direction: "top", offset: [0, -radius[s]], className: "park-tip" })
          .bindPopup(`<div class="popup park" style="--c:${color[s]}"><h3>${escapeHtml(p.name)}</h3>${details(p)}<span class="links">${outLinks(p)}</span></div>`,
            { maxWidth: 300, minWidth: 220, autoPanPadding: [16, 16] });
        markers.set(i, m);
      });
    });

    // 地図の大きさが0のまま範囲合わせをすると極端に拡大されるので、
    // 大きさが変わったら（表示された・画面を回転した など）合わせ直す
    if ("ResizeObserver" in window) {
      new ResizeObserver(([e]) => {
        if (!e.contentRect.width) return;
        map.invalidateSize();
        if (fitPending) updateMap(PARKS.filter(matches));
      }).observe(document.getElementById("map"));
    }
  }
  let fitPending = false; // 地図の大きさが0で範囲合わせを見送ったとき true

  function updateMap(hits) {
    if (!map) return;
    const shown = [];
    markers.forEach((m, i) => {
      if (hits.includes(PARKS[i])) { m.addTo(map); shown.push(PARKS[i]); }
      else m.remove();
    });

    // 表示範囲：地域を選んでいなければ本島のピンに合わせる（離島は地域で選ぶと表示）
    const mainland = shown.filter((p) => !REMOTE.includes(p.area));
    const target = state.area === "ALL" && mainland.length ? mainland : shown;
    fitPending = !map.getContainer().offsetWidth;
    if (fitPending) target.length = 0; // 大きさが分かってから合わせる
    // animate: false … 続けて特定の公園へ寄るとき（地図で見る）に、遅れて終わるアニメーションで上書きされないように
    if (target.length === 1) map.setView([target[0].lat, target[0].lng], 14, { animate: false });
    else if (target.length) map.fitBounds(target.map((p) => [p.lat, p.lng]), { padding: [32, 32], maxZoom: 14, animate: false });

    // 地図の下の注記
    const notes = [];
    if (!hits.length) notes.push("条件に合う公園はありません。地域や検索語を変えてみてください。");
    const remoteShown = shown.filter((p) => REMOTE.includes(p.area));
    if (state.area === "ALL" && mainland.length && remoteShown.length) {
      notes.push(`宮古・八重山の公園（${remoteShown.length}か所）は、地域の「宮古」「八重山」を選ぶと表示されます。`);
    }
    const noPin = hits.filter((p) => !hasCoords(p));
    if (noPin.length) notes.push(`位置を確認中のため地図に出ていない公園：${noPin.map((p) => escapeHtml(p.name)).join("、")}`);
    $mapNote.innerHTML = notes.join("<br>");
  }

  function setView(view) {
    state.view = view;
    $views.querySelectorAll(".view").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
    $mapView.hidden = view !== "map";
    $list.hidden = view === "map";
    history.replaceState(null, "", view === "map" ? "#map" : location.pathname + location.search);
    if (view === "map") {
      initMap();
      if (map) map.invalidateSize();
    }
    render();
  }

  function showOnMap(i) {
    // 選んだ公園が今の絞り込みで隠れていたら、絞り込みを解除する
    if (!matches(PARKS[i])) {
      $q.value = ""; state.q = "";
      state.size = "ALL"; state.area = "ALL";
      syncButtons();
    }
    setView("map");
    const m = markers.get(i);
    if (!m) return;
    // 貼り付いた絞り込みバーの下に地図の上端がくるようにスクロールしてから開く
    const bar = document.querySelector(".filters");
    const barH = getComputedStyle(bar).position === "sticky" ? bar.offsetHeight : 0;
    window.scrollTo({ top: $mapView.getBoundingClientRect().top + window.scrollY - barH });
    map.setView(m.getLatLng(), 15, { animate: false });
    m.openPopup();
  }

  /* ───────── 一覧 ───────── */
  function render() {
    const hits = PARKS.filter(matches);
    $count.innerHTML = `<b>${hits.length}</b> か所`;
    updateMap(hits);
    if (state.view === "map") return;

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
          <div class="list-${s}">${group.map(card).join("")}</div>
        </section>`;
    }).join("");
  }

  function syncButtons() {
    $sizes.classList.toggle("has-selection", state.size !== "ALL");
    $sizes.querySelectorAll(".size").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.size === state.size)));
    $showAll.hidden = state.size === "ALL";
    $areas.querySelectorAll(".area").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.area === state.area)));
  }

  function setSize(size) { state.size = size; syncButtons(); render(); }
  function setArea(area) { state.area = area; syncButtons(); render(); }

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

  $views.addEventListener("click", (e) => {
    const btn = e.target.closest(".view");
    if (btn && btn.dataset.view !== state.view) setView(btn.dataset.view);
  });

  $q.addEventListener("input", () => {
    state.q = $q.value.trim().toLowerCase();
    render();
  });

  $list.addEventListener("click", (e) => {
    const toMap = e.target.closest(".to-map");
    if (toMap) { showOnMap(Number(toMap.dataset.park)); return; }
    if (e.target.id !== "reset") return;
    $q.value = "";
    state.q = "";
    state.size = "ALL";
    state.area = "ALL";
    syncButtons();
    render();
  });

  setView(state.view);
})();
