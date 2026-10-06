let session = null;
let profile = null;
let activeStream = null;

document.addEventListener("DOMContentLoaded", init);

async function init() {
    bindEvents();

    try {
        const { data, error } = await window.supabaseClient.auth.getSession();
        if (error) throw error;

        session = data.session;

        if (!session) {
            window.location.href = "./login.html";
            return;
        }

        const { data: profileData, error: profileError } =
            await window.supabaseClient
                .from("profiles")
                .select("id, username, display_name, role, creator_approved, avatar_url")
                .eq("id", session.user.id)
                .single();

        if (profileError) throw profileError;

        profile = profileData;

        if (
            profile.role !== "creator" &&
            profile.role !== "admin"
        ) {
            showAccessError("هذا الحساب ليس Creator معتمداً.");
            return;
        }

        document.getElementById("creatorName").textContent =
            profile.display_name || profile.username || "Creator";

        document.getElementById("accessState").classList.add("hidden");
        document.getElementById("dashboard").classList.remove("hidden");

        await loadDashboard();
    } catch (error) {
        console.error(error);
        showAccessError("حدث خطأ أثناء تحميل لوحة Creator: " + error.message);
    }
}

function bindEvents() {
    document.getElementById("streamForm")?.addEventListener("submit", startStream);
    document.getElementById("endButton")?.addEventListener("click", endStream);
    document.getElementById("refreshButton")?.addEventListener("click", loadDashboard);
    document.getElementById("logoutButton")?.addEventListener("click", logout);
}

async function loadDashboard() {
    await loadStreams();
}

async function loadStreams() {
    const { data, error } = await window.supabaseClient
        .from("streams")
        .select("id, title, description, category, thumbnail_url, is_live, viewer_count, started_at, ended_at, created_at")
        .eq("creator_id", session.user.id)
        .order("created_at", { ascending: false });

    if (error) throw error;

    const streams = data || [];
    activeStream = streams.find(stream => stream.is_live === true) || null;

    document.getElementById("totalStreams").textContent = streams.length;
    document.getElementById("currentViewers").textContent =
        activeStream?.viewer_count ?? 0;

    document.getElementById("lastStream").textContent =
        streams[0]
            ? formatDate(streams[0].created_at)
            : "—";

    updateLiveUI();
    renderHistory(streams);
}

function updateLiveUI() {
    const badge = document.getElementById("liveBadge");
    const current = document.getElementById("currentStream");
    const startButton = document.getElementById("startButton");
    const endButton = document.getElementById("endButton");
    const liveStatus = document.getElementById("liveStatus");

    if (activeStream) {
        badge.textContent = "LIVE";
        badge.className = "badge live";
        liveStatus.textContent = "مباشر";
        startButton.disabled = true;
        endButton.disabled = false;

        current.className = "current-stream";
        current.innerHTML = `
            <div class="stream-active">
                <div>
                    <div class="stream-title">${escapeHTML(activeStream.title)}</div>
                    <div class="stream-meta">
                        ${getCategory(activeStream.category)}
                        · بدأ ${formatDate(activeStream.started_at)}
                        · 👁 ${Number(activeStream.viewer_count || 0)}
                    </div>
                </div>
                <strong class="success">● LIVE</strong>
            </div>
        `;

        document.getElementById("title").value = activeStream.title || "";
        document.getElementById("description").value = activeStream.description || "";
        document.getElementById("category").value = activeStream.category || "gaming";
        document.getElementById("thumbnailUrl").value = activeStream.thumbnail_url || "";
    } else {
        badge.textContent = "OFFLINE";
        badge.className = "badge offline";
        liveStatus.textContent = "غير مباشر";
        startButton.disabled = false;
        endButton.disabled = true;

        current.className = "current-stream empty";
        current.textContent = "لا يوجد بث مباشر حالياً.";
    }
}

async function startStream(event) {
    event.preventDefault();

    if (activeStream) {
        showMessage("يوجد بث مباشر بالفعل.", true);
        return;
    }

    const title = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const category = document.getElementById("category").value;
    const thumbnail_url = document.getElementById("thumbnailUrl").value.trim() || null;

    if (!title) {
        showMessage("اكتب عنوان البث أولاً.", true);
        return;
    }

    setButtons(true);
    showMessage("جاري بدء البث...");

    try {
        const { data, error } = await window.supabaseClient
            .from("streams")
            .insert({
                creator_id: session.user.id,
                title,
                description: description || null,
                category,
                thumbnail_url,
                is_live: true,
                viewer_count: 0,
                started_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        activeStream = data;
        showMessage("تم إنشاء البث وبدؤه بنجاح ✅", false);
        await loadStreams();
    } catch (error) {
        console.error(error);
        showMessage("تعذر بدء البث: " + error.message, true);
    } finally {
        setButtons(false);
    }
}

async function endStream() {
    if (!activeStream) return;

    if (!confirm("هل تريد إنهاء البث الحالي؟")) return;

    setButtons(true);
    showMessage("جاري إنهاء البث...");

    try {
        const { error } = await window.supabaseClient
            .from("streams")
            .update({
                is_live: false,
                ended_at: new Date().toISOString()
            })
            .eq("id", activeStream.id)
            .eq("creator_id", session.user.id);

        if (error) throw error;

        activeStream = null;
        document.getElementById("streamForm").reset();
        showMessage("تم إنهاء البث بنجاح ✅", false);
        await loadStreams();
    } catch (error) {
        console.error(error);
        showMessage("تعذر إنهاء البث: " + error.message, true);
    } finally {
        setButtons(false);
    }
}

function renderHistory(streams) {
    const history = document.getElementById("history");
    const past = streams.filter(stream => !stream.is_live);

    if (!past.length) {
        history.innerHTML = `<div class="current-stream empty">لا توجد بثوث سابقة.</div>`;
        return;
    }

    history.innerHTML = past.slice(0, 20).map(stream => `
        <div class="history-item">
            <div>
                <h3>${escapeHTML(stream.title)}</h3>
                <p>
                    ${getCategory(stream.category)}
                    · ${formatDate(stream.created_at)}
                </p>
            </div>
            <div>
                <strong>${Number(stream.viewer_count || 0)} 👁</strong>
                <p>${stream.ended_at ? "انتهى " + formatDate(stream.ended_at) : ""}</p>
            </div>
        </div>
    `).join("");
}

function setButtons(loading) {
    const start = document.getElementById("startButton");
    const end = document.getElementById("endButton");

    if (loading) {
        start.disabled = true;
        end.disabled = true;
    } else {
        start.disabled = !!activeStream;
        end.disabled = !activeStream;
    }
}

function showMessage(text, isError = false) {
    const el = document.getElementById("message");
    el.textContent = text;
    el.className = "message " + (isError ? "error" : "success");
}

function showAccessError(text) {
    const state = document.getElementById("accessState");
    state.className = "panel error";
    state.textContent = text;
}

async function logout() {
    await window.supabaseClient.auth.signOut();
    window.location.href = "./index.html";
}

function getCategory(category) {
    return {
        gaming: "🎮 Gaming",
        just_chatting: "💬 Just Chatting",
        education: "📚 Education",
        other: "⭐ Other"
    }[category] || category;
}

function formatDate(value) {
    if (!value) return "—";
    return new Date(value).toLocaleString("ar-EG", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function escapeHTML(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
