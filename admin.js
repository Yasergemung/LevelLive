let currentUser = null;


// ========================================
// START
// ========================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        await checkAdmin();

        document
            .getElementById("refreshApplications")
            ?.addEventListener(
                "click",
                loadApplications
            );

        document
            .getElementById("logoutAdmin")
            ?.addEventListener(
                "click",
                logoutAdmin
            );

    }
);


// ========================================
// CHECK ADMIN
// ========================================

async function checkAdmin() {

    try {

        const {
            data: { session }
        } =
            await window.supabaseClient.auth.getSession();


        if (!session) {

            window.location.href =
                "./login.html";

            return;
        }


        currentUser =
            session.user;


        const {
            data: profile,
            error
        } =
            await window.supabaseClient
                .from("profiles")
                .select("role, display_name")
                .eq("id", currentUser.id)
                .single();


        if (error)
            throw error;


        if (profile.role !== "admin") {

            alert(
                "ليس لديك صلاحية دخول لوحة التحكم."
            );

            window.location.href =
                "./index.html";

            return;
        }


        await loadApplications();

    } catch (error) {

        console.error(error);

        window.location.href =
            "./index.html";

    }
}


// ========================================
// LOAD APPLICATIONS
// ========================================

async function loadApplications() {

    const container =
        document.getElementById(
            "applicationsContainer"
        );


    container.innerHTML = `
        <div class="loading-box">
            جاري تحميل الطلبات...
        </div>
    `;


    try {

        const {
            data: applications,
            error
        } =
            await window.supabaseClient
                .from("creator_applications")
                .select(`
                    id,
                    user_id,
                    content_type,
                    description,
                    social_link,
                    status,
                    created_at,
                    profiles (
                        username,
                        display_name,
                        avatar_url
                    )
                `)
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (error)
            throw error;


        updateStats(applications);


        if (!applications ||
            applications.length === 0) {

            container.innerHTML = `
                <div class="empty-box">
                    <div>📭</div>
                    <h3>
                        لا توجد طلبات
                    </h3>
                    <p>
                        لم يتم إرسال أي طلبات Creator حتى الآن.
                    </p>
                </div>
            `;

            return;
        }


        container.innerHTML =
            applications
                .map(
                    applicationCard
                )
                .join("");


        attachApplicationEvents();

    } catch (error) {

        console.error(error);

        container.innerHTML = `
            <div class="error-box">
                حدث خطأ أثناء تحميل الطلبات.
            </div>
        `;

    }

}


// ========================================
// APPLICATION CARD
// ========================================

function applicationCard(application) {

    const profile =
        application.profiles || {};


    const displayName =
        profile.display_name ||
        profile.username ||
        "مستخدم";


    const username =
        profile.username ||
        "user";


    const date =
        new Date(
            application.created_at
        ).toLocaleDateString(
            "ar-EG"
        );


    let statusHTML = "";


    if (application.status === "pending") {

        statusHTML = `
            <div class="application-actions">

                <button
                    class="approve-button"
                    data-id="${application.id}"
                    data-action="approve"
                >
                    ✓ قبول الطلب
                </button>

                <button
                    class="reject-button"
                    data-id="${application.id}"
                    data-action="reject"
                >
                    ✕ رفض
                </button>

            </div>
        `;

    } else if (
        application.status === "approved"
    ) {

        statusHTML = `
            <div class="status-approved">
                ✓ تم قبول الطلب
            </div>
        `;

    } else {

        statusHTML = `
            <div class="status-rejected">
                ✕ تم رفض الطلب
            </div>
        `;

    }


    return `

        <article class="application-card">

            <div class="application-top">

                <div class="app-user">

                    <div class="application-avatar">

                        ${
                            profile.avatar_url
                            ? `<img
                                src="${escapeHTML(
                                    profile.avatar_url
                                )}"
                                alt=""
                            >`
                            : escapeHTML(
                                displayName
                                    .charAt(0)
                                    .toUpperCase()
                            )
                        }

                    </div>

                    <div>

                        <h3>
                            ${escapeHTML(
                                displayName
                            )}
                        </h3>

                        <span>
                            @${escapeHTML(
                                username
                            )}
                        </span>

                    </div>

                </div>


                <span class="application-status ${application.status}">
                    ${getStatusText(
                        application.status
                    )}
                </span>

            </div>


            <div class="application-details">

                <div class="application-detail">

                    <span>
                        نوع المحتوى
                    </span>

                    <strong>
                        ${getContentType(
                            application.content_type
                        )}
                    </strong>

                </div>


                <div class="application-detail">

                    <span>
                        تاريخ التقديم
                    </span>

                    <strong>
                        ${date}
                    </strong>

                </div>

            </div>


            <div class="application-description">

                <span>
                    وصف المحتوى
                </span>

                <p>
                    ${escapeHTML(
                        application.description
                    )}
                </p>

            </div>


            ${
                application.social_link
                ? `
                    <a
                        class="social-link"
                        href="${escapeHTML(
                            application.social_link
                        )}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        🔗 فتح الرابط
                    </a>
                `
                : ""
            }


            ${statusHTML}

        </article>

    `;

}


// ========================================
// EVENTS
// ========================================

function attachApplicationEvents() {

    document
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const id =
                            Number(
                                button.dataset.id
                            );

                        const action =
                            button.dataset.action;


                        if (action === "approve") {

                            await reviewApplication(
                                id,
                                true
                            );

                        } else {

                            await reviewApplication(
                                id,
                                false
                            );

                        }

                    }
                );

            }
        );

}


// ========================================
// REVIEW
// ========================================

async function reviewApplication(
    applicationId,
    approve
) {

    const confirmation =
        approve
            ? "هل تريد قبول هذا الطلب وتحويل المستخدم إلى Creator؟"
            : "هل تريد رفض هذا الطلب؟";


    if (!confirm(confirmation))
        return;


    try {

        const {
            data,
            error
        } =
            await window.supabaseClient
                .rpc(
                    "review_creator_application",
                    {
                        application_id:
                            applicationId,

                        approve:
                            approve
                    }
                );


        if (error)
            throw error;


        console.log(data);


        await loadApplications();


        alert(
            approve
                ? "تم قبول الطلب وتحويل المستخدم إلى Creator ✅"
                : "تم رفض الطلب."
        );


    } catch (error) {

        console.error(error);

        alert(
            "حدث خطأ: " +
            error.message
        );

    }

}


// ========================================
// STATS
// ========================================

function updateStats(applications) {

    const pending =
        applications.filter(
            app =>
                app.status === "pending"
        ).length;


    const approved =
        applications.filter(
            app =>
                app.status === "approved"
        ).length;


    const rejected =
        applications.filter(
            app =>
                app.status === "rejected"
        ).length;


    document.getElementById(
        "pendingCount"
    ).textContent = pending;


    document.getElementById(
        "approvedCount"
    ).textContent = approved;


    document.getElementById(
        "rejectedCount"
    ).textContent = rejected;

}


// ========================================
// HELPERS
// ========================================

function getContentType(type) {

    const types = {

        gaming: "🎮 Gaming",

        just_chatting:
            "💬 Just Chatting",

        education:
            "📚 تعليم",

        other:
            "⭐ محتوى آخر"

    };


    return types[type] || type;

}


function getStatusText(status) {

    if (status === "pending")
        return "قيد المراجعة";

    if (status === "approved")
        return "مقبول";

    if (status === "rejected")
        return "مرفوض";

    return status;

}


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


// ========================================
// LOGOUT
// ========================================

async function logoutAdmin() {

    await window.supabaseClient
        .auth
        .signOut();

    window.location.href =
        "./index.html";

}
