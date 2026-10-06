// ========================================
// YaserStream - Main JavaScript
// ========================================

document.addEventListener("DOMContentLoaded", async () => {

    await updateNavbar();

});


// ========================================
// تحديث الـ Navbar
// ========================================

async function updateNavbar() {

    const navButtons = document.querySelector(".nav-buttons");

    if (!navButtons) {
        return;
    }

    try {

        const {
            data: {
                session
            }
        } = await window.supabaseClient.auth.getSession();


        // ========================================
        // المستخدم غير مسجل دخول
        // ========================================

        if (!session) {

            navButtons.innerHTML = `

                <a
                    href="./login.html"
                    class="nav-button"
                >
                    تسجيل الدخول
                </a>

                <a
                    href="./register.html"
                    class="nav-button primary"
                >
                    إنشاء حساب
                </a>

            `;

            return;
        }


        // ========================================
        // المستخدم مسجل دخول
        // ========================================

        const user = session.user;


        // جلب بيانات المستخدم من profiles

        const {
            data: profile,
            error: profileError
        } = await window.supabaseClient
            .from("profiles")
            .select("username, display_name, avatar_url, role")
            .eq("id", user.id)
            .single();


        if (profileError) {

            console.error(
                "Profile error:",
                profileError
            );

        }


        // الاسم الظاهر

        const displayName =
            profile?.display_name ||
            profile?.username ||
            user.email?.split("@")[0] ||
            "المستخدم";


        // Username

        const username =
            profile?.username ||
            "user";


        // صورة البروفايل

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


        // ========================================
        // عرض البروفايل
        // ========================================

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


        // ========================================
        // زر تسجيل الخروج
        // ========================================

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


// ========================================
// تسجيل الخروج
// ========================================

async function logoutUser() {

    try {

        const {
            error
        } = await window.supabaseClient.auth.signOut();


        if (error) {

            throw error;

        }


        window.location.href =
            "./index.html";


    } catch (error) {

        console.error(error);

        alert(
            "حدث خطأ أثناء تسجيل الخروج."
        );

    }

}


// ========================================
// البحث
// ========================================

function searchCreator() {

    const searchInput =
        document.getElementById(
            "searchInput"
        );


    if (!searchInput) {
        return;
    }


    const search =
        searchInput.value.trim();


    if (search === "") {

        alert(
            "اكتب اسم صانع المحتوى."
        );

        return;

    }


    alert(
        "البحث عن: " + search
    );

}


// ========================================
// حماية النصوص من HTML
// ========================================

function escapeHTML(text) {

    return String(text)

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
