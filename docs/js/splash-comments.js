(() => {
    const splash = document.getElementById("seasonSplash");
    if (!splash || splash.hidden) return;

    const apiUrl = "https://hockey-server.pestovo328.ru/api/splash-comments";
    const feed = document.getElementById("splashCommentFeed");
    const dialog = document.getElementById("splashCommentDialog");
    const form = document.getElementById("splashCommentForm");
    const authorInput = document.getElementById("splashCommentAuthor");
    const textInput = document.getElementById("splashCommentText");
    const status = document.getElementById("splashCommentStatus");
    const openButton = document.getElementById("splashCommentOpen");
    const cancelButton = document.getElementById("splashCommentCancel");
    const submitButton = document.getElementById("splashCommentSubmit");
    if (!feed || !dialog || !form || !authorInput || !textInput || !status ||
        !openButton || !cancelButton || !submitButton) return;

    let loading = false;
    let renderedIds = null;

    function showFeedMessage(message) {
        const empty = document.createElement("div");
        empty.className = "splash-chat-empty";
        empty.textContent = message;
        feed.replaceChildren(empty);
    }

    function formatTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";
        return new Intl.DateTimeFormat("ru-RU", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit"
        }).format(date);
    }

    function renderComments(comments) {
        const ids = comments.map(comment => comment.id).join("|");
        if (ids === renderedIds) return;
        renderedIds = ids;

        if (comments.length === 0) {
            showFeedMessage("Пока тихо. Начни разговор первым.");
            return;
        }

        const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 32;
        const scrollPosition = feed.scrollTop;
        const fragment = document.createDocumentFragment();
        for (const comment of comments) {
            const item = document.createElement("div");
            item.className = "splash-chat-message";

            const author = document.createElement("span");
            author.className = "splash-chat-author";
            author.textContent = comment.author;
            item.appendChild(author);

            const time = document.createElement("time");
            time.className = "splash-chat-time";
            time.dateTime = comment.createdAt;
            time.textContent = formatTime(comment.createdAt);
            item.appendChild(time);

            const text = document.createElement("div");
            text.className = "splash-chat-text";
            text.textContent = comment.text;
            item.appendChild(text);
            fragment.appendChild(item);
        }
        feed.replaceChildren(fragment);
        feed.scrollTop = nearBottom ? feed.scrollHeight : scrollPosition;
    }

    async function refreshComments() {
        if (loading) return;
        loading = true;
        try {
            const response = await fetch(apiUrl, { cache: "no-store" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            const result = await response.json();
            if (!Array.isArray(result.comments)) throw new Error("Invalid response");
            renderComments(result.comments);
        } catch (error) {
            console.error("Could not load splash comments", error);
            if (renderedIds === null) showFeedMessage("Лента временно недоступна.");
        } finally {
            loading = false;
        }
    }

    function closeDialog() {
        dialog.hidden = true;
        status.textContent = "";
        openButton.focus();
    }

    openButton.addEventListener("click", () => {
        dialog.hidden = false;
        status.textContent = "";
        authorInput.focus();
    });
    cancelButton.addEventListener("click", closeDialog);
    dialog.addEventListener("click", event => {
        if (event.target === dialog) closeDialog();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !dialog.hidden) closeDialog();
    });

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const author = authorInput.value.trim();
        const text = textInput.value.trim();
        if (!author || !text) {
            status.textContent = "Заполни подпись и сообщение.";
            return;
        }

        submitButton.disabled = true;
        status.textContent = "";
        try {
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ author, text })
            });
            if (!response.ok) throw new Error("HTTP " + response.status);
            textInput.value = "";
            closeDialog();
            await refreshComments();
        } catch (error) {
            console.error("Could not post splash comment", error);
            status.textContent = "Не отправилось. Попробуй ещё раз.";
        } finally {
            submitButton.disabled = false;
        }
    });

    refreshComments();
    setInterval(refreshComments, 10000);
})();
