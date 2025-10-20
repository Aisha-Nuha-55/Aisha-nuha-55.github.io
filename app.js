// Import all the database functions we exported from firebase-config.js
import { 
    db, 
    collection, 
    doc, 
    getDocs, 
    onSnapshot, 
    runTransaction,
    writeBatch,
    query,
    where,
    Timestamp,
    getDoc
} from './firebase-config.js';

// --- APPLICATION STATE ---
// A central object to hold our app's data
const state = {
    currentUser: null, // { type: 'student', grNumber: '12345' } or { type: 'staff' }
    items: [],         // The master list of all menu items
    cart: {},          // { itemId: 1, itemId2: 3 }
    isOrderingWindowActive: false,
    orderingStartTime: { hour: 7, minute: 25 },
    orderingEndTime: { hour: 12, minute: 45 },
    unsubscribers: [], // To store our real-time listeners so we can stop them
    settings: {},      // To store system settings from Firebase
};

// --- DOM ELEMENTS ---
// A helper to get the main #app container
const $app = document.getElementById('app');

// --- HELPER FUNCTIONS ---
/**
 * A simple "hash" router to navigate between views
 */
function router() {
    const hash = window.location.hash || '#/';
    
    // Stop all previous real-time listeners to prevent memory leaks
    state.unsubscribers.forEach(unsub => unsub());
    state.unsubscribers = [];

    if (hash === '#/menu' && state.currentUser?.type === 'student') {
        renderStudentMenu();
    } else if (hash === '#/staff' && state.currentUser?.type === 'staff') {
        renderStaffDashboard();
    } else {
        window.location.hash = '#/';
        renderLoginPage();
    }
}

/**
 * Renders any HTML string into the main #app container
 * @param {string} html - The HTML template to render
 */
function render(html) {
    $app.innerHTML = html;
}

/**
 * Gets a formatted time string (e.g., "07:30")
 * @param {Date} date - The date object to format
 */
function getFormattedTime(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Checks if the current time is within the ordering window
 */
function checkOrderingWindow() {
    const now = new Date();
    const startTime = new Date();
    startTime.setHours(state.orderingStartTime.hour, state.orderingStartTime.minute, 0, 0);
    
    const endTime = new Date();
    endTime.setHours(state.orderingEndTime.hour, state.orderingEndTime.minute, 0, 0);

    state.isOrderingWindowActive = (now >= startTime && now <= endTime);
}

/**
 * Calculates total items and price for the cart
 * @returns {object} { totalItems: number, totalPrice: number }
 */
function getCartTotals() {
    let totalItems = 0;
    let totalPrice = 0;
    
    for (const itemId in state.cart) {
        const quantity = state.cart[itemId];
        const item = state.items.find(i => i.id === itemId);
        if (item) {
            totalItems += quantity;
            totalPrice += item.price * quantity;
        }
    }
    return { totalItems, totalPrice };
}

// --- LOGIN PAGE ---
function renderLoginPage() {
    const html = `
        <div class="container login-container">
            <h2>Smart Canteen</h2>
            <div id="error-message" class="error-message hidden"></div>
            
            <div class="login-toggle">
                <button id="student-tab" class="active">Student</button>
                <button id="staff-tab">Staff</button>
            </div>

            <form id="student-login-form">
                <div class="form-group">
                    <label for="gr-number">GR Number</label>
                    <input type="tel" id="gr-number" placeholder="Enter your 3-6 digit GR Number" required>
                </div>
                <button type="submit" class="btn btn-primary">Login / View Menu</button>
            </form>

            <form id="staff-login-form" class="hidden">
                <div class="form-group">
                    <label for="staff-password">Password</label>
                    <input type="password" id="staff-password" placeholder="Enter staff password" required>
                </div>
                <button type="submit" class="btn btn-primary">Login to Dashboard</button>
            </form>
        </div>
    `;
    render(html);
    addLoginListeners();
}

function addLoginListeners() {
    const $studentTab = document.getElementById('student-tab');
    const $staffTab = document.getElementById('staff-tab');
    const $studentForm = document.getElementById('student-login-form');
    const $staffForm = document.getElementById('staff-login-form');

    $studentTab.addEventListener('click', () => {
        $studentTab.classList.add('active');
        $staffTab.classList.remove('active');
        $studentForm.classList.remove('hidden');
        $staffForm.classList.add('hidden');
    });

    $staffTab.addEventListener('click', () => {
        $staffTab.classList.add('active');
        $studentTab.classList.remove('active');
        $staffForm.classList.remove('hidden');
        $studentForm.classList.add('hidden');
    });

    $studentForm.addEventListener('submit', handleStudentLogin);
    $staffForm.addEventListener('submit', handleStaffLogin);
}

async function handleStudentLogin(e) {
    e.preventDefault();
    const grNumber = document.getElementById('gr-number').value;
    const $errorMessage = document.getElementById('error-message');

    if (!/^\d{3,6}$/.test(grNumber)) {
        $errorMessage.textContent = 'Invalid GR Number. Must be 3-6 digits.';
        $errorMessage.classList.remove('hidden');
        return;
    }

    state.currentUser = { type: 'student', grNumber: grNumber };
    window.location.hash = '#/menu';
}

function handleStaffLogin(e) {
    e.preventDefault();
    const password = document.getElementById('staff-password').value;
    const $errorMessage = document.getElementById('error-message');
    
    if (password === 'staff123') {
        state.currentUser = { type: 'staff' };
        window.location.hash = '#/staff';
    } else {
        $errorMessage.textContent = 'Incorrect password.';
        $errorMessage.classList.remove('hidden');
    }
}

// --- STUDENT MENU PAGE ---
function renderStudentMenu() {
    checkOrderingWindow(); 
    const windowMessage = state.isOrderingWindowActive 
        ? `<span class="timer">ORDERING OPEN</span>`
        : `Ordering: ${getFormattedTime(new Date(0,0,0,state.orderingStartTime.hour, state.orderingStartTime.minute))} - ${getFormattedTime(new Date(0,0,0,state.orderingEndTime.hour, state.orderingEndTime.minute))}`;

    const html = `
        <header class="header">
            <div class="header-info">
                <span>GR: <strong>${state.currentUser.grNumber}</strong></span>
            </div>
            <div class="header-info">
                ${windowMessage}
                <button id="logout-btn" class="btn btn-secondary" style="width:auto; margin-left: 1rem; padding: 0.5rem 1rem;">Logout</button>
            </div>
        </header>

        <main class="menu-container">
            <div id="menu-grid" class="menu-grid">
                <div class="loading-spinner"></div>
            </div>
        </main>

        <footer id="cart-footer" class="cart-footer hidden"></footer>

        <div id="confirmation-modal" class="modal-overlay hidden"></div>
    `;
    render(html);

    // <<< FIX: Load menu items AFTER HTML render >>>
    loadMenuItems();

    document.getElementById('logout-btn').addEventListener('click', () => {
        state.currentUser = null;
        window.location.hash = '#/';
    });

    listenToItems();
}

function loadMenuItems() {
    const unsub = onSnapshot(collection(db, 'items'), (snapshot) => {
        state.items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderMenuGrid();
    });
    state.unsubscribers.push(unsub);
}

// --- Rest of your functions remain 100% unchanged ---
// renderMenuGrid, addMenuGridListeners, addToCart, removeFromCart, 
// updateCartState, updateCartFooter, showConfirmationModal, handlePlaceOrder, 
// showOrderSuccess, showOrderError, renderStaffDashboard, addStaffDashboardListeners, 
// renderOverview, listenToOrdersForStats, renderStockManagement, listenToItemsForStaff, 
// handleStockToggle, renderLiveOrders, listenToLiveOrders, renderSystemControls, 
// handleSystemReset remain exactly as in your original code.

// --- APP INITIALIZATION ---
function init() {
    window.addEventListener('hashchange', router);
    checkOrderingWindow();
    router();
}

init();

// --- START APP ---
window.addEventListener('hashchange', router);
window.addEventListener('load', router);
