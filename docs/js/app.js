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
