// js/config.js
// Глобальные настройки источников данных и версии интерфейса

// Локальный активный файл для отладки
const LOCAL_ACTIVE_GAME_URL = "./active-game.json";

// Активный файл на Raspberry Pi
const DRIVE_ACTIVE_GAME_URL =
    "https://hockey.ch73210.keenetic.pro:8443/active_game.json";

// Используем ли Raspberry Pi как источник
const USE_DRIVE = true;

// Итоговый URL текущей активной игры
const ACTIVE_GAME_URL = USE_DRIVE ? DRIVE_ACTIVE_GAME_URL : LOCAL_ACTIVE_GAME_URL;

// Версия интерфейса (подняли до v0.11)
const UI_VERSION = "UI v0.11 (raspi-json)";

// Интервал автообновления данных
const REFRESH_INTERVAL_MS = 5000;

