let session = null;
let currentStream = null;
let following = false;
let channel = null;


// ========================================
// START
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    init
);


async function init() {

    try {

        const streamId =
            new URLSearchParams(
                window.location.search
            ).get("stream");


        if (!streamId) {

            showError(
                "لم يتم تحديد بث."
            );

            return;
        }


        const {
            data
        } =
            await window.supabaseClient
                .auth
                .getSession();


        session =
            data.session;


        await loadStream(
            streamId
        );


        await setupFollow();


        setupChat();


    } catch (error) {

        console.error(error);

        showError(
            "حدث خطأ: " +
            error.message
        );

    }

}


// ========================================
// LOAD STREAM
// ========================================

async function loadStream(
    streamId
) {

    const {
        data,
        error
    } =
        await window.supabaseClient

            .from("streams")

            .select(`
                id,
                creator_id,
                title,
                description,
                category,
                thumbnail_url,
                is_live,
                viewer_count,
                started_at,

                profiles!streams_creator_id_fkey (
                    username,
                    display_name,
                    avatar_url
                )
            `)

            .eq(
                "id",
                streamId
            )

            .single();


    if (error)
        throw error;


    if (!data)
        throw new Error(
            "البث غير موجود."
        );


    currentStream =
        data;


    renderStream();

}


// ========================================
// RENDER STREAM
// ========================================

function renderStream() {

    const profile =
        currentStream.profiles || {};


    const creatorName =
        profile.display_name ||
        profile.username ||
        "Creator";


    document.title =
        currentStream.title +
        " | LevelLive";


    document.getElementById(
        "streamTitle"
    ).textContent =
        currentStream.title;


    document.getElementById(
        "playerTitle"
    ).textContent =
        currentStream.is_live
            ? currentStream.title
            : "هذا البث انتهى";


    document.getElementById(
        "description"
    ).textContent =
        currentStream.description ||
        "لا يوجد وصف لهذا البث.";


    document.getElementById(
        "viewerCount"
    ).textContent =
        Number(
            currentStream.viewer_count || 0
        ) +
        " مشاهد";


    const badge =
        document.getElementById(
            "liveBadge"
        );


    badge.textContent =
        currentStream.is_live
            ? "LIVE"
            : "OFFLINE";


    badge.className =
        currentStream.is_live
            ? "live"
            : "offline";


    document.getElementById(
        "creatorName"
    ).textContent =
        creatorName;


    document.getElementById(
        "username"
    ).textContent =
        "@" +
        (
            profile.username ||
            "creator"
        );


    const avatar =
        document.getElementById(
            "avatar"
        );


    if (profile.avatar_url) {

        avatar.innerHTML = `
            <img
                src="${escapeHTML(
                    profile.avatar_url
                )}"
                alt=""
            >
        `;

    } else {

        avatar.textContent =
            creatorName
                .charAt(0)
                .toUpperCase();

    }

}


// ========================================
// FOLLOW
// ========================================

async function setupFollow() {

    const button =
        document.getElementById(
            "follow"
        );


    if (!session) {

        button.onclick = () => {

            window.location.href =
                "./login.html";

        };

        return;
    }


    if (
        session.user.id ===
        currentStream.creator_id
    ) {

        button.style.display =
            "none";

        return;
    }


    const {
        data,
        error
    } =
        await window.supabaseClient

            .from("follows")

            .select(
                "follower_id"
            )

            .eq(
                "follower_id",
                session.user.id
            )

            .eq(
                "creator_id",
                currentStream.creator_id
            )

            .maybeSingle();


    if (error)
        console.error(error);


    following =
        !!data;


    updateFollowButton();


    button.onclick =
        toggleFollow;

}


// ========================================
// TOGGLE FOLLOW
// ========================================

async function toggleFollow() {

    const button =
        document.getElementById(
            "follow"
        );


    button.disabled =
        true;


    try {

        if (following) {

            const {
                error
            } =
                await window.supabaseClient

                    .from("follows")

                    .delete()

                    .eq(
                        "follower_id",
                        session.user.id
                    )

                    .eq(
                        "creator_id",
                        currentStream.creator_id
                    );


            if (error)
                throw error;


            following = false;


        } else {

            const {
                error
            } =
                await window.supabaseClient

                    .from("follows")

                    .insert({
                        follower_id:
                            session.user.id,

                        creator_id:
                            currentStream.creator_id
                    });


            if (error)
                throw error;


            following = true;

        }


        updateFollowButton();


    } catch (error) {

        console.error(error);

        alert(
            "تعذر تحديث المتابعة: " +
            error.message
        );

    }


    button.disabled =
        false;

}


// ========================================
// FOLLOW BUTTON
// ========================================

function updateFollowButton() {

    const button =
        document.getElementById(
            "follow"
        );


    button.textContent =
        following
            ? "✓ متابَع"
            : "♡ متابعة";


    button.classList.toggle(
        "following",
        following
    );

}


// ========================================
// CHAT
// ========================================

function setupChat() {

    const form =
        document.getElementById(
            "chat"
        );


    const input =
        document.getElementById(
            "message"
        );


    if (!session) {

        input.disabled =
            true;


        input.placeholder =
            "سجّل الدخول للدردشة";


        document.getElementById(
            "loginHint"
        ).hidden =
            false;


        return;

    }


    form.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();


            const message =
                input.value.trim();


            if (!message)
                return;


            /*
                سيتم تخزين الرسائل
                في جدول stream_chat
                بعد إنشاء نظام الشات
            */


            addMessage(
                session.user
                    .user_metadata
                    ?.display_name ||
                session.user.email
                    ?.split("@")[0] ||
                "User",

                message
            );


            input.value = "";

        }
    );


    subscribeToChat();

}


// ========================================
// REALTIME CHAT
// ========================================

function subscribeToChat() {

    channel =
        window.supabaseClient

            .channel(
                "chat-" +
                currentStream.id
            )

            .on(
                "postgres_changes",
                {
                    event: "INSERT",

                    schema: "public",

                    table: "stream_chat",

                    filter:
                        "stream_id=eq." +
                        currentStream.id
                },

                payload => {

                    addMessage(
                        payload.new
                            .display_name ||
                        "User",

                        payload.new
                            .message
                    );

                }
            )

            .subscribe();

}


// ========================================
// ADD MESSAGE
// ========================================

function addMessage(
    username,
    message
) {

    const messages =
        document.getElementById(
            "messages"
        );


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "msg";


    const name =
        document.createElement(
            "strong"
        );


    name.textContent =
        username + ":";


    const text =
        document.createElement(
            "span"
        );


    text.textContent =
        " " + message;


    item.append(
        name,
        text
    );


    messages.appendChild(
        item
    );


    messages.scrollTop =
        messages.scrollHeight;

}


// ========================================
// ERROR
// ========================================

function showError(
    message
) {

    document.querySelector(
        "main"
    ).innerHTML = `

        <div id="player">

            <div>

                <h2>
                    ${escapeHTML(
                        message
                    )}
                </h2>

            </div>

        </div>

    `;

}


// ========================================
// ESCAPE HTML
// ========================================

function escapeHTML(
    text
) {

    return String(
        text ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ========================================
// CLEANUP
// ========================================

window.addEventListener(
    "beforeunload",
    () => {

        if (channel) {

            window.supabaseClient
                .removeChannel(
                    channel
                );

        }

    }
);
