// ==========================================
// LEVELLIVE - WATCH PAGE
// ==========================================

let currentStream = null;
let currentUser = null;
let currentProfile = null;
let chatChannel = null;


// ==========================================
// INITIALIZE
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    await initializeWatchPage();
});


// ==========================================
// INITIALIZE WATCH PAGE
// ==========================================

async function initializeWatchPage() {
    try {
        const streamId = getStreamId();

        if (!streamId) {
            showError("لم يتم تحديد البث.");
            return;
        }

        // الحصول على المستخدم الحالي
        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        currentUser = session?.user || null;

        // تحميل البث
        await loadStream(streamId);

        // تحميل بيانات المستخدم
        if (currentUser) {
            await loadCurrentProfile();
        }

        // تحميل الشات
        await loadChat(streamId);

        // تشغيل Realtime
        subscribeToChat(streamId);

        // إعداد زر المتابعة
        setupFollowButton();

        // إعداد إرسال الرسائل
        setupChatForm();

    } catch (error) {
        console.error("Watch page error:", error);
        showError("حدث خطأ أثناء تحميل البث.");
    }
}


// ==========================================
// GET STREAM ID
// ==========================================

function getStreamId() {
    const params = new URLSearchParams(window.location.search);

    return params.get("id");
}


// ==========================================
// LOAD STREAM
// ==========================================

async function loadStream(streamId) {

    const {
        data,
        error
    } = await supabaseClient
        .from("streams")
        .select(`
            *,
            profiles!streams_creator_id_fkey (
                username,
                display_name,
                avatar_url
            )
        `)
        .eq("id", streamId)
        .single();

    if (error) {
        console.error("Stream error:", error);
        showError("البث غير موجود.");
        return;
    }

    if (!data) {
        showError("البث غير موجود.");
        return;
    }

    currentStream = data;

    renderStream(data);
}


// ==========================================
// RENDER STREAM
// ==========================================

function renderStream(stream) {

    const creator = stream.profiles;

    const titleElement =
        document.getElementById("streamTitle");

    const descriptionElement =
        document.getElementById("streamDescription");

    const viewerElement =
        document.getElementById("viewerCount");

    const creatorNameElement =
        document.getElementById("creatorName");

    const categoryElement =
        document.getElementById("streamCategory");

    const creatorAvatarElement =
        document.getElementById("creatorAvatar");

    if (titleElement) {
        titleElement.textContent =
            stream.title || "بث مباشر";
    }

    if (descriptionElement) {
        descriptionElement.textContent =
            stream.description || "";
    }

    if (viewerElement) {
        viewerElement.textContent =
            `${stream.viewer_count || 0} مشاهد`;
    }

    if (creatorNameElement) {
        creatorNameElement.textContent =
            creator?.display_name ||
            creator?.username ||
            "صانع محتوى";
    }

    if (categoryElement) {
        categoryElement.textContent =
            stream.category || "Gaming";
    }

    if (creatorAvatarElement) {

        if (creator?.avatar_url) {

            creatorAvatarElement.innerHTML = `
                <img
                    src="${escapeHTML(creator.avatar_url)}"
                    alt="Avatar"
                >
            `;

        } else {

            const firstLetter =
                (
                    creator?.display_name ||
                    creator?.username ||
                    "U"
                ).charAt(0).toUpperCase();

            creatorAvatarElement.textContent =
                firstLetter;
        }
    }
}


// ==========================================
// LOAD CURRENT PROFILE
// ==========================================

async function loadCurrentProfile() {

    const {
        data,
        error
    } = await supabaseClient
        .from("profiles")
        .select(`
            username,
            display_name,
            avatar_url
        `)
        .eq("id", currentUser.id)
        .single();

    if (error) {
        console.error("Profile error:", error);
        return;
    }

    currentProfile = data;
}


// ==========================================
// LOAD CHAT HISTORY
// ==========================================

async function loadChat(streamId) {

    const {
        data,
        error
    } = await supabaseClient
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
        .eq("stream_id", streamId)
        .order("created_at", {
            ascending: true
        })
        .limit(100);

    if (error) {
        console.error("Chat loading error:", error);
        return;
    }

    const chatContainer =
        document.getElementById("chatMessages");

    if (!chatContainer) return;

    chatContainer.innerHTML = "";

    data.forEach(message => {
        addMessageToChat(message);
    });

    scrollChatToBottom();
}


// ==========================================
// REALTIME CHAT
// ==========================================

function subscribeToChat(streamId) {

    if (chatChannel) {
        supabaseClient
            .removeChannel(chatChannel);
    }

    chatChannel =
        supabaseClient
            .channel(`stream-chat-${streamId}`)

            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "stream_chat",
                    filter: `stream_id=eq.${streamId}`
                },

                async (payload) => {

                    console.log(
                        "New chat message:",
                        payload.new
                    );

                    const message =
                        payload.new;

                    // الحصول على بيانات صاحب الرسالة
                    const {
                        data: profile
                    } = await supabaseClient
                        .from("profiles")
                        .select(`
                            username,
                            display_name,
                            avatar_url
                        `)
                        .eq("id", message.user_id)
                        .single();

                    addMessageToChat({
                        ...message,
                        profiles: profile
                    });

                    scrollChatToBottom();
                }
            )

            .subscribe((status) => {

                console.log(
                    "Chat realtime status:",
                    status
                );

            });
}


// ==========================================
// SETUP CHAT FORM
// ==========================================

function setupChatForm() {

    const chatForm =
        document.getElementById("chatForm");

    const chatInput =
        document.getElementById("chatInput");

    if (!chatForm || !chatInput) {
        console.warn(
            "Chat form elements not found."
        );

        return;
    }

    chatForm.addEventListener(
        "submit",
        async (event) => {

            event.preventDefault();

            const message =
                chatInput.value.trim();

            if (!message) return;

            if (message.length > 300) {

                alert(
                    "الرسالة يجب ألا تتجاوز 300 حرف."
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

            if (!currentStream) return;

            chatInput.disabled = true;

            try {

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
                    throw error;
                }

                chatInput.value = "";

            } catch (error) {

                console.error(
                    "Send chat error:",
                    error
                );

                alert(
                    "حدث خطأ أثناء إرسال الرسالة."
                );

            } finally {

                chatInput.disabled = false;

                chatInput.focus();
            }
        }
    );
}


// ==========================================
// ADD MESSAGE
// ==========================================

function addMessageToChat(message) {

    const chatContainer =
        document.getElementById("chatMessages");

    if (!chatContainer) return;

    // منع ظهور نفس الرسالة مرتين
    if (
        document.querySelector(
            `[data-message-id="${message.id}"]`
        )
    ) {
        return;
    }

    const profile =
        message.profiles || {};

    const displayName =
        profile.display_name ||
        profile.username ||
        "مستخدم";

    const avatar =
        profile.avatar_url;

    const messageElement =
        document.createElement("div");

    messageElement.className =
        "chat-message";

    messageElement.dataset.messageId =
        message.id;

    let avatarHTML;

    if (avatar) {

        avatarHTML = `
            <img
                src="${escapeHTML(avatar)}"
                class="chat-avatar"
                alt="Avatar"
            >
        `;

    } else {

        avatarHTML = `
            <div class="chat-avatar-placeholder">
                ${escapeHTML(
                    displayName.charAt(0).toUpperCase()
                )}
            </div>
        `;
    }

    messageElement.innerHTML = `
        ${avatarHTML}

        <div class="chat-message-content">

            <div class="chat-message-header">

                <strong>
                    ${escapeHTML(displayName)}
                </strong>

                <span>
                    ${formatTime(message.created_at)}
                </span>

            </div>

            <div class="chat-message-text">
                ${escapeHTML(message.message)}
            </div>

        </div>
    `;

    chatContainer.appendChild(
        messageElement
    );
}


// ==========================================
// FOLLOW CREATOR
// ==========================================

function setupFollowButton() {

    const followButton =
        document.getElementById("followButton");

    if (!followButton) return;

    followButton.addEventListener(
        "click",
        async () => {

            if (!currentUser) {

                alert(
                    "يجب تسجيل الدخول لمتابعة صانع المحتوى."
                );

                window.location.href =
                    "./login.html";

                return;
            }

            if (!currentStream) return;

            const creatorId =
                currentStream.creator_id;

            if (creatorId === currentUser.id) {

                alert(
                    "لا يمكنك متابعة نفسك."
                );

                return;
            }

            try {

                const {
                    data: existingFollow,
                    error: checkError
                } = await supabaseClient
                    .from("follows")
                    .select("creator_id")
                    .eq(
                        "follower_id",
                        currentUser.id
                    )
                    .eq(
                        "creator_id",
                        creatorId
                    )
                    .maybeSingle();

                if (checkError)
                    throw checkError;

                if (existingFollow) {

                    const {
                        error
                    } = await supabaseClient
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

                    followButton.textContent =
                        "متابعة";

                    followButton.classList.remove(
                        "following"
                    );

                } else {

                    const {
                        error
                    } = await supabaseClient
                        .from("follows")
                        .insert({

                            follower_id:
                                currentUser.id,

                            creator_id:
                                creatorId
                        });

                    if (error)
                        throw error;

                    followButton.textContent =
                        "✓ تتابعه";

                    followButton.classList.add(
                        "following"
                    );
                }

            } catch (error) {

                console.error(
                    "Follow error:",
                    error
                );

                alert(
                    "حدث خطأ أثناء تحديث المتابعة."
                );
            }
        }
    );

    checkFollowStatus();
}


// ==========================================
// CHECK FOLLOW STATUS
// ==========================================

async function checkFollowStatus() {

    if (
        !currentUser ||
        !currentStream
    ) return;

    const followButton =
        document.getElementById("followButton");

    if (!followButton) return;

    const {
        data,
        error
    } = await supabaseClient
        .from("follows")
        .select("creator_id")
        .eq(
            "follower_id",
            currentUser.id
        )
        .eq(
            "creator_id",
            currentStream.creator_id
        )
        .maybeSingle();

    if (error) {
        console.error(
            "Follow check error:",
            error
        );

        return;
    }

    if (data) {

        followButton.textContent =
            "✓ تتابعه";

        followButton.classList.add(
            "following"
        );

    } else {

        followButton.textContent =
            "متابعة";

        followButton.classList.remove(
            "following"
        );
    }
}


// ==========================================
// CHAT SCROLL
// ==========================================

function scrollChatToBottom() {

    const chatContainer =
        document.getElementById("chatMessages");

    if (!chatContainer) return;

    chatContainer.scrollTop =
        chatContainer.scrollHeight;
}


// ==========================================
// TIME
// ==========================================

function formatTime(dateString) {

    if (!dateString)
        return "";

    const date =
        new Date(dateString);

    return date.toLocaleTimeString(
        "ar-EG",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


// ==========================================
// ERROR
// ==========================================

function showError(message) {

    const container =
        document.getElementById("watchContainer");

    if (container) {

        container.innerHTML = `
            <div class="watch-error">
                <h2>⚠️</h2>
                <p>${escapeHTML(message)}</p>

                <a href="./index.html">
                    العودة للرئيسية
                </a>
            </div>
        `;

    } else {

        alert(message);
    }
}


// ==========================================
// SECURITY
// ==========================================

function escapeHTML(text) {

    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
