const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    message.textContent = "جاري تسجيل الدخول...";

    try {

        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

        if (error) {
            throw error;
        }

        message.textContent =
            "تم تسجيل الدخول بنجاح!";

        setTimeout(() => {
            window.location.href = "index.html";
        }, 1000);

    } catch (error) {

        console.error(error);

        message.textContent =
            "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }
});
