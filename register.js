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

        const { data, error } =
            await supabaseClient.auth.signUp({
                email: email,
                password: password,

                options: {
                    data: {
                        username: username,
                        display_name: displayName
                    }
                }
            });

        if (error) {
            throw error;
        }

        if (!data.user) {
            throw new Error("لم يتم إنشاء المستخدم.");
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
