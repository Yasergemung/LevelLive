const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const username = document
        .getElementById("username")
        .value
        .trim();

    const displayName = document
        .getElementById("displayName")
        .value
        .trim();

    const email = document
        .getElementById("email")
        .value
        .trim();

    const password = document
        .getElementById("password")
        .value;

    if (!username || !displayName || !email || !password) {
        message.textContent = "من فضلك املأ جميع البيانات.";
        return;
    }

    message.textContent = "جاري إنشاء الحساب...";

    try {

        // إنشاء حساب Supabase Auth
        const { data, error } =
            await supabaseClient.auth.signUp({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("لم يتم إنشاء الحساب.");
        }

        // إنشاء Profile للمستخدم
        const { error: profileError } =
            await supabaseClient
                .from("profiles")
                .insert({
                    id: data.user.id,
                    username: username,
                    display_name: displayName,
                    role: "viewer",
                    creator_approved: false
                });

        if (profileError) {
            throw profileError;
        }

        message.textContent =
            "تم إنشاء الحساب بنجاح! 🎉";

        registerForm.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1500);

    } catch (error) {

        console.error(error);

        message.textContent =
            "حدث خطأ: " + error.message;
    }

});
