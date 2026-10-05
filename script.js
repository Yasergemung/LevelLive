function openLogin() {
    alert("صفحة تسجيل الدخول سنبنيها في الخطوة القادمة.");
}

function openRegister() {
    alert("صفحة إنشاء الحساب سنبنيها في الخطوة القادمة.");
}

function openCreatorApplication() {
    alert("طلب الانضمام كصانع محتوى سنبنيه في الخطوة القادمة.");
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
