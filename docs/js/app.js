// js/app.js

// Ожидается, что перед этим подключён js/config.js,
// который определяет GLOBAL_INDEX_URL, UI_VERSION и REFRESH_INTERVAL_MS.

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
    stateMessage: document.getElementById("stateMessage"),
    uiVersion: document.getElementById("uiVersion"),
    fsToggle: document.getElementById("fsToggle"),

    eventsTitle: document.getElementById("eventsTitle"),

    // нижнее меню
    menuFinished: document.getElementById("menuFinished"),
    menuBombardiers: document.getElementById("menuBombardiers"),
    menuSnipers: document.getElementById("menuSnipers"),
    menuWins: document.getElementById("menuWins")
};

dom.uiVersion.textContent =
    " | Интерфейс " + UI_VERSION +
    " | Источник: " + (USE_DRIVE ? "Raspberry Pi (index.json)" : "локальный index.json");

// ========== БАЗОВЫЙ URL ДЛЯ ДАННЫХ ==========

function computeDataBaseUrl(indexUrl) {
    if (!indexUrl) return "";
    try {
        const u = new URL(indexUrl, window.location.href);
        const path = u.pathname.replace(/\/[^\/]*$/, "/"); // обрезаем до последнего /
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

// ========== РЕЖИМЫ НИЖНЕЙ ПАНЕЛИ ==========

const PANEL_MODE = {
    PROTOCOL: "protocol",           // протокол текущего матча
    FINISHED: "finished",           // завершённые игры
    LEADERS_POINTS: "leaders_points", // лучшие бомбардиры (очки)
    LEADERS_GOALS: "leaders_goals",  // лучшие снайперы (голы)
    LEADERS_WINS: "leaders_wins"     // лидеры по победам
};

let currentPanelMode = PANEL_MODE.PROTOCOL;

// Кэши данных
let lastGlobalIndex = null;     // index.json
let lastActiveGameData = null;  // active_game.json текущего сезона
let lastFinishedIndex = null;   // finished/XX-YY/index.json
let lastPlayersStats = null;    // stats/XX-YY/players.json

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========

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

// Дата+время, как раньше (для списков и lastGameDate)
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

function setStatus(finished, hasStarted) {
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

// Заголовок "окна"
function setEventsTitle(title) {
    if (dom.eventsTitle) {
        dom.eventsTitle.textContent = title;
    }
}

// Управление классами списка событий (для разных макетов)
function resetEventsListClasses() {
    dom.eventsList.classList.remove("leaders-table", "finished-list");
}

// Получить или подхватить из кеша глобальный индекс
async function ensureGlobalIndex() {
    if (lastGlobalIndex) return lastGlobalIndex;
    if (!GLOBAL_INDEX_URL) {
        throw new Error("Не настроен GLOBAL_INDEX_URL до index.json.");
    }
    lastGlobalIndex = await fetchJson(GLOBAL_INDEX_URL);
    return lastGlobalIndex;
}

// Текущий сезон из глобального индекса
function getCurrentSeasonEntry(indexData) {
    const seasons = Array.isArray(indexData.seasons) ? indexData.seasons : [];
    if (seasons.length === 0) return null;

    const currentId = indexData.currentSeason;
    let season = seasons.find(s => s.id === currentId);
    if (!season) {
        season = seasons[0]; // fallback: первый сезон
    }
    return season;
}

// ========== РЕНДЕР: ОСНОВНОЕ ТАБЛО ==========

function renderScoreboardBase(data) {
    dom.arenaName.textContent = data.arena || "Хоккейное табло";
    dom.gameDate.textContent = formatDateOnly(data.date);

    dom.gameId.textContent = "";

    const finished = !!data.finished;
    const hasStarted = Array.isArray(data.goals) && data.goals.length > 0;
    setStatus(finished, hasStarted);

    const teams = data.teams || {};
    const red = teams.RED || {};
    const white = teams.WHITE || {};

    const redName = red.name || "Красные";
    const whiteName = white.name || "Белые";

    dom.teamRedName.textContent = redName;
    dom.teamWhiteName.textContent = whiteName;
    dom.rosterRedTitle.textContent = redName;
    dom.rosterWhiteTitle.textContent = whiteName;

    const score = computeScore(data);
    dom.teamRedScore.textContent = score.red;
    dom.teamWhiteScore.textContent = score.white;

    dom.rosterRed.innerHTML = "";
    dom.rosterWhite.innerHTML = "";
    (red.players || []).forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        dom.rosterRed.appendChild(li);
    });
    (white.players || []).forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        dom.rosterWhite.appendChild(li);
    });

    return { redName, whiteName };
}

// Протокол матча (режим PANEL_MODE.PROTOCOL)
function renderProtocol(data, redName, whiteName) {
    resetEventsListClasses();
    setEventsTitle("Протокол матча");

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

    dom.eventsList.innerHTML = "";
    if (events.length === 0) {
        dom.eventsList.textContent = "Событий пока нет.";
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
        dom.eventsList.appendChild(row);
    });
}

// Список завершённых игр
function renderFinishedList(indexData) {
    resetEventsListClasses();
    setEventsTitle("Завершённые игры");
    dom.eventsList.classList.add("finished-list");

    const games = Array.isArray(indexData.games) ? indexData.games.slice() : [];

    games.sort((a, b) => {
        const da = new Date(a.date || 0).getTime();
        const db = new Date(b.date || 0).getTime();
        return db - da;
    });

    dom.eventsList.innerHTML = "";

    if (games.length === 0) {
        dom.eventsList.textContent = "Завершённых игр пока нет.";
        return;
    }

    games.forEach((g, index) => {
        const row = document.createElement("div");
        row.className = "event-row";

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
        dom.eventsList.appendChild(row);
    });
}

// Таблица лидеров (mode: POINTS / GOALS / WINS)
function renderLeaders(statsData, mode) {
    resetEventsListClasses();
    dom.eventsList.classList.add("leaders-table");

    if (mode === PANEL_MODE.LEADERS_POINTS) {
        setEventsTitle("Бомбардиры");
    } else if (mode === PANEL_MODE.LEADERS_GOALS) {
        setEventsTitle("Снайперы");
    } else {
        setEventsTitle("Победы");
    }

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
        // LEADERS_WINS
        players.sort((a, b) =>
            b.wins - a.wins ||
            b.games - a.games ||
            a.name.localeCompare(b.name, "ru")
        );
    }

    dom.eventsList.innerHTML = "";

    if (players.length === 0) {
        dom.eventsList.textContent = "Статистика игроков пока недоступна.";
        return;
    }

    // Заголовок таблицы
    const header = document.createElement("div");
    header.className = "event-row table-header";

    function addHeaderCell(parent, text) {
        const div = document.createElement("div");
        div.className = "table-cell";
        div.textContent = text;
        parent.appendChild(div);
    }

    if (mode === PANEL_MODE.LEADERS_POINTS) {
        addHeaderCell(header, "№");
        addHeaderCell(header, "Игрок");
        addHeaderCell(header, "Очки");
        addHeaderCell(header, "Голы");
        addHeaderCell(header, "Передачи");
        addHeaderCell(header, "Матчи");
    } else if (mode === PANEL_MODE.LEADERS_GOALS) {
        addHeaderCell(header, "№");
        addHeaderCell(header, "Игрок");
        addHeaderCell(header, "Голы");
        addHeaderCell(header, "Матчи");
    } else {
        // LEADERS_WINS
        addHeaderCell(header, "№");
        addHeaderCell(header, "Игрок");
        addHeaderCell(header, "Матчи");
        addHeaderCell(header, "Победы");
        addHeaderCell(header, "Поражения");
    }

    dom.eventsList.appendChild(header);

    // Строки игроков
    players.forEach((p, index) => {
        const row = document.createElement("div");
        row.className = "event-row table-row";

        function addCell(text) {
            const div = document.createElement("div");
            div.className = "table-cell";
            div.textContent = text;
            row.appendChild(div);
        }

        if (mode === PANEL_MODE.LEADERS_POINTS) {
            addCell(index + 1);                        // №
            addCell(p.name || "Без имени");            // Игрок
            addCell(p.points);                         // Очки
            addCell(p.goals);                          // Голы
            addCell(p.assists);                        // Передачи
            addCell(p.games);                          // Матчи
        } else if (mode === PANEL_MODE.LEADERS_GOALS) {
            addCell(index + 1);                        // №
            addCell(p.name || "Без имени");            // Игрок
            addCell(p.goals);                          // Голы
            addCell(p.games);                          // Матчи
        } else {
            addCell(index + 1);                        // №
            addCell(p.name || "Без имени");            // Игрок
            addCell(p.games);                          // Матчи
            addCell(p.wins);                           // Победы
            addCell(p.losses);                         // Поражения
        }

        dom.eventsList.appendChild(row);
    });
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
        lastActiveGameData = gameData;

        const names = renderScoreboardBase(gameData);

        if (currentPanelMode === PANEL_MODE.PROTOCOL) {
            renderProtocol(gameData, names.redName, names.whiteName);
        }

        dom.stateMessage.classList.remove("error", "loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent = "Ошибка загрузки активной игры: " + e.message;
    }
}

// ========== ЗАГРУЗКА ЗАВЕРШЁННЫХ ИГР ==========

async function showFinishedGames() {
    currentPanelMode = PANEL_MODE.FINISHED;

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

        renderFinishedList(finishedData);

        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent = "Ошибка загрузки завершённых игр: " + e.message;
    }
}

// ========== ЗАГРУЗКА СТАТИСТИКИ ИГРОКОВ ==========

async function showLeaders(mode) {
    currentPanelMode = mode;

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

        renderLeaders(statsData, mode);

        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.textContent = "";
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.remove("loading");
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent = "Ошибка загрузки статистики игроков: " + e.message;
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

// При старте показываем текущий матч (табло + протокол)
loadAndRenderActiveGame();

// Автообновление только когда внизу выбран режим протокола
setInterval(() => {
    if (currentPanelMode === PANEL_MODE.PROTOCOL) {
        loadAndRenderActiveGame();
    }
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

// ВАЖНО: авто-fullscreen полностью отключён
