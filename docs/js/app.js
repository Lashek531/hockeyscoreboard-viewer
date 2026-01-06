// js/app.js

// Ожидается, что перед этим подключён js/config.js,
// который определяет GLOBAL_INDEX_URL, USE_DRIVE, UI_VERSION и REFRESH_INTERVAL_MS.

(function () {
  "use strict";

  // ------------------------------------------------------------
  // Small helpers
  // ------------------------------------------------------------

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function safeText(s) {
    return (s === null || s === undefined) ? "" : String(s);
  }

  function isObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }

  // ------------------------------------------------------------
  // Base URL + cache-busting fetch
  // ------------------------------------------------------------

  function computeDataBaseUrl(indexUrl) {
    if (!indexUrl) return "";
    try {
      const u = new URL(indexUrl);
      u.pathname = u.pathname.replace(/\/[^\/]*$/, "");
      return u.toString();
    } catch (e) {
      return "";
    }
  }

  const DATA_BASE_URL = computeDataBaseUrl(window.GLOBAL_INDEX_URL);

  function buildUrl(pathOrUrl) {
    let url = pathOrUrl;

    if (!/^https?:\/\//i.test(pathOrUrl)) {
      const base = DATA_BASE_URL || "";
      const sep = base.endsWith("/") || pathOrUrl.startsWith("/") ? "" : "/";
      url = base + sep + pathOrUrl.replace(/^\/+/, "");
    }

    const separator = url.includes("?") ? "&" : "?";
    return url + separator + "t=" + Date.now();
  }

  async function fetchJson(pathOrUrl) {
    const url = buildUrl(pathOrUrl);
    const resp = await fetch(url, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
    return await resp.json();
  }

  // ------------------------------------------------------------
  // DOM skeleton
  // ------------------------------------------------------------

  const dom = {
    page: $(".page"),
    modalBackdrop: $("#modalBackdrop"),
    fsToggle: $("#fsToggle"),
  };

  // ------------------------------------------------------------
  // Modal
  // ------------------------------------------------------------

  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function closeModal() {
    if (!dom.modalBackdrop) return;
    dom.modalBackdrop.style.display = "none";
    clear(dom.modalBackdrop);
  }

  function openModal(title) {
    dom.modalBackdrop.style.display = "block";
    clear(dom.modalBackdrop);

    const modal = el("div", "modal");
    const header = el("div", "modal-header");
    const h = el("div", "modal-title", title);
    const close = el("button", "modal-close", "×");
    close.addEventListener("click", closeModal);

    header.appendChild(h);
    header.appendChild(close);

    const body = el("div", "modal-body");

    modal.appendChild(header);
    modal.appendChild(body);

    dom.modalBackdrop.appendChild(modal);
    return body;
  }

  dom.modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === dom.modalBackdrop) closeModal();
  });

  // ------------------------------------------------------------
  // UI build
  // ------------------------------------------------------------

  function buildMainLayout() {
    clear(dom.page);

    // Header / top area
    const root = el("div", "root");
    const top = el("div", "top");
    const center = el("div", "center");
    const bottom = el("div", "bottom");

    // Top - title + status
    const titleRow = el("div", "title-row");
    const title = el("div", "title");
    const status = el("div", "status-pill", "");
    status.id = "matchStatusPill";
    titleRow.appendChild(title);
    titleRow.appendChild(status);

    const scoreRow = el("div", "score-row");
    const leftBlock = el("div", "score-team left");
    const rightBlock = el("div", "score-team right");
    const midSep = el("div", "score-sep", ":");

    const leftName = el("div", "score-team-name", "КРАСНЫЕ");
    const rightName = el("div", "score-team-name", "БЕЛЫЕ");
    leftName.id = "teamLeftName";
    rightName.id = "teamRightName";

    const leftScore = el("div", "score-value", "0");
    const rightScore = el("div", "score-value", "0");
    leftScore.id = "teamLeftScore";
    rightScore.id = "teamRightScore";

    leftBlock.appendChild(leftName);
    leftBlock.appendChild(leftScore);

    rightBlock.appendChild(rightName);
    rightBlock.appendChild(rightScore);

    scoreRow.appendChild(leftBlock);
    scoreRow.appendChild(midSep);
    scoreRow.appendChild(rightBlock);

    top.appendChild(titleRow);
    top.appendChild(scoreRow);

    // Center - protocol + rosters
    const grid = el("div", "grid");

    const protocolCard = el("div", "card");
    const protocolTitle = el("div", "card-title", "ПРОТОКОЛ МАТЧА");
    const protocolList = el("div", "protocol");
    protocolList.id = "protocolList";
    protocolCard.appendChild(protocolTitle);
    protocolCard.appendChild(protocolList);

    const rostersCard = el("div", "card");
    const rostersTitle = el("div", "card-title", "СОСТАВЫ КОМАНД");
    const rostersGrid = el("div", "rosters");
    rostersGrid.id = "rostersGrid";
    rostersCard.appendChild(rostersTitle);
    rostersCard.appendChild(rostersGrid);

    grid.appendChild(protocolCard);
    grid.appendChild(rostersCard);

    center.appendChild(grid);

    // Bottom - menu
    const menu = el("div", "menu");

    function menuBtn(id, label) {
      const b = el("button", "menu-btn", label);
      b.id = id;
      return b;
    }

    const btnFinished = menuBtn("menuFinished", "Завершённые игры");
    const btnScorers = menuBtn("menuScorers", "Лучшие бомбардиры");
    const btnSnipers = menuBtn("menuSnipers", "Лучшие снайперы");
    const btnWins = menuBtn("menuWins", "Количество побед");
    const btnRatings = menuBtn("menuRatings", "Рейтинг игроков");

    menu.appendChild(btnFinished);
    menu.appendChild(btnScorers);
    menu.appendChild(btnSnipers);
    menu.appendChild(btnWins);
    menu.appendChild(btnRatings);

    bottom.appendChild(menu);

    // Footer version + source
    const footer = el("div", "footer");
    const ver = safeText(window.UI_VERSION || "");
    footer.textContent = `Автообновление каждые ${(window.REFRESH_INTERVAL_MS || 5000) / 1000} секунды. | Интерфейс UI v${ver} | Источник: Raspberry Pi (index.json)`;
    bottom.appendChild(footer);

    root.appendChild(top);
    root.appendChild(center);
    root.appendChild(bottom);

    dom.page.appendChild(root);
  }

  // ------------------------------------------------------------
  // Data model
  // ------------------------------------------------------------

  let GLOBAL_INDEX = null;
  let ACTIVE_GAME = null;
  let FINISHED_GAMES_INDEX = null;
  let PLAYERS_STATS = null;

  function setStatusPill(text, isDone) {
    const pill = $("#matchStatusPill");
    if (!pill) return;
    pill.textContent = safeText(text || "");
    pill.classList.toggle("done", !!isDone);
  }

  function setTitle(text) {
    const title = $(".title");
    if (title) title.textContent = safeText(text || "");
  }

  function setTeams(leftName, leftScore, rightName, rightScore) {
    const ln = $("#teamLeftName");
    const rn = $("#teamRightName");
    const ls = $("#teamLeftScore");
    const rs = $("#teamRightScore");
    if (ln) ln.textContent = safeText(leftName || "КРАСНЫЕ");
    if (rn) rn.textContent = safeText(rightName || "БЕЛЫЕ");
    if (ls) ls.textContent = safeText(leftScore ?? 0);
    if (rs) rs.textContent = safeText(rightScore ?? 0);
  }

  // ------------------------------------------------------------
  // Rendering helpers
  // ------------------------------------------------------------

  function renderProtocol(game) {
    const list = $("#protocolList");
    if (!list) return;
    clear(list);

    const goals = Array.isArray(game?.goals) ? game.goals : [];
    goals.forEach((g, idx) => {
      const row = el("div", "protocol-row");

      const num = el("div", "protocol-num", `${idx + 1}.`);
      const time = el("div", "protocol-time", safeText(g.time || ""));
      const badge = el("span", "badge", "ГОЛ");
      const desc = el("div", "protocol-desc");

      const team = safeText(g.team || "");
      const scorer = safeText(g.scorer || "");
      const assist = safeText(g.assist || "");
      if (assist) {
        desc.textContent = `${team}: ${scorer} (передачи: ${assist})`;
      } else {
        desc.textContent = `${team}: ${scorer}`;
      }

      row.appendChild(num);
      row.appendChild(time);
      row.appendChild(badge);
      row.appendChild(desc);

      list.appendChild(row);
    });

    if (goals.length === 0) {
      const empty = el("div", "protocol-empty", "Нет событий.");
      list.appendChild(empty);
    }
  }

  function renderRosters(game) {
    const grid = $("#rostersGrid");
    if (!grid) return;
    clear(grid);

    const left = el("div", "roster-col");
    const right = el("div", "roster-col");

    const ltitle = el("div", "roster-title", "КРАСНЫЕ");
    const rtitle = el("div", "roster-title", "БЕЛЫЕ");

    left.appendChild(ltitle);
    right.appendChild(rtitle);

    const leftPlayers = Array.isArray(game?.teams?.left) ? game.teams.left : [];
    const rightPlayers = Array.isArray(game?.teams?.right) ? game.teams.right : [];

    leftPlayers.forEach((p) => left.appendChild(el("div", "roster-item", safeText(p))));
    rightPlayers.forEach((p) => right.appendChild(el("div", "roster-item", safeText(p))));

    grid.appendChild(left);
    grid.appendChild(right);
  }

  // ------------------------------------------------------------
  // Modal tables (generic)
  // ------------------------------------------------------------

  function renderTableHeader(container, headers) {
    const row = el("div", "table-row header");
    headers.forEach((h) => row.appendChild(el("div", "table-cell", h)));
    container.appendChild(row);
  }

  function renderRow(container, cells) {
    const row = el("div", "table-row");
    cells.forEach((c) => row.appendChild(el("div", "table-cell", safeText(c))));
    container.appendChild(row);
  }

  // ------------------------------------------------------------
  // Finished games
  // ------------------------------------------------------------

  function getFinishedGamesList() {
    const items = Array.isArray(FINISHED_GAMES_INDEX?.games) ? FINISHED_GAMES_INDEX.games : [];
    return items.slice();
  }

  async function showFinishedGames() {
    const body = openModal("Завершённые игры");
    body.textContent = "Загрузка...";

    try {
      const idxUrl = GLOBAL_INDEX?.finishedGamesIndexUrl || GLOBAL_INDEX?.finished_index || GLOBAL_INDEX?.finishedGamesIndex || null;
      if (!idxUrl) throw new Error("No finished games index url");
      FINISHED_GAMES_INDEX = await fetchJson(idxUrl);
    } catch (e) {
      body.textContent = "Не удалось загрузить список завершённых игр.";
      return;
    }

    const list = getFinishedGamesList();
    clear(body);

    if (!list.length) {
      body.textContent = "Завершённых игр нет.";
      return;
    }

    const table = el("div", "table");
    renderTableHeader(table, ["№", "Дата", "Арена", "Счёт", "Сезон"]);

    list.forEach((g, idx) => {
      renderRow(table, [
        idx + 1,
        g.date || "",
        g.arena || "",
        `${g.score_left ?? ""}:${g.score_right ?? ""}`,
        g.season || "",
      ]);
    });

    body.appendChild(table);
  }

  // ------------------------------------------------------------
  // Stats (scorers/snipers/wins) - relies on PLAYERS_STATS
  // ------------------------------------------------------------

  async function ensurePlayersStatsLoaded() {
    if (PLAYERS_STATS) return true;
    try {
      const statsUrl = GLOBAL_INDEX?.playersStatsUrl || GLOBAL_INDEX?.players_stats || GLOBAL_INDEX?.playersStats || null;
      if (!statsUrl) return false;
      PLAYERS_STATS = await fetchJson(statsUrl);
      return true;
    } catch (e) {
      return false;
    }
  }

  function getPlayersStatsList() {
    const players = Array.isArray(PLAYERS_STATS?.players) ? PLAYERS_STATS.players : [];
    return players.slice();
  }

  function showLeaders(mode) {
    const titleMap = {
      scorers: "Лучшие бомбардиры",
      snipers: "Лучшие снайперы",
      wins: "Количество побед",
    };
    const body = openModal(titleMap[mode] || "Статистика");
    body.textContent = "Загрузка...";

    if (!PLAYERS_STATS) {
      body.textContent = "Статистика пока недоступна.";
      return;
    }

    const list = getPlayersStatsList();

    let headers = [];
    let rows = [];

    if (mode === "scorers") {
      headers = ["№", "Игрок", "Очки", "Голы", "Пасы"];
      list.sort((a, b) => {
        const ap = (a.goals || 0) + (a.assists || 0);
        const bp = (b.goals || 0) + (b.assists || 0);
        if (bp !== ap) return bp - ap;
        if ((b.goals || 0) !== (a.goals || 0)) return (b.goals || 0) - (a.goals || 0);
        return safeText(a.name).localeCompare(safeText(b.name), "ru");
      });
      rows = list.map((p, idx) => [idx + 1, p.name, (p.goals || 0) + (p.assists || 0), p.goals || 0, p.assists || 0]);
    } else if (mode === "snipers") {
      headers = ["№", "Игрок", "Голы", "Игры"];
      list.sort((a, b) => {
        if ((b.goals || 0) !== (a.goals || 0)) return (b.goals || 0) - (a.goals || 0);
        if ((b.games || 0) !== (a.games || 0)) return (b.games || 0) - (a.games || 0);
        return safeText(a.name).localeCompare(safeText(b.name), "ru");
      });
      rows = list.map((p, idx) => [idx + 1, p.name, p.goals || 0, p.games || 0]);
    } else if (mode === "wins") {
      headers = ["№", "Игрок", "Победы", "Ничьи", "Поражения", "Игры"];
      list.sort((a, b) => {
        if ((b.wins || 0) !== (a.wins || 0)) return (b.wins || 0) - (a.wins || 0);
        if ((b.draws || 0) !== (a.draws || 0)) return (b.draws || 0) - (a.draws || 0);
        if ((a.losses || 0) !== (b.losses || 0)) return (a.losses || 0) - (b.losses || 0);
        if ((b.games || 0) !== (a.games || 0)) return (b.games || 0) - (a.games || 0);
        return safeText(a.name).localeCompare(safeText(b.name), "ru");
      });
      rows = list.map((p, idx) => [idx + 1, p.name, p.wins || 0, p.draws || 0, p.losses || 0, p.games || 0]);
    }

    clear(body);

    if (!rows.length) {
      body.textContent = "Данных нет.";
      return;
    }

    const table = el("div", "table");
    renderTableHeader(table, headers);
    rows.forEach((r) => renderRow(table, r));
    body.appendChild(table);
  }

  function showTopScorers() {
    showLeaders("scorers");
  }

  function showTopSnipers() {
    showLeaders("snipers");
  }

  function showWins() {
    showLeaders("wins");
  }

  // ------------------------------------------------------------
  // Ratings (PATCHED): split home/guest by user_id
  // ------------------------------------------------------------

  async function showRatings() {
    const target = openModal("Рейтинг игроков");
    target.textContent = "Загрузка...";

    let ratings;
    try {
      // В этой версии проекта файл рейтинга лежит здесь:
      ratings = await fetchJson("base_roster/ratings.json");
    } catch (e) {
      target.textContent = "Не удалось загрузить рейтинг игроков.";
      return;
    }

    if (!ratings || !Array.isArray(ratings.players)) {
      target.textContent = "Рейтинг игроков пока недоступен.";
      return;
    }

    const playersAll = ratings.players
      .map((p) => ({
        name: p.full_name,
        base: p.base_rating,
        delta: p.season_delta,
        total: (p.base_rating || 0) + (p.season_delta || 0),
        user_id: p.user_id,
      }))
      .filter((p) => p.name);

    // Сортировка сохраняется "как есть" (total -> base -> delta -> name)
    playersAll.sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      if (b.base !== a.base) return b.base - a.base;
      if (b.delta !== a.delta) return b.delta - a.delta;
      return safeText(a.name).localeCompare(safeText(b.name), "ru");
    });

    // Разделяем по критерию user_id: >=0 домашние, <0 гостевые
    const homePlayers = playersAll.filter((p) => (p.user_id ?? 0) >= 0);
    const guestPlayers = playersAll.filter((p) => (p.user_id ?? 0) < 0);

    clear(target);

    const table = el("div", "table");

    const headers = ["№", "Игрок", "Рейтинг", "Base", "SeasonDelta"];

    // Домашние
    renderTableHeader(table, headers);

    let i = 1;
    homePlayers.forEach((p) => {
      renderRow(table, [
        i++,
        p.name,
        p.total,
        p.base,
        p.delta > 0 ? `+${p.delta}` : p.delta,
      ]);
    });

    // Гостевые (если есть)
    if (guestPlayers.length > 0) {
      const sep = el("div", "table-separator", "Гостевые игроки");
      table.appendChild(sep);

      // Повтор заголовка — чтобы гостевой блок читался как отдельная таблица, но в одном скролле
      renderTableHeader(table, headers);

      let j = 1;
      guestPlayers.forEach((p) => {
        renderRow(table, [
          j++,
          p.name,
          p.total,
          p.base,
          p.delta > 0 ? `+${p.delta}` : p.delta,
        ]);
      });
    }

    target.appendChild(table);
  }

  // ------------------------------------------------------------
  // Fullscreen
  // ------------------------------------------------------------

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function toggleFullscreen() {
    if (isFullscreen()) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }

    const root = document.documentElement;
    if (root.requestFullscreen) root.requestFullscreen();
    else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
  }

  // ------------------------------------------------------------
  // Menu wiring
  // ------------------------------------------------------------

  function initMenu() {
    const byId = (id) => document.getElementById(id);

    const btnFinished = byId("menuFinished");
    const btnScorers = byId("menuScorers");
    const btnSnipers = byId("menuSnipers");
    const btnWins = byId("menuWins");
    const btnRatings = byId("menuRatings");

    if (btnFinished) btnFinished.addEventListener("click", showFinishedGames);
    if (btnScorers) btnScorers.addEventListener("click", showTopScorers);
    if (btnSnipers) btnSnipers.addEventListener("click", showTopSnipers);
    if (btnWins) btnWins.addEventListener("click", showWins);
    if (btnRatings) btnRatings.addEventListener("click", showRatings);
  }

  // ------------------------------------------------------------
  // Load index + active game render
  // ------------------------------------------------------------

  async function loadAll() {
    try {
      GLOBAL_INDEX = await fetchJson(window.GLOBAL_INDEX_URL);
    } catch (e) {
      console.error("Failed to load index.json", e);
      setTitle("Ошибка загрузки index.json");
      return;
    }

    // Active game
    try {
      const activeUrl = GLOBAL_INDEX?.activeGameUrl || GLOBAL_INDEX?.active_game || GLOBAL_INDEX?.activeGame || "active_game.json";
      ACTIVE_GAME = await fetchJson(activeUrl);
    } catch (e) {
      console.error("Failed to load active game", e);
      ACTIVE_GAME = null;
    }

    // Players stats (optional)
    await ensurePlayersStatsLoaded();

    // Render main
    if (ACTIVE_GAME) {
      const arena = safeText(ACTIVE_GAME.arena || "");
      const date = safeText(ACTIVE_GAME.date || "");
      const title = [arena, date].filter(Boolean).join(" • ");
      setTitle(title || "Hockey Scoreboard Viewer");

      const isDone = !!ACTIVE_GAME.finished || !!ACTIVE_GAME.isFinished || (safeText(ACTIVE_GAME.status || "").toLowerCase().includes("finished"));
      setStatusPill(isDone ? "МАТЧ ЗАВЕРШЁН" : "МАТЧ ИДЁТ", isDone);

      const leftScore = ACTIVE_GAME.score_left ?? ACTIVE_GAME.scoreLeft ?? 0;
      const rightScore = ACTIVE_GAME.score_right ?? ACTIVE_GAME.scoreRight ?? 0;
      setTeams("КРАСНЫЕ", leftScore, "БЕЛЫЕ", rightScore);

      renderProtocol(ACTIVE_GAME);
      renderRosters(ACTIVE_GAME);
    } else {
      setTitle("Нет активного матча");
      setStatusPill("", false);
      setTeams("КРАСНЫЕ", 0, "БЕЛЫЕ", 0);
      renderProtocol({ goals: [] });
      renderRosters({ teams: { left: [], right: [] } });
    }
  }

  // ------------------------------------------------------------
  // Init
  // ------------------------------------------------------------

  function init() {
    buildMainLayout();
    initMenu();

    // fullscreen toggle
    if (dom.fsToggle) {
      dom.fsToggle.addEventListener("click", toggleFullscreen);
    }

    loadAll();

    const interval = Number(window.REFRESH_INTERVAL_MS || 5000);
    if (interval > 0) {
      setInterval(loadAll, interval);
    }
  }

  init();

  // авто-fullscreen не включаем специально
})();
