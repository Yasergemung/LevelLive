// ==========================================
// LEVELLIVE - WATCH
// ==========================================

let currentStream = null;
let currentUser = null;
let currentProfile = null;
let chatChannel = null;


// ==========================================
// START
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await initializeWatchPage();

    }
);


// ==========================================
// INITIALIZE
// ==========================================

async function initializeWatchPage() {

    const streamId =
        getStreamId();

    if (!streamId) {

        showError(
            "لم يتم تحديد البث."
        );

        return;
    }

    try {

        const {
            data: {
                session
            }
        } =
            await window.supabaseClient
                .auth
                .getSession();

        currentUser =
            session?.user || null;

        await loadStream(
            streamId
        );

        if (!currentStream)
            return;

        if (currentUser) {

            await loadCurrentProfile();

        }

        await loadChat(
            streamId
        );

        subscribeToChat(
            streamId
        );

        setupChatForm();

        setupFollowButton();

    } catch (error) {

        console.error(
            "Watch initialization error:",
            error
        );

        showError(
            "حدث خطأ أثناء تحميل البث."
        );
    }
}


// ==========================================
// STREAM ID
// ==========================================

function getStreamId() {

    const params =
        new URLSearchParams(
            window.location.search
        );

    return params.get(
        "id"
    );
}


// ==========================================
// LOAD STREAM
// ==========================================

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
                ended_at,
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

    if (error) {

        console.error(
            "Stream loading error:",
            error
        );

        showError(
            "تعذر تحميل البث."
        );

        return;
    }

    if (!data) {

        showError(
            "البث غير موجود."
        );

        return;
    }

    currentStream =
        data;

    renderStream(
        data
    );
}


// ==========================================
// RENDER STREAM
// ==========================================

function renderStream(
    stream
) {

    const creator =
        stream.profiles || {};

    const title =
        document.getElementById(
            "streamTitle"
        );

    const description =
        document.getElementById(
            "streamDescription"
        );

    const viewers =
        document.getElementById(
            "viewerCount"
        );

    const creatorName =
        document.getElementById(
            "creatorName"
        );

    const category =
        document.getElementById(
            "streamCategory"
        );

    const creatorAvatar =
        document.getElementById(
            "creatorAvatar"
        );

    if (title) {

        title.textContent =
            stream.title ||
            "بث مباشر";
    }

    if (description) {

        description.textContent =
            stream.description ||
            "";
    }

    if (viewers) {

        viewers.textContent =
            `${Number(
                stream.viewer_count || 0
            )} مشاهد`;
    }

    if (creatorName) {

        creatorName.textContent =
            creator.display_name ||
            creator.username ||
            "صانع محتوى";
    }

    if (category) {

        category.textContent =
            stream.category ||
            "Gaming";
    }

    if (creatorAvatar) {

        if (creator.avatar_url) {

            creatorAvatar.innerHTML = `
                <img
                    src="${escapeHTML(
                        creator.avatar_url
                    )}"
                    alt=""
                >
            `;

        } else {

            creatorAvatar.textContent =
                (
                    creator.display_name ||
                    creator.username ||
                    "U"
                )
                    .charAt(0)
                    .toUpperCase();
        }
    }

    /*
     * مهم:
     * الفيديو الحقيقي لم يتم ربطه بعد.
     */

    const player =
        document.getElementById(
            "videoPlayer"
        );

    if (player) {

        player.innerHTML = `
            <div class="player-placeholder">

                <div class="player-icon">
                    🎮
                </div>

                <h2>
                    البث مباشر الآن
                </h2>

                <p>
                    مشغل الفيديو الحقيقي
                    سيتم ربطه بخدمة البث في المرحلة التالية.
                </p>

            </div>
        `;
    }
}


// ==========================================
// PROFILE
// ==========================================

async function loadCurrentProfile() {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("profiles")
            .select(`
                username,
                display_name,
                avatar_url
            `)
            .eq(
                "id",
                currentUser.id
            )
            .single();

    if (error) {

        console.error(
            "Current profile error:",
            error
        );

        return;
    }

    currentProfile =
        data;
}


// ==========================================
// CHAT HISTORY
// ==========================================

async function loadChat(
    streamId
) {

    const {
        data,
        error
    } =
        await window.supabaseClient
            .from("stream_chat")
            .select(`
                id,
                user_id,
                message,
                created_at,
                profiles!stream_chat_user_id_fkey (
                    username,
                    display_name,
                    avatar_url
                )
            `)
            .eq(
                "stream_id",
                streamId
            )
            .order(
                "created_at",
                {
                    ascending: true
                }
            )
            .limit(100);

    if (error) {

        console.error(
            "Chat history error:",
            error
        );

        return;
    }

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container)
        return;

    container.innerHTML = "";

    data.forEach(
        addMessageToChat
    );

    scrollChatToBottom();
}


// ==========================================
// REALTIME CHAT
// ==========================================

function subscribeToChat(
    streamId
) {

    if (chatChannel) {

        window.supabaseClient
            .removeChannel(
                chatChannel
            );
    }

    chatChannel =
        window.supabaseClient
            .channel(
                `stream-chat-${streamId}`
            )
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "stream_chat",
                    filter:
                        `stream_id=eq.${streamId}`
                },
                async payload => {

                    const message =
                        payload.new;

                    const {
                        data: profile
                    } =
                        await window.supabaseClient
                            .from("profiles")
                            .select(`
                                username,
                                display_name,
                                avatar_url
                            `)
                            .eq(
                                "id",
                                message.user_id
                            )
                            .single();

                    addMessageToChat({
                        ...message,
                        profiles:
                            profile
                    });

                    scrollChatToBottom();
                }
            )
            .subscribe(
                status => {

                    console.log(
                        "Chat realtime:",
                        status
                    );
                }
            );
}


// ==========================================
// CHAT FORM
// ==========================================

function setupChatForm() {

    const form =
        document.getElementById(
            "chatForm"
        );

    const input =
        document.getElementById(
            "chatInput"
        );

    if (!form || !input)
        return;

    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            const message =
                input.value.trim();

            if (!message)
                return;

            if (
                message.length >
                300
            ) {

                alert(
                    "الرسالة لا يمكن أن تتجاوز 300 حرف."
                );

                return;
            }

            if (!currentUser) {

                alert(
                    "يجب تسجيل الدخول لإرسال رسالة."
                );

                window.location.href =
                    "./login.html";

                return;
            }

            if (
                !currentStream ||
                !currentStream.is_live
            ) {

                alert(
                    "هذا البث انتهى."
                );

                return;
            }

            input.disabled =
                true;

            try {

                const {
                    error
                } =
                    await window.supabaseClient
                        .from("stream_chat")
                        .insert({
                            stream_id:
                                currentStream.id,

                            user_id:
                                currentUser.id,

                            message:
                                message
                        });

                if (error)
                    throw error;

                input.value =
                    "";

            } catch (error) {

                console.error(
                    "Send message error:",
                    error
                );

                alert(
                    "حدث خطأ أثناء إرسال الرسالة."
                );

            } finally {

                input.disabled =
                    false;

                input.focus();
            }
        }
    );
}


// ==========================================
// ADD CHAT MESSAGE
// ==========================================

function addMessageToChat(
    message
) {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container)
        return;

    if (
        container.querySelector(
            `[data-message-id="${message.id}"]`
        )
    ) {

        return;
    }

    const profile =
        message.profiles || {};

    const name =
        profile.display_name ||
        profile.username ||
        "مستخدم";

    const element =
        document.createElement(
            "div"
        );

    element.className =
        "chat-message";

    element.dataset.messageId =
        message.id;

    element.innerHTML = `
        <div class="chat-avatar">

            ${
                profile.avatar_url
                ?
                `
                    <img
                        src="${escapeHTML(
                            profile.avatar_url
                        )}"
                        alt=""
                    >
                `
                :
                escapeHTML(
                    name
                        .charAt(0)
                        .toUpperCase()
                )
            }

        </div>

        <div class="chat-message-content">

            <div class="chat-message-header">

                <strong>
                    ${escapeHTML(name)}
                </strong>

                <span>
                    ${formatTime(
                        message.created_at
                    )}
                </span>

            </div>

            <p>
                ${escapeHTML(
                    message.message
                )}
            </p>

        </div>
    `;

    container.appendChild(
        element
    );
}


// ==========================================
// FOLLOW
// ==========================================

function setupFollowButton() {

    const button =
        document.getElementById(
            "followButton"
        );

    if (!button)
        return;

    checkFollowStatus();

    button.addEventListener(
        "click",
        async () => {

            if (!currentUser) {

                alert(
                    "يجب تسجيل الدخول للمتابعة."
                );

                window.location.href =
                    "./login.html";

                return;
            }

            if (!currentStream)
                return;

            const creatorId =
                currentStream.creator_id;

            if (
                creatorId ===
                currentUser.id
            ) {

                alert(
                    "لا يمكنك متابعة نفسك."
                );

                return;
            }

            try {

                const {
                    data: existing
                } =
                    await window.supabaseClient
                        .from("follows")
                        .select(
                            "creator_id"
                        )
                        .eq(
                            "follower_id",
                            currentUser.id
                        )
                        .eq(
                            "creator_id",
                            creatorId
                        )
                        .maybeSingle();

                if (existing) {

                    const {
                        error
                    } =
                        await window.supabaseClient
                            .from("follows")
                            .delete()
                            .eq(
                                "follower_id",
                                currentUser.id
                            )
                            .eq(
                                "creator_id",
                                creatorId
                            );

                    if (error)
                        throw error;

                    button.textContent =
                        "متابعة";

                } else {

                    const {
                        error
                    } =
                        await window.supabaseClient
                            .from("follows")
                            .insert({
                                follower_id:
                                    currentUser.id,

                                creator_id:
                                    creatorId
                            });

                    if (error)
                        throw error;

                    button.textContent =
                        "✓ تتابعه";
                }

            } catch (error) {

                console.error(
                    "Follow error:",
                    error
                );

                alert(
                    "حدث خطأ أثناء المتابعة."
                );
            }
        }
    );
}


// ==========================================
// FOLLOW STATUS
// ==========================================

async function checkFollowStatus() {

    if (
        !currentUser ||
        !currentStream
    )
        return;

    const button =
        document.getElementById(
            "followButton"
        );

    if (!button)
        return;

    const {
        data
    } =
        await window.supabaseClient
            .from("follows")
            .select(
                "creator_id"
            )
            .eq(
                "follower_id",
                currentUser.id
            )
            .eq(
                "creator_id",
                currentStream.creator_id
            )
            .maybeSingle();

    if (data) {

        button.textContent =
            "✓ تتابعه";

    } else {

        button.textContent =
            "متابعة";
    }
}


// ==========================================
// HELPERS
// ==========================================

function scrollChatToBottom() {

    const container =
        document.getElementById(
            "chatMessages"
        );

    if (!container)
        return;

    container.scrollTop =
        container.scrollHeight;
}


function formatTime(
    dateString
) {

    if (!dateString)
        return "";

    return new Date(
        dateString
    ).toLocaleTimeString(
        "ar-EG",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


function showError(
    message
) {

    const container =
        document.getElementById(
            "watchContainer"
        );

    if (container) {

        container.innerHTML = `
            <div class="watch-error">

                <div>
                    ⚠️
                </div>

                <h2>
                    ${escapeHTML(
                        message
                    )}
                </h2>

                <a href="./index.html">
                    العودة للرئيسية
                </a>

            </div>
        `;

    } else {

        alert(message);
    }
}


function escapeHTML(text) {

    return String(text ?? "")
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
