(() => {
    const splash = document.getElementById("seasonSplash");
    if (!splash || splash.hidden) return;

    const target = new Date("2026-11-20T20:15:00+03:00").getTime();
    const units = [
        { value: "countdownDays", label: "countdownDaysLabel", forms: ["день", "дня", "дней"] },
        { value: "countdownHours", label: "countdownHoursLabel", forms: ["час", "часа", "часов"] },
        { value: "countdownMinutes", label: "countdownMinutesLabel", forms: ["минута", "минуты", "минут"] },
        { value: "countdownSeconds", label: "countdownSecondsLabel", forms: ["секунда", "секунды", "секунд"] }
    ];
    const grid = document.getElementById("seasonCountdownGrid");
    const finished = document.getElementById("seasonCountdownFinished");
    if (!grid || !finished || units.some(unit => !document.getElementById(unit.value) || !document.getElementById(unit.label))) return;

    function wordForm(number, forms) {
        const lastTwo = number % 100;
        if (lastTwo >= 11 && lastTwo <= 14) return forms[2];
        const last = number % 10;
        if (last === 1) return forms[0];
        if (last >= 2 && last <= 4) return forms[1];
        return forms[2];
    }

    function updateCountdown() {
        const remaining = target - Date.now();
        if (remaining <= 0) {
            grid.hidden = true;
            finished.hidden = false;
            const intro = document.getElementById("splashSeasonIntro");
            const status = document.getElementById("splashStatusText");
            const caption = document.getElementById("seasonCountdownCaption");
            if (intro) intro.textContent = "Сезон";
            if (status) status.textContent = "Лёд открыт";
            if (caption) caption.textContent = "Время пришло";
            clearInterval(timer);
            return;
        }

        const seconds = Math.ceil(remaining / 1000);
        const values = [
            Math.floor(seconds / 86400),
            Math.floor(seconds % 86400 / 3600),
            Math.floor(seconds % 3600 / 60),
            seconds % 60
        ];
        units.forEach((unit, index) => {
            const value = values[index];
            document.getElementById(unit.value).textContent = index === 0 ? String(value) : String(value).padStart(2, "0");
            document.getElementById(unit.label).textContent = wordForm(value, unit.forms);
        });
    }

    const timer = setInterval(updateCountdown, 1000);
    updateCountdown();
})();
