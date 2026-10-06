const form =
    document.getElementById("creatorApplicationForm");

const message =
    document.getElementById("applicationMessage");


form.addEventListener("submit", async (event) => {

    event.preventDefault();

    const contentType =
        document.getElementById("contentType").value;

    const description =
        document.getElementById("description").value.trim();

    const socialLink =
        document.getElementById("socialLink").value.trim();


    message.textContent =
        "جاري إرسال الطلب...";


    try {

        // =========================
        // التأكد من تسجيل الدخول
        // =========================

        const {
            data: { session },
            error: sessionError
        } =
            await window.supabaseClient.auth.getSession();


        if (sessionError)
            throw sessionError;


        if (!session) {

            message.textContent =
                "يجب تسجيل الدخول أولاً.";

            setTimeout(() => {
                window.location.href =
                    "./login.html";
            }, 1200);

            return;
        }


        // =========================
        // التأكد أن المستخدم ليس Creator
        // =========================

        const {
            data: profile,
            error: profileError
        } =
            await window.supabaseClient
                .from("profiles")
                .select("role, creator_approved")
                .eq("id", session.user.id)
                .single();


        if (profileError)
            throw profileError;


        if (
            profile?.role === "creator" ||
            profile?.role === "admin" ||
            profile?.creator_approved === true
        ) {

            message.textContent =
                "حسابك لديه صلاحية Creator بالفعل.";

            return;
        }


        // =========================
        // التأكد من عدم وجود طلب Pending
        // =========================

        const {
            data: existingApplication,
            error: existingError
        } =
            await window.supabaseClient
                .from("creator_applications")
                .select("id, status")
                .eq("user_id", session.user.id)
                .eq("status", "pending")
                .maybeSingle();


        if (existingError)
            throw existingError;


        if (existingApplication) {

            message.textContent =
                "لديك طلب قيد المراجعة بالفعل.";

            return;
        }


        // =========================
        // إرسال الطلب
        // =========================

        const {
            error: insertError
        } =
            await window.supabaseClient
                .from("creator_applications")
                .insert({

                    user_id: session.user.id,

                    content_type:
                        contentType,

                    description:
                        description,

                    social_link:
                        socialLink || null,

                    status:
                        "pending"

                });


        if (insertError)
            throw insertError;


        message.textContent =
            "تم إرسال طلبك بنجاح! 🎉 سيتم مراجعته من الإدارة.";


        form.reset();


    } catch (error) {

        console.error(error);

        message.textContent =
            "حدث خطأ أثناء إرسال الطلب: " +
            error.message;

    }

});
