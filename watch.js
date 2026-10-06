const params = new URLSearchParams(window.location.search);
const streamId = params.get("id");

const player = document.getElementById("player");
const playerTitle = document.getElementById("playerTitle");
const playerStatus = document.getElementById("playerStatus");

const liveBadge = document.getElementById("liveBadge");
const viewerCount = document.getElementById("viewerCount");

const streamTitle = document.getElementById("streamTitle");
const description = document.getElementById("description");
const streamCategory = document.getElementById("streamCategory");

const followButton = document.getElementById("follow");

const avatar = document.getElementById("avatar");
const creatorName = document.getElementById("creatorName");
const username = document.getElementById("username");

const messages = document.getElementById("messages");
const chatForm = document.getElementById("chat");
const messageInput = document.getElementById("message");
const loginHint = document.getElementById("loginHint");

let currentStream = null;
let currentUser = null;
let following = false;


/* =========================================
   START
========================================= */

document.addEventListener("DOMContentLoaded", async () => {

    if (!streamId) {
        showError("لم يتم تحديد البث.");
        return;
    }

    try {

        const {
            data: {
                user
            }
        } = await supabaseClient.auth.getUser();

        currentUser = user || null;

        await loadStream();
        await setupFollow();
        await loadChat();
        setupRealtimeChat();
        setupChatForm();

    } catch (error) {

        console.error(error);

        showError("حدث خطأ أثناء تحميل البث.");

    }

});


/* =========================================
   LOAD STREAM
========================================= */

async function loadStream() {

    const {
        data,
        error
    } = await supabaseClient
        .from("streams")
        .select(`
            id,
            title,
            description,
            category,
            thumbnail_url,
            viewer_count,
            is_live,
            started_at,
            creator_id
        `)
        .eq("id", streamId)
        .maybeSingle();


    if (error) {

        console.error("STREAM ERROR:", error);

        showError("حدث خطأ أثناء تحميل بيانات البث.");
        return;

    }


    if (!data) {

        showError("البث غير موجود.");
        return;

    }


    currentStream = data;


    /* =========================================
       CREATOR
    ========================================= */

    const {
        data: creator,
        error: creatorError
    } = await supabaseClient
        .from("profiles")
        .select(`
            id,
            username,
            display_name,
            avatar_url,
            role,
            creator_approved
        `)
        .eq("id", data.creator_id)
        .maybeSingle();


    if (creatorError) {

        console.error("CREATOR ERROR:", creatorError);

    }


    /* =========================================
       STREAM INFO
    ========================================= */

    streamTitle.textContent =
        data.title || "بث بدون عنوان";


    description.textContent =
        data.description || "لا يوجد وصف لهذا البث.";


    streamCategory.textContent =
        data.category || "Gaming";


    viewerCount.textContent =
        `${Number(data.viewer_count || 0)} مشاهد`;


    /* =========================================
       LIVE STATUS
    ========================================= */

    if (data.is_live) {

        liveBadge.textContent = "🔴 LIVE";
        liveBadge.classList.remove("offline");
        liveBadge.classList.add("live");

        playerTitle.textContent =
            data.title || "البث المباشر";

        playerStatus.textContent =
            "البث مباشر الآن";

    } else {

        liveBadge.textContent = "OFFLINE";

        liveBadge.classList.remove("live");
        liveBadge.classList.add("offline");

        playerTitle.textContent =
            data.title || "البث انتهى";

        playerStatus.textContent =
            "هذا البث غير مباشر حاليًا";

    }


    /* =========================================
       CREATOR INFO
    ========================================= */

    if (creator) {

        creatorName.textContent =
            creator.display_name ||
            creator.username ||
            "Creator";


        username.textContent =
            creator.username
                ? `@${creator.username}`
                : "@creator";


        if (creator.avatar_url) {

            avatar.innerHTML = `
                <img
                    src="${escapeHTML(creator.avatar_url)}"
                    alt=""
                >
            `;

        } else {

            avatar.textContent =
                (
                    creator.display_name ||
                    creator.username ||
                    "L"
                ).charAt(0).toUpperCase();

        }

    }


    /* =========================================
       PLAYER
    ========================================= */

    if (data.is_live) {

        showPlayerWaiting();

    } else {

        showOfflinePlayer();

    }

}


/* =========================================
   PLAYER PLACEHOLDER
========================================= */

function showPlayerWaiting() {

    player.innerHTML = `

        <div class="player-content">

            <div class="player-icon">
                ▶
            </div>

            <h2>
                ${escapeHTML(currentStream.title || "البث المباشر")}
            </h2>

            <p>
                البث مباشر، ولكن مشغل الفيديو لم يتم ربطه بخدمة البث بعد.
            </p>

        </div>

    `;

}


function showOfflinePlayer() {

    player.innerHTML = `

        <div class="player-content">

            <div class="player-icon">
                ◼
            </div>

            <h2>
                البث غير متصل
            </h2>

            <p>
                لا يوجد بث مباشر حاليًا.
            </p>

        </div>

    `;

}


function showError(text) {

    if (player) {

        player.innerHTML = `

            <div class="player-content">

                <div class="player-icon">
                    ⚠
                </div>

                <h2>
                    حدث خطأ
                </h2>

                <p>
                    ${escapeHTML(text)}
                </p>

            </div>

        `;

    }

}


/* =========================================
   FOLLOW
========================================= */

async function setupFollow() {

    if (!followButton || !currentStream) {
        return;
    }


    if (!currentUser) {

        followButton.textContent = "♡ متابعة";

        followButton.onclick = () => {

            alert("يجب تسجيل الدخول أولًا للمتابعة.");

            window.location.href =
                "./login.html";

        };

        return;

    }


    if (currentUser.id === currentStream.creator_id) {

        followButton.textContent = "بثك";

        followButton.disabled = true;

        return;

    }


    await checkFollowing();


    followButton.onclick = async () => {

        await toggleFollow();

    };

}


/* =========================================
   CHECK FOLLOW
========================================= */

async function checkFollowing() {

    const {
        data,
        error
    } = await supabaseClient
        .from("follows")
        .select("follower_id")
        .eq("follower_id", currentUser.id)
        .eq("creator_id", currentStream.creator_id)
        .maybeSingle();


    if (error) {

        console.error("FOLLOW CHECK ERROR:", error);

        following = false;

    } else {

        following = !!data;

    }


    updateFollowButton();

}


/* =========================================
   TOGGLE FOLLOW
========================================= */

async function toggleFollow() {

    if (!currentUser) {

        alert("يجب تسجيل الدخول أولًا.");
        return;

    }


    followButton.disabled = true;


    try {

        if (following) {

            const {
                error
            } = await supabaseClient
                .from("follows")
                .delete()
                .eq("follower_id", currentUser.id)
                .eq("creator_id", currentStream.creator_id);


            if (error) {
                throw error;
            }


            following = false;

        } else {

            const {
                error
            } = await supabaseClient
                .from("follows")
                .insert({
                    follower_id: currentUser.id,
                    creator_id: currentStream.creator_id
                });


            if (error) {
                throw error;
            }


            following = true;

        }


        updateFollowButton();


    } catch (error) {

        console.error("FOLLOW ERROR:", error);

        alert(
            "لم نستطع تغيير حالة المتابعة.\n\n" +
            error.message
        );

    } finally {

        followButton.disabled = false;

    }

}


/* =========================================
   FOLLOW BUTTON UI
========================================= */

function updateFollowButton() {

    if (!followButton) {
        return;
    }


    if (following) {

        followButton.textContent =
            "✓ تمت المتابعة";

        followButton.classList.add("following");

    } else {

        followButton.textContent =
            "♡ متابعة";

        followButton.classList.remove("following");

    }

}


/* =========================================
   CHAT
========================================= */

async function loadChat() {

    if (!currentStream) {
        return;
    }


    const {
        data,
        error
    } = await supabaseClient
        .from("stream_chat")
        .select(`
            id,
            message,
            created_at,
            user_id,
            profiles!stream_chat_user_id_fkey (
                username,
                display_name,
                avatar_url
            )
        `)
        .eq("stream_id", currentStream.id)
        .order("created_at", {
            ascending: true
        })
        .limit(100);


    if (error) {

        console.error("CHAT ERROR:", error);

        return;

    }


    messages.innerHTML = "";


    if (!data || data.length === 0) {

        messages.innerHTML = `
            <div class="system">
                لا توجد رسائل حتى الآن 👋
            </div>
        `;

        return;

    }


    data.forEach(chat => {

        addMessage(chat);

    });

}


function addMessage(chat) {

    const profile =
        chat.profiles || {};


    const name =
        profile.display_name ||
        profile.username ||
        "User";


    const message =
        chat.message || "";


    const div =
        document.createElement("div");


    div.className =
        "chat-message";


    div.innerHTML = `

        <strong>
            ${escapeHTML(name)}
        </strong>

        <span>
            ${escapeHTML(message)}
        </span>

    `;


    messages.appendChild(div);


    messages.scrollTop =
        messages.scrollHeight;

}


/* =========================================
   REALTIME CHAT
========================================= */

function setupRealtimeChat() {

    if (!currentStream) {
        return;
    }


    supabaseClient
        .channel(
            `stream-chat-${currentStream.id}`
        )
        .on(
            "postgres_changes",
            {
                event: "INSERT",
                schema: "public",
                table: "stream_chat",
                filter: `stream_id=eq.${currentStream.id}`
            },
            async payload => {

                const newMessage =
                    payload.new;


                const {
                    data: profile
                } = await supabaseClient
                    .from("profiles")
                    .select(`
                        username,
                        display_name,
                        avatar_url
                    `)
                    .eq("id", newMessage.user_id)
                    .maybeSingle();


                addMessage({
                    ...newMessage,
                    profiles: profile
                });

            }
        )
        .subscribe();

}


/* =========================================
   SEND CHAT
========================================= */

function setupChatForm() {

    if (!chatForm) {
        return;
    }


    if (!currentUser) {

        loginHint.hidden = false;

        messageInput.disabled = true;

        return;

    }


    loginHint.hidden = true;


    chatForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const message =
                messageInput.value.trim();


            if (!message) {
                return;
            }


            if (!currentStream || !currentStream.is_live) {

                alert("هذا البث غير مباشر حاليًا.");
                return;

            }


            const {
                error
            } = await supabaseClient
                .from("stream_chat")
                .insert({

                    stream_id:
                        currentStream.id,

                    user_id:
                        currentUser.id,

                    message:
                        message

                });


            if (error) {

                console.error(error);

                alert(
                    "لم يتم إرسال الرسالة: " +
                    error.message
                );

                return;

            }


            messageInput.value = "";

        }
    );

}


/* =========================================
   HTML SECURITY
========================================= */

function escapeHTML(value) {

    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}
