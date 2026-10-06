```javascript
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
```
