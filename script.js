```javascript
// ===============================
// YaserStream - Main Script
// ===============================

document.addEventListener("DOMContentLoaded", async () => {
    await updateNavbar();
});

// ===============================
// تحديث الـ Navbar حسب حالة الدخول
// ===============================
async function updateNavbar() {
    const navButtons = document.querySelector(".nav-buttons");

    if (!navButtons) return;

    try {
        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        if (!session) {
            // المستخدم غير مسجل دخول
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

        // المستخدم مسجل دخول
        const user = session.user;

        // جلب بيانات البروفايل
        const { data: profile } = await supabaseClient
            .from("profiles")
            .select("username, display_name")
            .eq("id", user.id)
            .single();

        const displayName =
            profile?.display_name ||
            profile?.username ||
            user.email?.split("@")[0] ||
            "المستخدم";

        const username =
            profile?.username ||
            "user";

        navButtons.innerHTML = `
            <div class="user-profile">
                <div class="profile-avatar">
                    ${displayName.charAt(0).toUpperCase()}
                </div>

                <div class="profile-info">
                    <strong>${escapeHTML(displayName)}</strong>
                    <small>@${escapeHTML(username)}</small>
                </div>

                <button
                    class="logout-button"
                    id="logoutButton"
                >
                    تسجيل الخروج
                </button>
            </div>
        `;

        document
            .getElementById("logoutButton")
            ?.addEventListener("click", logoutUser);

    } catch (error) {
        console.error("Navbar error:", error);
    }
}

// ===============================
// تسجيل الخروج
// ===============================
async function logoutUser() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("حدث خطأ أثناء تسجيل الخروج.");
        console.error(error);
        return;
    }

    window.location.reload();
}

// ===============================
// البحث
// ===============================
function searchCreator() {
    const searchInput = document.getElementById("searchInput");

    if (!searchInput) return;

    const search = searchInput.value.trim();

    if (search === "") {
        alert("اكتب اسم صانع المحتوى.");
        return;
    }

    alert("البحث عن: " + search);
}

// ===============================
// حماية من إدخال HTML في اسم المستخدم
// ===============================
function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
```
