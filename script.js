function openLogin() {
    window.location.href = "login.html";
}

function openRegister() {
    window.location.href = "register.html";
}

function openCreatorApplication() {
    window.location.href = "creator-application.html";
}

function searchCreator() {
    const search = document
        .getElementById("searchInput")
        .value
        .trim();

    if (search === "") {
        alert("اكتب اسم صانع المحتوى.");
        return;
    }

    alert("البحث عن: " + search);
}
