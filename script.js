// ==========================================
// LEVELLIVE - MAIN SCRIPT
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    await updateNavbar();
    await loadLiveStreams();
});


// ==========================================
// NAVBAR
// ==========================================

async function updateNavbar() {

    const navButtons =
        document.querySelector(".nav-buttons");

    if (!navButtons) return;

    try {

        const {
            data: { session }
        } =
            await window.supabaseClient.auth.getSession();

        if (!session) {

            navButtons.innerHTML = `
                <a href="./login.html" class="nav-button">
                    تسجيل الدخول
                </a>

                <a href="./register.html" class="nav-button primary">
                    إنشاء حساب
                </a>
            `;

            return;
        }

        const user = session.user;

        const {
            data: profile,
            error: profileError
        } =
            await window.supabaseClient
                .from("profiles")
                .select(`
                    username,
                    display_name,
                    avatar_url,
                    role
                `)
                .eq("id", user.id)
                .single();

        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );
        }

        const displayName =
            profile?.display_name ||
            profile?.username ||
            user.email?.split("@")[0] ||
            "المستخدم";

        const username =
            profile?.username ||
            "user";

        let avatarHTML;

        if (profile?.avatar_url) {

            avatarHTML = `
                <img
                    src="${escapeHTML(profile.avatar_url)}"
                    alt="Profile"
                    class="profile-image"
                >
            `;

        } else {

            avatarHTML = `
                <div class="profile-avatar">
                    ${escapeHTML(
                        displayName
                            .charAt(0)
                            .toUpperCase()
                    )}
                </div>
            `;
        }

        navButtons.innerHTML = `
            <div class="user-profile">

                <a
                    href="./profile.html"
                    class="profile-link"
                >

                    ${avatarHTML}

                    <div class="profile-info">

                        <strong>
                            ${escapeHTML(displayName)}
                        </strong>

                        <small>
                            @${escapeHTML(username)}
                        </small>

                    </div>

                </a>

                <button
                    class="logout-button"
                    id="logoutButton"
                >
                    تسجيل الخروج
                </button>

            </div>
        `;

        const logoutButton =
            document.getElementById(
                "logoutButton"
            );

        if (logoutButton) {

            logoutButton.addEventListener(
                "click",
                logoutUser
            );
        }

    } catch (error) {

        console.error(
            "Navbar error:",
            error
        );
    }
}


// ==========================================
// LOGOUT
// ==========================================

async function logoutUser() {

    try {

        const { error } =
            await window.supabaseClient
                .auth
                .signOut();

        if (error) throw error;

        window.location.href =
            "./index.html";

    } catch (error) {

        console.error(error);

        alert(
            "حدث خطأ أثناء تسجيل الخروج."
        );
    }
}


// ==========================================
// LIVE STREAMS
// ==========================================

async function loadLiveStreams() {

    const container =
        document.getElementById(
            "liveStreamsGrid"
        );

    if (!container) return;

    container.innerHTML = `
        <div class="live-loading">
            جاري تحميل البثوث المباشرة...
        </div>
    `;

    try {

        const {
            data: streams,
            error
        } =
            await window.supabaseClient
                .from("streams")
                .select(`
                    id,
                    title,
                    description,
                    category,
                    thumbnail_url,
                    viewer_count,
                    started_at,
                    creator_id,
                    profiles!streams_creator_id_fkey (
                        username,
                        display_name,
                        avatar_url
                    )
                `)
                .eq(
                    "is_live",
                    true
                )
                .order(
                    "started_at",
                    {
                        ascending: false
                    }
                );

        if (error) throw error;

        if (
            !streams ||
            streams.length === 0
        ) {

            container.innerHTML = `
                <div class="no-live-streams">

                    <div class="empty-icon">
                        📡
                    </div>

                    <h3>
                        لا توجد بثوث مباشرة الآن
                    </h3>

                    <p>
                        عندما يبدأ أحد صناع المحتوى بثًا
                        سيظهر هنا تلقائيًا.
                    </p>

                </div>
            `;

            return;
        }

        container.innerHTML =
            streams
                .map(
                    createLiveStreamCard
                )
                .join("");

    } catch (error) {

        console.error(
            "Live streams error:",
            error
        );

        container.innerHTML = `
            <div class="no-live-streams">

                <div class="empty-icon">
                    ⚠️
                </div>

                <h3>
                    حدث خطأ
                </h3>

                <p>
                    لم نتمكن من تحميل البثوث.
                </p>

            </div>
        `;
    }
}


// ==========================================
// STREAM CARD
// ==========================================

function createLiveStreamCard(stream) {

    const creator =
        stream.profiles || {};

    const creatorName =
        creator.display_name ||
        creator.username ||
        "صانع محتوى";

    const thumbnail =
        stream.thumbnail_url ||
        "https://placehold.co/640x360/111827/ffffff?text=LEVELLIVE";

    return `
        <a
            href="./watch.html?id=${encodeURIComponent(stream.id)}"
            class="live-stream-card"
        >

            <div class="stream-thumbnail">

                <img
                    src="${escapeHTML(thumbnail)}"
                    alt="${escapeHTML(
                        stream.title || "Live Stream"
                    )}"
                    loading="lazy"
                >

                <span class="live-badge">
                    🔴 LIVE
                </span>

                <span class="stream-viewers">
                    👁 ${Number(
                        stream.viewer_count || 0
                    )}
                </span>

            </div>

            <div class="stream-card-info">

                <div class="stream-card-avatar">

                    ${
                        creator.avatar_url
                        ?
                        `
                            <img
                                src="${escapeHTML(
                                    creator.avatar_url
                                )}"
                                alt=""
                            >
                        `
                        :
                        `
                            ${escapeHTML(
                                creatorName
                                    .charAt(0)
                                    .toUpperCase()
                            )}
                        `
                    }

                </div>

                <div class="stream-card-text">

                    <h3>
                        ${escapeHTML(
                            stream.title ||
                            "بث مباشر"
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            creatorName
                        )}
                    </p>

                    <span>
                        ${escapeHTML(
                            stream.category ||
                            "Gaming"
                        )}
                    </span>

                </div>

            </div>

        </a>
    `;
}


// ==========================================
// SEARCH CREATOR
// ==========================================

async function searchCreator() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );

    if (!searchInput) return;

    const search =
        searchInput.value.trim();

    if (!search) {

        alert(
            "اكتب اسم صانع المحتوى."
        );

        searchInput.focus();

        return;
    }

    try {

        const {
            data: creators,
            error
        } =
            await window.supabaseClient
                .from("profiles")
                .select(`
                    id,
                    username,
                    display_name,
                    avatar_url,
                    role,
                    creator_approved
                `)
                .eq(
                    "role",
                    "creator"
                )
                .eq(
                    "creator_approved",
                    true
                )
                .or(
                    `username.ilike.%${search}%,display_name.ilike.%${search}%`
                )
                .limit(20);

        if (error) throw error;

        if (
            !creators ||
            creators.length === 0
        ) {

            alert(
                "لم يتم العثور على صانع محتوى بهذا الاسم."
            );

            return;
        }

        const creator =
            creators[0];

        /*
         * لو عندك profile.html يدعم ?id=
         * سيتم فتح صفحة صانع المحتوى.
         */
        window.location.href =
            `./profile.html?id=${encodeURIComponent(
                creator.id
            )}`;

    } catch (error) {

        console.error(
            "Search error:",
            error
        );

        alert(
            "حدث خطأ أثناء البحث."
        );
    }
}


// ==========================================
// SEARCH ENTER
// ==========================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            document.activeElement?.id ===
                "searchInput"
        ) {

            searchCreator();
        }
    }
);


// ==========================================
// HTML SECURITY
// ==========================================

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
