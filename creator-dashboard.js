
const API_BASE = "https://levellive.vercel.app";

let session = null;
let profile = null;
let activeStream = null;
let creatingStream = false;

document.addEventListener("DOMContentLoaded", init);

async function init() {
    bindEvents();

    try {
        const { data, error } =
            await window.supabaseClient.auth.getSession();

        if (error) throw error;

        session = data.session;

        if (!session) {
            window.location.href = "./login.html";
            return;
        }

        const { data: profileData, error: profileError } =
            await window.supabaseClient
                .from("profiles")
                .select(
                    "id, username, display_name, role, creator_approved, avatar_url"
                )
                .eq("id", session.user.id)
                .single();

        if (profileError) throw profileError;

        profile = profileData;

        const approved =
            profile.role === "admin" ||
            (
                profile.role === "creator" &&
                profile.creator_approved === true
            );

        if (!approved) {
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
        showAccessError(
            "حدث خطأ أثناء تحميل لوحة Creator: " + error.message
        );
    }
}

function bindEvents() {
    document.getElementById("streamForm")
        ?.addEventListener("submit", startStream);

    document.getElementById("endButton")
        ?.addEventListener("click", endStream);

    document.getElementById("refreshButton")
        ?.addEventListener("click", refreshDashboard);

    document.getElementById("logoutButton")
        ?.addEventListener("click", logout);

    document.getElementById("copyRtmpUrl")
        ?.addEventListener("click", () => copyField("rtmpUrl"));

    document.getElementById("copyStreamKey")
        ?.addEventListener("click", () => copyField("streamKey"));

    document.getElementById("toggleStreamKey")
        ?.addEventListener("click", toggleStreamKey);
}

async function refreshDashboard() {
    try {
        await loadDashboard();
        showMessage("تم تحديث البيانات.");
    } catch (error) {
        console.error(error);
        showMessage("تعذر تحديث البيانات: " + error.message, true);
    }
}

async function loadDashboard() {
    await loadStreams();
}

async function loadStreams() {
    const { data, error } = await window.supabaseClient
        .from("streams")
        .select(
            "id, title, description, category, thumbnail_url, is_live, viewer_count, started_at, ended_at, created_at, provider, provider_input_id, room_name"
        )
        .eq("creator_id", session.user.id)
        .order("created_at", { ascending: false });

    if (error) throw error;

    const streams = data || [];

    activeStream = streams.find(
        stream =>
            stream.provider === "livekit" &&
            !stream.ended_at
    ) || null;

    document.getElementById("totalStreams").textContent = streams.length;

    document.getElementById("currentViewers").textContent =
        activeStream?.viewer_count ?? 0;

    document.getElementById("lastStream").textContent =
        streams[0] ? formatDate(streams[0].created_at) : "—";

    updateLiveUI();
    renderHistory(streams);
}

function updateLiveUI() {
    const badge = document.getElementById("liveBadge");
    const current = document.getElementById("currentStream");
    const startButton = document.getElementById("startButton");
    const endButton = document.getElementById("endButton");
    const liveStatus = document.getElementById("liveStatus");
    const connection = document.getElementById("streamConnection");

    if (activeStream) {
        badge.textContent = activeStream.is_live ? "LIVE" : "CONNECTING";
        badge.className = activeStream.is_live
            ? "badge live"
            : "badge offline";

        liveStatus.textContent = activeStream.is_live
            ? "مباشر"
            : "تم تجهيز الاتصال";

        startButton.disabled = true;
        endButton.disabled = false;

        current.className = "current-stream";
        current.textContent =
            `${activeStream.title} — ` +
            (activeStream.is_live
                ? "البث مباشر."
                : "الاتصال مجهز، بانتظار بدء إرسال الفيديو من OBS.");

        document.getElementById("title").value =
            activeStream.title || "";

        document.getElementById("description").value =
            activeStream.description || "";

        document.getElementById("category").value =
            activeStream.category || "gaming";

        document.getElementById("thumbnailUrl").value =
            activeStream.thumbnail_url || "";

        connection.classList.remove("hidden");
    } else {
        badge.textContent = "OFFLINE";
        badge.className = "badge offline";
        liveStatus.textContent = "غير مباشر";

        startButton.disabled = false;
        endButton.disabled = true;

        current.className = "current-stream empty";
        current.textContent = "لا يوجد بث مباشر حالياً.";

        connection.classList.add("hidden");
        document.getElementById("rtmpUrl").value = "";
        document.getElementById("streamKey").value = "";
        document.getElementById("streamKey").type = "password";
        document.getElementById("toggleStreamKey").textContent =
            "إظهار مفتاح البث";
    }
}

async function startStream(event) {
    event.preventDefault();

    if (creatingStream) return;

    if (activeStream) {
        showMessage("يوجد اتصال بث قائم بالفعل.", true);
        return;
    }

    const title = document.getElementById("title").value.trim();
    const description =
        document.getElementById("description").value.trim();

    const category = document.getElementById("category").value;
    const thumbnail_url =
        document.getElementById("thumbnailUrl").value.trim() || null;

    if (!title) {
        showMessage("اكتب عنوان البث أولاً.", true);
        return;
    }

    creatingStream = true;
    setButtons(true);
    showMessage("جاري تجهيز اتصال البث...");

    try {
        const { data: authData, error: authError } =
            await window.supabaseClient.auth.getSession();

        if (authError) throw authError;

        const accessToken = authData.session?.access_token;

        if (!accessToken) {
            throw new Error("انتهت جلسة الدخول. سجّل الدخول مجددًا.");
        }

        const response = await fetch(
            `${API_BASE}/api/create-ingress`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                body: JSON.stringify({
                    title,
                    description,
                    category
                })
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || `فشل تجهيز البث (HTTP ${response.status}).`
            );
        }

        // تحديث صورة البث بعد إنشاء السجل.
        // فشل تحديث الصورة لا يلغي اتصال RTMP الذي تم إنشاؤه.
        if (thumbnail_url && result.streamId) {
            const { error: thumbnailError } =
                await window.supabaseClient
                    .from("streams")
                    .update({ thumbnail_url })
                    .eq("id", result.streamId)
                    .eq("creator_id", session.user.id);

            if (thumbnailError) {
                console.warn(
                    "تعذر حفظ صورة البث:",
                    thumbnailError.message
                );
            }
        }

        document.getElementById("rtmpUrl").value =
            result.rtmpUrl || "";

        document.getElementById("streamKey").value =
            result.streamKey || "";

        document.getElementById("streamConnection")
            .classList.remove("hidden");

        activeStream = {
            id: result.streamId,
            title,
            description,
            category,
            thumbnail_url,
            provider: "livekit",
            provider_input_id: result.ingressId,
            room_name: result.roomName,
            is_live: false,
            viewer_count: 0,
            created_at: new Date().toISOString(),
            started_at: null,
            ended_at: null
        };

        showMessage(
            "تم تجهيز اتصال البث! انسخ بيانات RTMP إلى OBS وابدأ إرسال الفيديو. هذا لا يعني أن البث أصبح مباشرًا بعد."
        );

        await loadStreams();
    } catch (error) {
        console.error("Start stream error:", error);

        showMessage(
            "تعذر تجهيز البث: " + error.message,
            true
        );
    } finally {
        creatingStream = false;
        setButtons(false);
    }
}

async function endStream() {
    if (!activeStream) return;

    if (!confirm(
        "هل تريد إنهاء سجل البث؟ أوقف البث من OBS أولاً."
    )) {
        return;
    }

    setButtons(true);
    showMessage(
        "جاري إنهاء سجل البث. أوقف الإرسال من OBS إن لم تفعل ذلك."
    );

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
        document.getElementById("streamConnection")
            .classList.add("hidden");

        document.getElementById("rtmpUrl").value = "";
        document.getElementById("streamKey").value = "";

        showMessage(
            "تم إنهاء سجل البث. تأكد من إيقاف الإرسال في OBS أيضًا."
        );

        await loadStreams();
    } catch (error) {
        console.error(error);
        showMessage(
            "تعذر إنهاء سجل البث: " + error.message,
            true
        );
    } finally {
        setButtons(false);
    }
}

function renderHistory(streams) {
    const history = document.getElementById("history");
    const past = streams.filter(stream => stream.ended_at);

    if (!past.length) {
        history.innerHTML =
            '<div class="current-stream empty">لا توجد بثوث سابقة.</div>';
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
                <p>انتهى ${formatDate(stream.ended_at)}</p>
            </div>
        </div>
    `).join("");
}

function setButtons(loading) {
    document.getElementById("startButton").disabled =
        loading || !!activeStream;

    document.getElementById("endButton").disabled =
        loading || !activeStream;
}

function showMessage(text, isError = false) {
    const element = document.getElementById("message");
    element.textContent = text;
    element.className = "message " + (isError ? "error" : "success");
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

async function copyField(id) {
    const value = document.getElementById(id).value;

    if (!value) {
        showMessage("لا توجد بيانات لنسخها.", true);
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        showMessage("تم النسخ بنجاح.");
    } catch {
        const input = document.getElementById(id);
        input.type = "text";
        input.select();

        const copied = document.execCommand("copy");

        input.setSelectionRange(0, 0);

        if (id === "streamKey") {
            input.type = "password";
        }

        showMessage(
            copied ? "تم النسخ بنجاح." : "تعذر النسخ تلقائيًا. انسخ النص يدويًا.",
            !copied
        );
    }
}

function toggleStreamKey() {
    const input = document.getElementById("streamKey");
    const button = document.getElementById("toggleStreamKey");

    const showing = input.type === "text";

    input.type = showing ? "password" : "text";
    button.textContent = showing
        ? "إظهار مفتاح البث"
        : "إخفاء مفتاح البث";
}

function getCategory(category) {
    return {
        gaming: "🎮 Gaming",
        just_chatting: "💬 Just Chatting",
        education: "📚 Education",
        other: "⭐ Other"
    }[category] || category || "Other";
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
