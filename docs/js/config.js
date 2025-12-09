// js/config.js
// Глобальные настройки источников данных и версии интерфейса

// Локальный глобальный индекс (если табло крутится рядом с JSON-ами)
const LOCAL_INDEX_URL = "./index.json";

// Глобальный индекс на Raspberry Pi (корень /var/www/hockey-json/)
const DRIVE_INDEX_URL =
    "https://hockey.ch73210.keenetic.pro:8443/index.json";
    //"https://test.pestovo328.ru/index.json";


// Используем ли Raspberry Pi как источник
const USE_DRIVE = true;

// Итоговый URL глобального индекса
const GLOBAL_INDEX_URL = USE_DRIVE ? DRIVE_INDEX_URL : LOCAL_INDEX_URL;

// Версия интерфейса
const UI_VERSION = "UI v0.20 (seasons & stats)";

// Интервал автообновления активной игры (только для протокола текущего матча)
const REFRESH_INTERVAL_MS = 5000;
