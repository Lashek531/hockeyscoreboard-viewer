// js/app.js
// Ожидается, что перед этим подключён js/config.js,
// который определяет ACTIVE_GAME_URL, UI_VERSION и REFRESH_INTERVAL_MS.

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
    fsToggle: document.getElementById("fsToggle")
};

dom.uiVersion.textContent =
    " | Интерфейс " + UI_VERSION +
    " | Источник: " + (USE_DRIVE ? "Raspberry Pi (active_game.json)" : "локальный файл");

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function formatDate(iso) {
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

// ========== РЕНДЕР ==========
function renderData(data) {
    dom.arenaName.textContent = data.arena || "Хоккейное табло";
    dom.gameDate.textContent = formatDate(data.date);

    // gameId не выводим — он скрыт стилями
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
    } else {
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

    // после успешной загрузки стираем статус под ареной
    dom.stateMessage.classList.remove("error", "loading");
    dom.stateMessage.textContent = "";
}

// ========== ЗАГРУЗКА ==========
async function loadData() {
    try {
        if (!ACTIVE_GAME_URL) {
            dom.stateMessage.classList.add("error");
            dom.stateMessage.textContent = "Не настроен URL до ActiveGame.json.";
            return;
        }

        const separator = ACTIVE_GAME_URL.includes("?") ? "&" : "?";
        const url = ACTIVE_GAME_URL + separator + "t=" + Date.now();

        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const data = await response.json();
        renderData(data);
    } catch (e) {
        console.error(e);
        dom.stateMessage.classList.add("error");
        dom.stateMessage.textContent = "Ошибка загрузки данных: " + e.message;
    }
}

loadData();
setInterval(loadData, REFRESH_INTERVAL_MS);

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

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        // браузер и так выйдет из фуллскрина, но на всякий случай
        exitFullscreen();
    }
});

// Попытка войти в полноэкранный режим при первом взаимодействии с документом
document.addEventListener("click", function autoFsOnce() {
    document.removeEventListener("click", autoFsOnce);
    enterFullscreen();
});

