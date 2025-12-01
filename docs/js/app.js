// js/app.js

// Ожидается, что перед этим подключён js/config.js,
// который определяет GLOBAL_INDEX_URL, USE_DRIVE, UI_VERSION и REFRESH_INTERVAL_MS.

// ========== DOM ==========
const dom = {
    arenaName: document.getElementById("arenaName"),
    gameDate: document.getElementById("gameDate"),
    gameId: document.getElementById("gameId"),
    gameStatus: document.getElementById("gameStatus"),
    teamRedName: document.getElementById("teamRedName"),
    teamWhiteName: document.getElementById("teamWhiteName"),
    teamRedScore: document.getElementById("teamRedScore"),
    teamWhiteScore: document.getElementById("teamWhiteScore"),
    rosterRedTitle: document.getElementById("rosterRedTitle"),
    rosterWhiteTitle: document.getElementById("rosterWhiteTitle"),
    rosterRed: document.getElementById("rosterRed"),
    rosterWhite: document.getElementById("rosterWhite"),
    eventsList: document.getElementById("eventsList"),
    eventsTitle: document.getElementById("eventsTitle"),
    stateMessage: document.getElementById("stateMessage"),
    uiVersion: document.getElementById("uiVersion"),
    fsToggle: document.getElementById("fsToggle"),

    // нижнее меню
    menuFinished: document.getElementById("menuFinished"),
    menuBombardiers: document.getElementById("menuBombardiers"),
    menuSnipers: document.getElementById("menuSnipers"),
    menuWins: document.getElementById("menuWins"),

    // модалка
    modalBackdrop: document.getElementById("modalBackdrop"),
    modalTitle: document.getElementById("modalTitle"),
    modalContent: document.getElementById("modalContent"),
    modalOkButton: document.getElementById("modalOkButton")
};

if (dom.uiVersion) {
    dom.uiVersion.textContent =
        " | Интерфейс " + UI_VERSION +
        " | Источник: " + (USE_DRIVE ? "Raspberry Pi (index.json)" : "локальный index.json");
}

// ========== БАЗОВЫЙ URL ДЛЯ ДАННЫХ ==========

function computeDataBaseUrl(indexUrl) {
    if (!indexUrl) return "";
    try {
        const u = new URL(indexUrl, window.location.href);
        const path = u.pathname.replace(/\/[^\/]*$/, "/"); // до последнего /
        return u.origin + path;
    } catch (_) {
        const idx = indexUrl.lastIndexOf("/");
        if (idx === -1) return "";
        return indexUrl.slice(0, idx + 1);
    }
}

const DATA_BASE_URL = computeDataBaseUrl(GLOBAL_INDEX_URL);

// Нормализуем относительный путь/URL в абсолютный и добавляем ?t=... для обхода кеша
function buildUrl(pathOrUrl) {
    let url = pathOrUrl;

    if (!/^https?:\/\//i.test(pathOrUrl)) {
        const base = DATA_BASE_URL || "";
        const sep = base.endsWith("/") ? "" : "/";
        url = base + sep + pathOrUrl.replace(/^\/+/, "");
    }

    const separator = url.includes("?") ? "&" : "?";
    return url + separator + "t=" + Date.now();
}

async function fetchJson(pathOrUrl) {
    const url = buildUrl(pathOrUrl);
    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
        throw new Error("HTTP " + response.status + " при загрузке " + url);
    }

    return await response.json();
}

// ========== ГЛОБАЛЬНЫЙ ИНДЕКС ==========

let lastGlobalIndex = null; // index.json

async function ensureGlobalIndex() {
    if (lastGlobalIndex) return lastGlobalIndex;
    if (!GLOBAL_INDEX_URL) {
        throw new Error("Не настроен GLOBAL_INDEX_URL до index.json.");
    }
    lastGlobalIndex = await fetchJson(GLOBAL_INDEX_URL);
    return lastGlobalIndex;
}

function getCurrentSeasonEntry(indexData) {
    const seasons = Array.isArray(indexData.seasons) ? indexData.seasons : [];
    if (seasons.length === 0) return null;

    const currentId = indexData.currentSeason;
    let season = seasons.find(s => s.id === currentId);
    if (!season) {
        season = seasons[0]; // запасной вариант
    }
    return season;
}

// ========== ФОРМАТЫ ДАТ ==========

// Только дата: "29 ноября 2025 года"
const MONTHS_RU = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

function formatDateOnly(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const day = d.getDate();
    const month = MONTHS_RU[d.getMonth()] || "";
    const year = d.getFullYear();
    return day + " " + month + " " + year + " года";
}

// Дата+время (для списков и lastGameDate)
function formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function setStatus(finished, hasStarted) {
    if (!dom.gameStatus) return;
    dom.gameStatus.classList.remove("status-finished", "status-live", "status-scheduled");
    if (finished) {
        dom.gameStatus.classList.add("status-finished");
        dom.gameStatus.textContent = "Матч завершён";
    } else if (hasStarted) {
        dom.gameStatus.classList.add("status-live");
        dom.gameStatus.textContent = "Идёт матч";
    } else {
        dom.gameStatus.classList.add("status-scheduled");
        dom.gameStatus.textContent = "Матч запланирован";
    }
}

function computeScore(data) {
    if (data.finalScore &&
        typeof data.finalScore.RED === "number" &&
        typeof data.finalScore.WHITE === "number") {
        return {
            red: data.finalScore.RED,
            white: data.finalScore.WHITE
        };
    }
    if (Array.isArray(data.goals) && data.goals.length > 0) {
        const last = data.goals[data.goals.length - 1];
        if (last.scoreAfter && typeof last.scoreAfter === "string") {
            const parts = last.scoreAfter.split(":");
            const red = parseInt(parts[0], 10);
            const white = parseInt(parts[1], 10);
            if (!isNaN(red) && !isNaN(white)) {
                return { red, white };
            }
        }
    }
    return { red: 0, white: 0 };
}

function setEventsTitle(title) {
    if (dom.eventsTitle) {
        dom.eventsTitle.textContent = title;
    }
}

function resetEventsListClasses() {
    if (!dom.eventsList) return;
    dom.eventsList.classList.remove("leaders-table", "finished-list");
}

// ========== РЕНДЕР ТАБЛО ==========

function renderScoreboardBase(data) {
    if (dom.arenaName) {
        dom.arenaName.textContent = data.arena || "Хоккейное табло";
    }
    if (dom.gameDate) {
        dom.gameDate.textContent = formatDateOnly(data.date);
    }
    if (dom.gameId) {
        dom.gameId.textContent = ""; // пока не показываем id
    }

    const finished = !!data.finished;
    const hasStarted = Array.isArray(data.goals) && data.goals.length > 0;
    setStatus(finished, hasStarted);

    const teams = data.teams || {};
    const red = teams.RED || {};
    const white = teams.WHITE || {};

    const redName = red.name || "Красные";
    const whiteName = white.name || "Белые";

    if (dom.teamRedName) dom.teamRedName.textContent = redName;
    if (dom.teamWhiteName) dom.teamWhiteName.textContent = whiteName;
    if (dom.rosterRedTitle) dom.rosterRedTitle.textContent = redName;
    if (dom.rosterWhiteTitle) dom.rosterWhiteTitle.textContent = whiteName;

    const score = computeScore(data);
    if (dom.teamRedScore) dom.teamRedScore.textContent = score.red;
    if (dom.teamWhiteScore) dom.teamWhiteScore.textContent = score.white;

    if (dom.rosterRed) {
        dom.rosterRed.innerHTML = "";
        (red.players || []).forEach(p => {
            const li = document.createElement("li");
            li.textContent = p;
            dom.rosterRed.appendChild(li);
        });
    }

    if (dom.rosterWhite) {
        dom.rosterWhite.innerHTML = "";
        (white.players || []).forEach(p => {
            const li = document.createElement("li");
            li.textContent = p;
            dom.rosterWhite.appendChild(li);
        });
    }

    return { redName, whiteName };
}

// ========== ПРОТОКОЛ (общий билдер) ==========

function buildProtocolEvents(data, redName, whiteName, target) {
    if (!target) return;

    const events = [];

    if (Array.isArray(data.rosterChanges)) {
        data.rosterChanges.forEach(rc => {
            events.push({
                type: "roster",
                order: typeof rc.order === "number" ? rc.order : 0,
                raw: rc
            });
        });
    }

    if (Array.isArray(data.goals)) {
        data.goals.forEach(g => {
            events.push({
                type: "goal",
                order: typeof g.order === "number" ? g.order : 0,
                raw: g
            });
        });
    }

    events.sort((a, b) => a.order - b.order);

    target.innerHTML = "";
    if (events.length === 0) {
        target.textContent = "Событий пока нет.";
        return;
    }

    events.forEach((ev, index) => {
        const row = document.createElement("div");
        row.className = "event-row";

        const orderCell = document.createElement("div");
        orderCell.className = "event-order";
        orderCell.textContent = (index + 1) + ".";

        const scoreCell = document.createElement("div");
        const descCell = document.createElement("div");
        descCell.className = "event-desc";

        if (ev.type === "goal") {
            const g = ev.raw;
            const teamName = g.team === "RED" ? redName :
                g.team === "WHITE" ? whiteName : (g.team || "Команда");

            const tag = document.createElement("span");
            tag.className = "event-tag " +
                (g.team === "RED" ? "goal-red" : "goal-white");
            tag.textContent = "Гол";

            const line = document.createElement("span");
            line.innerHTML =
                "<strong>" + teamName + "</strong>: " + (g.scorer || "Неизвестный игрок") +
                (g.assist1
                    ? " (передачи: " + g.assist1 + (g.assist2 ? ", " + g.assist2 : "") + ")"
                    : "");

            descCell.appendChild(tag);
            descCell.appendChild(document.createTextNode(" "));
            descCell.appendChild(line);

            scoreCell.className = "event-score " + (g.team === "RED" ? "red" : "white");
            scoreCell.textContent = g.scoreAfter || "";
        } else if (ev.type === "roster") {
            const rc = ev.raw;
            const tag = document.createElement("span");
            tag.className = "event-tag roster";
            tag.textContent = "Состав";

            const toTeamName = rc.toTeam === "RED" ? redName :
                rc.toTeam === "WHITE" ? whiteName : (rc.toTeam || "команда");

            const line = document.createElement("span");
            line.innerHTML =
                (rc.player || "Игрок") + " перешёл в <strong>" + toTeamName + "</strong>";

            descCell.appendChild(tag);
            descCell.appendChild(document.createTextNode(" "));
            descCell.appendChild(line);

            scoreCell.className = "event-score";
            scoreCell.textContent = "";
        }

        row.appendChild(orderCell);
        row.appendChild(scoreCell);
        row.appendChild(descCell);
        target.appendChild(row);
    });
}

// Протокол текущего матча в правой карточке
function renderProtocol(data, redName, whiteName) {
    resetEventsListClasses();
    setEventsTitle("Протокол матча");
    buildProtocolEvents(data, redName, whiteName, dom.eventsList);
}

// ========== МОДАЛЬНЫЕ ОКНА ==========

function openModal(title) {
    if (!dom.modalBackdrop) return;
    if (dom.modalTitle) {
        dom.modalTitle.textContent = title || "";
    }
    dom.modalBackdrop.classList.add("visible");
}

function closeModal() {
    if (!dom.modalBackdrop) return;
    dom.modalBackdrop.classList.remove("visible");
    if (dom.modalContent) {
        dom.modalContent.innerHTML = "";
    }
}

if (dom.modalOkButton) {
    dom.modalOkButton.addEventListener("click", closeModal);
}

if (dom.modalBackdrop) {
    dom.modalBackdrop.addEventListener("click", (e) => {
        if (e.target === dom.modalBackdrop) {
            closeModal();
        }
    });
}

// ========== ЗАВЕРШЁННЫЕ ИГРЫ ==========

let lastFinishedIndex = null;

function renderFinishedList(indexData, container, onGameClick) {
    const target = container || dom.modalContent;
    if (!target) return;

    target.innerHTML = "";
    target.classList.add("finished-list");

    const games = Array.isArray(indexData.games) ? indexData.games.slice() : [];

    games.sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return db - da;
    });

    if (games.length === 0) {
        target.textContent = "Завершённых игр пока нет.";
        return;
    }

    games.forEach((g, index) => {
        const row = document.createElement("div");
        row.className = "event-row clickable";

        if (typeof onGameClick === "function" && g.file) {
            row.addEventListener("click", () => onGameClick(g));
        }

        const orderCell = document.createElement("div");
        orderCell.className = "event-col num-col";
        orderCell.textContent = (index + 1) + ".";

        const descCell = document.createElement("div");
        descCell.className = "event-col main-col";

        const scoreCell = document.createElement("div");
        scoreCell.className = "event-col score-col";

        const dateStr = formatDateTime(g.date);
        const arena = g.arena || "";
        const teamRed = g.teamRed || "Красные";
        const teamWhite = g.teamWhite || "Белые";

        const scoreRed = typeof g.scoreRed === "number" ? g.scoreRed : "?";
        const scoreWhite = typeof g.scoreWhite === "number" ? g.scoreWhite : "?";

        scoreCell.textContent = scoreRed + ":" + scoreWhite;

        const line = document.createElement("span");
        line.innerHTML =
            (dateStr ? dateStr + " — " : "") +
            (arena ? arena + " — " : "") +
            "<strong>" + teamRed + "</strong> vs <strong>" + teamWhite + "</strong>";

        descCell.appendChild(line);

        row.appendChild(orderCell);
        row.appendChild(descCell);
        row.appendChild(scoreCell);
        target.appendChild(row);
    });
}

async function showFinishedGameProtocol(gameEntry) {
    if (!gameEntry || !gameEntry.file) return;

    try {
        dom.stateMessage.classList.remove("error");
        dom.stateMessage.classList.add("loading");
        dom.stateMessage.textContent = "Загрузка протокола игры...";

        const gameData = await fetchJson(gameEntry.file);

        const teams = gameData.teams || {};
        const redName =
            (teams.RED && teams.RED.name) || gameEntry.teamRed || "Красные";
        const whiteName =
            (teams.WHITE && teams.WHITE.name) || gameEntry.teamWhite || "Белые";

        const container = dom.modalContent;
        if (!container) return;

        container.innerHTML = "";

        const meta = document.createElement("div");
        meta.className = "modal-game-meta";
        const dateStr = formatDateTime(gameData.date || gameEntry.date || "");
        const arena = gameData.arena || gameEntry.arena || "";
        meta.textContent = (dateStr ? dateStr + " — " : "") + arena;
        container.appendChild(meta);

        const list = document.createElement("div");
        list.className = "events-list protocol-list";

        buildProtocolEvents(gameData, redName, whiteName, list);
        container.appendChild(list);

        openModal("Протокол игры");

        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent =
            "Ошибка загрузки протокола завершённой игры: " + e.message;
    }
}

async function showFinishedGames() {
    try {
        dom.stateMessage.classList.remove("error");
        dom.stateMessage.classList.add("loading");
        dom.stateMessage.textContent = "Загрузка завершённых игр...";

        const indexData = await ensureGlobalIndex();
        const season = getCurrentSeasonEntry(indexData);
        if (!season || !season.finishedIndex) {
            throw new Error("Для текущего сезона не указан finishedIndex.");
        }

        const finishedData = await fetchJson(season.finishedIndex);
        lastFinishedIndex = finishedData;

        if (dom.modalContent) {
            dom.modalContent.innerHTML = "";
            renderFinishedList(finishedData, dom.modalContent, (game) => {
                showFinishedGameProtocol(game);
            });
        }

        openModal("Завершённые игры");

        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent =
            "Ошибка загрузки завершённых игр: " + e.message;
    }
}

// ========== ЛИДЕРЫ (таблицы в модалке) ==========

const PANEL_MODE = {
    LEADERS_POINTS: "leaders_points",
    LEADERS_GOALS: "leaders_goals",
    LEADERS_WINS: "leaders_wins"
};

let lastPlayersStats = null;

function renderLeaders(statsData, mode, container) {
    const target = container || dom.modalContent || dom.eventsList;
    if (!target) return;

    const players = Array.isArray(statsData.players) ? statsData.players.slice() : [];

    players.forEach(p => {
        p.games = Number(p.games || 0);
        p.goals = Number(p.goals || 0);
        p.assists = Number(p.assists || 0);
        p.points = Number(p.points || (p.goals + p.assists));
        p.wins = Number(p.wins || 0);
        p.losses = Math.max(0, p.games - p.wins);
    });

    if (mode === PANEL_MODE.LEADERS_POINTS) {
        players.sort((a, b) =>
            b.points - a.points ||
            b.goals - a.goals ||
            a.name.localeCompare(b.name, "ru")
        );
    } else if (mode === PANEL_MODE.LEADERS_GOALS) {
        players.sort((a, b) =>
            b.goals - a.goals ||
            b.points - a.points ||
            a.name.localeCompare(b.name, "ru")
        );
    } else {
        players.sort((a, b) =>
            b.wins - a.wins ||
            b.games - a.games ||
            a.name.localeCompare(b.name, "ru")
        );
    }

    target.innerHTML = "";

    if (players.length === 0) {
        target.textContent = "Статистика игроков пока недоступна.";
        return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "leaders-table-wrapper";

    const table = document.createElement("table");
    table.className = "leaders-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");

    function addTh(text) {
        const th = document.createElement("th");
        th.textContent = text;
        headRow.appendChild(th);
    }

    if (mode === PANEL_MODE.LEADERS_POINTS) {
        addTh("№");
        addTh("Игрок");
        addTh("Очки");
        addTh("Голы");
        addTh("Передачи");
        addTh("Матчи");
    } else if (mode === PANEL_MODE.LEADERS_GOALS) {
        addTh("№");
        addTh("Игрок");
        addTh("Голы");
        addTh("Матчи");
    } else { // LEADERS_WINS
        addTh("№");
        addTh("Игрок");
        addTh("Матчи");
        addTh("Победы");
        addTh("Поражения");
    }

    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    players.forEach((p, index) => {
        const tr = document.createElement("tr");

        function addTd(text) {
            const td = document.createElement("td");
            td.textContent = text;
            tr.appendChild(td);
        }

        if (mode === PANEL_MODE.LEADERS_POINTS) {
            addTd(index + 1);
            addTd(p.name || "Без имени");
            addTd(p.points);
            addTd(p.goals);
            addTd(p.assists);
            addTd(p.games);
        } else if (mode === PANEL_MODE.LEADERS_GOALS) {
            addTd(index + 1);
            addTd(p.name || "Без имени");
            addTd(p.goals);
            addTd(p.games);
        } else {
            addTd(index + 1);
            addTd(p.name || "Без имени");
            addTd(p.games);
            addTd(p.wins);
            addTd(p.losses);
        }

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    target.appendChild(wrapper);
}

async function showLeaders(mode) {
    const label =
        mode === PANEL_MODE.LEADERS_POINTS ? "Загрузка лучших бомбардиров..." :
        mode === PANEL_MODE.LEADERS_GOALS ? "Загрузка лучших снайперов..." :
        "Загрузка лидеров по победам...";

    try {
        dom.stateMessage.classList.remove("error");
        dom.stateMessage.classList.add("loading");
        dom.stateMessage.textContent = label;

        const indexData = await ensureGlobalIndex();
        const season = getCurrentSeasonEntry(indexData);
        if (!season || !season.playersStats) {
            throw new Error("Для текущего сезона не указан playersStats.");
        }

        const statsData = await fetchJson(season.playersStats);
        lastPlayersStats = statsData;

        if (dom.modalContent) {
            dom.modalContent.innerHTML = "";
            renderLeaders(statsData, mode, dom.modalContent);
        }

        if (mode === PANEL_MODE.LEADERS_POINTS) {
            openModal("Бомбардиры");
        } else if (mode === PANEL_MODE.LEADERS_GOALS) {
            openModal("Снайперы");
        } else {
            openModal("Победы");
        }

        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent =
            "Ошибка загрузки статистики игроков: " + e.message;
    }
}

// ========== ЗАГРУЗКА АКТИВНОЙ ИГРЫ ==========

async function loadAndRenderActiveGame() {
    try {
        dom.stateMessage.classList.remove("error");
        dom.stateMessage.classList.add("loading");
        dom.stateMessage.textContent = "Загрузка активной игры...";

        const indexData = await ensureGlobalIndex();
        const season = getCurrentSeasonEntry(indexData);
        if (!season || !season.activeGame) {
            throw new Error("В глобальном индексе не найден текущий сезон или activeGame.");
        }

        const gameData = await fetchJson(season.activeGame);

        const names = renderScoreboardBase(gameData);
        renderProtocol(gameData, names.redName, names.whiteName);

        dom.stateMessage.classList.remove("error", "loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent =
            "Ошибка загрузки активной игры: " + e.message;
    }
}

// ========== ОБРАБОТЧИКИ МЕНЮ ==========

if (dom.menuFinished) {
    dom.menuFinished.addEventListener("click", () => {
        showFinishedGames();
    });
}

if (dom.menuBombardiers) {
    dom.menuBombardiers.addEventListener("click", () => {
        showLeaders(PANEL_MODE.LEADERS_POINTS);
    });
}

if (dom.menuSnipers) {
    dom.menuSnipers.addEventListener("click", () => {
        showLeaders(PANEL_MODE.LEADERS_GOALS);
    });
}

if (dom.menuWins) {
    dom.menuWins.addEventListener("click", () => {
        showLeaders(PANEL_MODE.LEADERS_WINS);
    });
}

// ========== СТАРТ АВТООБНОВЛЕНИЯ ПРОТОКОЛА ==========

// При старте — сразу подтягиваем активную игру
loadAndRenderActiveGame();

// Автообновление табло, независимо от модалок
setInterval(() => {
    loadAndRenderActiveGame();
}, REFRESH_INTERVAL_MS);

// ========== ПОЛНОЭКРАННЫЙ РЕЖИМ ==========

function isFullscreen() {
    return !!document.fullscreenElement;
}

async function enterFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
        try { await el.requestFullscreen(); } catch (_) {}
    }
}

async function exitFullscreen() {
    if (document.exitFullscreen && isFullscreen()) {
        try { await document.exitFullscreen(); } catch (_) {}
    }
}

async function toggleFullscreen() {
    if (isFullscreen()) {
        await exitFullscreen();
    } else {
        await enterFullscreen();
    }
}

if (dom.fsToggle) {
    dom.fsToggle.addEventListener("click", toggleFullscreen);
}

// Авто-fullscreen отключён осознанно
