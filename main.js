// /js/main.js

// ... (existing imports and utility functions) ...

// --- User/Student Login Logic ---

const STUDENT_USER = { username: "student", password: "user123" };

/** Handles the Student Login process. */
const studentLogin = () => {
    const user = document.getElementById("student-username")?.value;
    const pass = document.getElementById("student-password")?.value;
    
    if (user === STUDENT_USER.username && pass === STUDENT_USER.password) {
        localStorage.setItem("isStudent", true);
        localStorage.setItem("currentUser", user); // Save current user
        window.location.href = "profile.html";
    } else {
        alert("Invalid student credentials. Try Username: student, Password: user123");
    }
};

/** Handles Student Logout. */
const studentLogout = () => {
    localStorage.removeItem("isStudent");
    localStorage.removeItem("currentUser");
    window.location.href = "index.html";
};

// --- Initial Setup and Global Exposure ---

window.onload = () => {
    updateCartCounter();

    // Attach event listeners for menu page
    if (window.location.pathname.includes('menu.html')) {
        renderMenuItems();
        document.getElementById('search-bar')?.addEventListener('input', renderMenuItems);
        document.getElementById('category-filter')?.addEventListener('change', renderMenuItems);
    }

    // Attach event listeners for cart page
    if (window.location.pathname.includes('cart.html')) {
        renderCartItems();
        document.getElementById('checkout-btn')?.addEventListener('click', checkout);
        document.getElementById('clear-cart-btn')?.addEventListener('click', clearCart);
    }
};

// Expose functions globally for HTML
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.clearCart = clearCart;
window.checkout = checkout;
window.renderMenuItems = renderMenuItems; 
window.studentLogin = studentLogin; // NEW
window.studentLogout = studentLogout; // NEW

// ... (existing Category Filter function) ...
