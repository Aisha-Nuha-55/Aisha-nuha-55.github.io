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
    // Note: In a real app, you'd fetch these times from Firebase settings
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

/**
 * Renders the initial Login Page
 */
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

/**
 * Adds event listeners for the Login Page (tab switching, form submission)
 */
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

/**
 * Handles the student login attempt
 */
async function handleStudentLogin(e) {
    e.preventDefault();
    const grNumber = document.getElementById('gr-number').value;
    const $errorMessage = document.getElementById('error-message');

    // Validation: 3-6 digit number
    if (!/^\d{3,6}$/.test(grNumber)) {
        $errorMessage.textContent = 'Invalid GR Number. Must be 3-6 digits.';
        $errorMessage.classList.remove('hidden');
        return;
    }

    // Skip Firestore order check here, just login directly
    state.currentUser = { type: 'student', grNumber: grNumber };
    window.location.hash = '#/menu';
}

/**
 * Handles the staff login attempt
 */
function handleStaffLogin(e) {
    e.preventDefault();
    const password = document.getElementById('staff-password').value;
    const $errorMessage = document.getElementById('error-message');
    
    // TODO: This is NOT secure. In a real app, use Firebase Auth.
    // For this project spec, we use a simple hardcoded password.
    // We'll fetch this from settings later. For now, it's 'staff123'
    if (password === 'staff123') { // state.settings.staffPassword
        state.currentUser = { type: 'staff' };
        window.location.hash = '#/staff';
    } else {
        $errorMessage.textContent = 'Incorrect password.';
        $errorMessage.classList.remove('hidden');
    }
}


// --- STUDENT MENU PAGE ---

/**
 * Renders the main student menu page (header, grid, footer)
 */
function renderStudentMenu() {
    checkOrderingWindow(); // Update ordering window status
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

        <footer id="cart-footer" class="cart-footer hidden">
            </footer>

        <div id="confirmation-modal" class="modal-overlay hidden">
            </div>
    `;
    render(html);

    document.getElementById('logout-btn').addEventListener('click', () => {
        state.currentUser = null;
        window.location.hash = '#/';
    });

    // Start listening for real-time item/stock updates
    listenToItems();
}

/**
 * Listens for REAL-TIME updates to the 'items' collection in Firebase
 */
function listenToItems() {
    const itemsRef = collection(db, 'items');
    const unsub = onSnapshot(itemsRef, (snapshot) => {
        state.items = [];
        snapshot.forEach((doc) => {
            state.items.push({ id: doc.id, ...doc.data() });
        });
        
        // Re-render the grid with the new data
        renderMenuGrid();
        // Re-render the cart footer in case prices/items changed
        updateCartFooter();

    }, (error) => {
        console.error("Error listening to items: ", error);
        document.getElementById('menu-grid').innerHTML = `<p class="error-message">Error loading menu. Please refresh.</p>`;
    });
    
    // Store the unsubscriber function so we can stop it when we leave this page
    state.unsubscribers.push(unsub);
}

/**
 * Renders the grid of item cards
 */
function renderMenuGrid() {
    const $grid = document.getElementById('menu-grid');
    if (!state.items.length) {
        $grid.innerHTML = '<p>No items available in the menu right now.</p>';
        return;
    }

    $grid.innerHTML = state.items.map(item => {
        const remaining = item.totalLimit - item.currentOrdered;
        const isSoldOut = remaining <= 0;
        const isManuallySoldOut = item.manualSoldOut;
        const isDisabled = isSoldOut || isManuallySoldOut;
        
        let stockMessage = '';
        if (isManuallySoldOut) {
            stockMessage = 'Unavailable';
        } else if (isSoldOut) {
            stockMessage = 'Sold Out';
        } else if (remaining <= 10) {
            stockMessage = `<span class="low">${remaining} left!</span>`;
        } else {
            stockMessage = `${remaining} remaining`;
        }

        return `
            <div class="item-card ${isDisabled ? 'sold-out' : ''}">
                <img src="${item.imageUrl || 'https://via.placeholder.com/150'}" alt="${item.name}">
                <div class="item-card-body">
                    <h3>${item.name}</h3>
                    <p class="item-card-stock">${stockMessage}</p>
                    <p class="item-card-price">$${item.price.toFixed(2)}</p>
                    <div class="item-card-actions">
                        ${renderItemButton(item, isDisabled)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Add event listeners to all the new buttons
    addMenuGridListeners();
}

/**
 * Renders the correct button(s) for an item card (Add, +/-)
 */
function renderItemButton(item, isDisabled) {
    if (isDisabled) {
        return `<button class="btn btn-secondary" disabled>Sold Out</button>`;
    }

    const quantityInCart = state.cart[item.id] || 0;
    
    if (quantityInCart === 0) {
        return `<button class="btn btn-primary" data-id="${item.id}" data-action="add">Add</button>`;
    }

    return `
        <button class="btn btn-secondary" data-id="${item.id}" data-action="remove" style="width: 40px;">-</button>
        <span style="font-weight: 700;">${quantityInCart}</span>
        <button class="btn btn-primary" data-id="${item.id}" data-action="add" style="width: 40px;">+</button>
    `;
}

/**
 * Adds event listeners to all buttons on the menu grid
 */
function addMenuGridListeners() {
    const $grid = document.getElementById('menu-grid');
    $grid.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        const id = button.dataset.id;
        
        if (!id || !action) return;

        if (action === 'add') {
            addToCart(id);
        } else if (action === 'remove') {
            removeFromCart(id);
        }
    });
}

/**
 * Adds an item to the cart or increases its quantity
 */
function addToCart(itemId) {
    const item = state.items.find(i => i.id === itemId);
    const quantityInCart = state.cart[itemId] || 0;
    const remainingStock = item.totalLimit - item.currentOrdered;

    if (quantityInCart < remainingStock) {
        state.cart[itemId] = (state.cart[itemId] || 0) + 1;
        updateCartState();
    } else {
        alert("No more stock available for this item!");
    }
}

/**
 * Removes an item from the cart or decreases its quantity
 */
function removeFromCart(itemId) {
    if (state.cart[itemId] > 1) {
        state.cart[itemId] -= 1;
    } else {
        delete state.cart[itemId];
    }
    updateCartState();
}

/**
 * Called after any cart change to update the UI
 */
function updateCartState() {
    renderMenuGrid(); // Re-render grid to show new +/- buttons
    updateCartFooter(); // Re-render the footer
}

/**
 * Renders the bottom cart footer with totals and "Preview Order" button
 */
function updateCartFooter() {
    const $footer = document.getElementById('cart-footer');
    const { totalItems, totalPrice } = getCartTotals();

    if (totalItems === 0) {
        $footer.classList.add('hidden');
        return;
    }

    $footer.classList.remove('hidden');
    $footer.innerHTML = `
        <div class="cart-footer-info">
            ${totalItems} Items <span>$${totalPrice.toFixed(2)}</span>
        </div>
        <button id="preview-order-btn" class="btn btn-success">Preview Order</button>
    `;
    
    document.getElementById('preview-order-btn').addEventListener('click', showConfirmationModal);
}

/**
 * Shows the order confirmation modal
 */
function showConfirmationModal() {
    checkOrderingWindow(); // Final check before showing confirmation
    
    const $modal = document.getElementById('confirmation-modal');
    const { totalPrice } = getCartTotals();

    const cartItemsHtml = Object.keys(state.cart).map(itemId => {
        const item = state.items.find(i => i.id === itemId);
        const quantity = state.cart[itemId];
        return `
            <div class="modal-list-item">
                <span>${item.name} (x${quantity})</span>
                <strong>$${(item.price * quantity).toFixed(2)}</strong>
            </div>
        `;
    }).join('');

    const canOrder = state.isOrderingWindowActive;
    
    $modal.innerHTML = `
        <div class="modal-content">
            <h2>Confirm Your Order</h2>
            ${!canOrder ? `<p class="error-message">The ordering window is now closed. You can preview, but not place an order.</p>` : ''}
            
            <div class="modal-list">
                ${cartItemsHtml}
            </div>
            
            <p class="modal-total">
                Total: $${totalPrice.toFixed(2)}
            </p>
            
            <div class="modal-actions">
                <button id="cancel-modal-btn" class="btn btn-secondary">Cancel</button>
                <button id="confirm-order-btn" class="btn btn-success" ${!canOrder ? 'disabled' : ''}>
                    Place Order
                </button>
            </div>
        </div>
    `;

    $modal.classList.remove('hidden');
    
    $modal.querySelector('#cancel-modal-btn').addEventListener('click', () => $modal.classList.add('hidden'));
    $modal.querySelector('#confirm-order-btn').addEventListener('click', handlePlaceOrder);
}

/**
 * Handles the FINAL order submission.
 * This function is critical and uses a Firebase Transaction.
 */
async function handlePlaceOrder() {
    const $button = document.getElementById('confirm-order-btn');
    $button.textContent = 'Placing...';
    $button.disabled = true;

    const grNumber = state.currentUser.grNumber;
    const today = new Date().toISOString().split('T')[0];
    const orderId = `${today}_${grNumber}`;

    try {
        // A "Transaction" is an all-or-nothing operation.
        // This ensures that we read the stock and write the stock
        // without another user interfering. This solves the "race condition".
        await runTransaction(db, async (transaction) => {
            const itemsToUpdate = [];
            const itemsForOrder = [];

            // 1. Read all item stocks *within* the transaction
            for (const itemId in state.cart) {
                const quantity = state.cart[itemId];
                const itemRef = doc(db, 'items', itemId);
                const itemDoc = await transaction.get(itemRef);

                if (!itemDoc.exists()) {
                    throw new Error(`Item ${itemId} not found!`);
                }

                const item = itemDoc.data();
                const newOrderedCount = item.currentOrdered + quantity;

                if (newOrderedCount > item.totalLimit || item.manualSoldOut) {
                    throw new Error(`Sorry, ${item.name} just sold out!`);
                }

                itemsToUpdate.push({ ref: itemRef, newCount: newOrderedCount });
                itemsForOrder.push({
                    id: itemId,
                    name: item.name,
                    quantity: quantity,
                    price: item.price
                });
            }

            // 2. Write all stock updates
            itemsToUpdate.forEach(item => {
                transaction.update(item.ref, { currentOrdered: item.newCount });
            });

            // 3. Create the order document
            const orderDocRef = doc(db, 'orders', orderId);
            const { totalPrice } = getCartTotals();
            
            transaction.set(orderDocRef, {
                grNumber: grNumber,
                items: itemsForOrder,
                totalPrice: totalPrice,
                status: 'placed',
                createdAt: Timestamp.now()
            });
        });

        // If the transaction is successful:
        showOrderSuccess();

    } catch (error) {
        console.error("Transaction failed: ", error);
        showOrderError(error.message);
    }
}

/**
 * Shows a success message and resets the app state
 */
function showOrderSuccess() {
    const $modal = document.getElementById('confirmation-modal');
    $modal.innerHTML = `
        <div class="modal-content text-center">
            <h2 style="color: var(--success-color);">Order Placed!</h2>
            <p>Your order has been successfully submitted.</p>
            <p>GR Number: <strong>${state.currentUser.grNumber}</strong></p>
            <button id="order-ok-btn" class="btn btn-success mt-2">OK</button>
        </div>
    `;
    
    // Clear the cart
    state.cart = {};
    
    // Send user back to login page. They can't order again.
    $modal.querySelector('#order-ok-btn').addEventListener('click', () => {
        window.location.hash = '#/';
    });
}

/**
 * Shows an error message in the modal
 */
function showOrderError(message) {
    const $modal = document.getElementById('confirmation-modal');
    $modal.innerHTML = `
        <div class="modal-content text-center">
            <h2 style="color: var(--danger-color);">Order Failed</h2>
            <p>${message}</p>
            <p>Please adjust your cart and try again.</p>
            <button id="order-error-btn" class="btn btn-danger mt-2">Back to Cart</button>
        </div>
    `;
    $modal.querySelector('#order-error-btn').addEventListener('click', () => {
         $modal.classList.add('hidden');
         // Re-enable the original confirm button
         const $confirmBtn = document.getElementById('confirm-order-btn');
         if ($confirmBtn) {
             $confirmBtn.textContent = 'Place Order';
             $confirmBtn.disabled = false;
         }
    });
}


// --- STAFF DASHBOARD ---

/**
 * Renders the main Staff Dashboard shell
 */
function renderStaffDashboard() {
    const html = `
        <header class="header">
            <div class="header-info">
                <span><strong>Staff Dashboard</strong></span>
            </div>
            <button id="logout-btn" class="btn btn-secondary" style="width:auto; padding: 0.5rem 1rem;">Logout</button>
        </header>

        <nav class="staff-tabs">
            <button id="tab-overview" class="staff-tab active" data-content="overview-content">Overview</button>
            <button id="tab-stock" class="staff-tab" data-content="stock-content">Stock Management</button>
            <button id="tab-orders" class="staff-tab" data-content="orders-content">Live Orders</button>
            <button id="tab-system" class="staff-tab" data-content="system-content">System</button>
        </nav>

        <main class="staff-content">
            <div id="overview-content" class="tab-content">
                </div>
            <div id="stock-content" class="tab-content hidden">
                </div>
            <div id="orders-content" class="tab-content hidden">
                </div>
            <div id="system-content" class="tab-content hidden">
                </div>
        </main>
    `;
    render(html);
    addStaffDashboardListeners();
    renderOverview(); // Render the default tab
    renderStockManagement();
    renderLiveOrders();
    renderSystemControls();
}

/**
 * Adds listeners for tab switching and logout
 */
function addStaffDashboardListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        state.currentUser = null;
        window.location.hash = '#/';
    });

    const $tabs = document.querySelectorAll('.staff-tab');
    const $contents = document.querySelectorAll('.tab-content');

    $tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Deactivate all
            $tabs.forEach(t => t.classList.remove('active'));
            $contents.forEach(c => c.classList.add('hidden'));

            // Activate clicked
            tab.classList.add('active');
            document.getElementById(tab.dataset.content).classList.remove('hidden');
        });
    });
}

/**
 * Renders the Overview tab (Stats)
 */
function renderOverview() {
    const $content = document.getElementById('overview-content');
    $content.innerHTML = `
        <h2>Order Summary</h2>
        <div class="stats-grid">
            <div class="stat-card">
                <h3>Total Orders</h3>
                <p id="stat-total-orders">--</p>
            </div>
            <div class="stat-card">
                <h3>Total Revenue</h3>
                <p id="stat-total-revenue">$--.--</p>
            </div>
        </div>
        <h3>Top Selling Items</h3>
        <div id="stat-top-items">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    // Start listening to orders for stats
    listenToOrdersForStats();
}

/**
 * Listens to orders to calculate and display live stats
 */
function listenToOrdersForStats() {
    // Only get orders from today
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfToday = Timestamp.fromDate(today);

    const q = query(collection(db, 'orders'), where('createdAt', '>=', startOfToday));
    
    const unsub = onSnapshot(q, (snapshot) => {
        let totalOrders = 0;
        let totalRevenue = 0;
        const itemCounts = {};

        snapshot.forEach(doc => {
            const order = doc.data();
            totalOrders++;
            totalRevenue += order.totalPrice;
            
            order.items.forEach(item => {
                itemCounts[item.name] = (itemCounts[item.name] || 0) + item.quantity;
            });
        });

        // Update stats
        document.getElementById('stat-total-orders').textContent = totalOrders;
        document.getElementById('stat-total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;

        // Update top items
        const $topItems = document.getElementById('stat-top-items');
        const sortedItems = Object.entries(itemCounts).sort(([,a], [,b]) => b - a);

        if (sortedItems.length === 0) {
            $topItems.innerHTML = '<p>No orders yet today.</p>';
            return;
        }

        $topItems.innerHTML = `
            <table class="orders-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th>Quantity Sold</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedItems.map(([name, count]) => `
                        <tr>
                            <td>${name}</td>
                            <td>${count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

    }, (error) => {
        console.error("Error listening to orders:", error);
        document.getElementById('overview-content').innerHTML = `<p class="error-message">Error loading stats.</p>`;
    });

    state.unsubscribers.push(unsub);
}

/**
 * Renders the Stock Management tab
 */
function renderStockManagement() {
    const $content = document.getElementById('stock-content');
    $content.innerHTML = `
        <h2>Stock Management</h2>
        <table class="stock-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Stock (Sold / Total)</th>
                    <th>Manual Sold Out</th>
                </tr>
            </thead>
            <tbody id="stock-table-body">
                <div class="loading-spinner"></div>
            </tbody>
        </table>
    `;
    
    // Use the same listener as the student menu
    listenToItemsForStaff();
}

/**
 * Listens to item updates and renders the stock table
 */
function listenToItemsForStaff() {
    const itemsRef = collection(db, 'items');
    const unsub = onSnapshot(itemsRef, (snapshot) => {
        const $tbody = document.getElementById('stock-table-body');
        if (!$tbody) return; // Tab not active

        $tbody.innerHTML = ''; // Clear old data
        
        snapshot.forEach((doc) => {
            const item = { id: doc.id, ...doc.data() };
            const $tr = document.createElement('tr');
            $tr.innerHTML = `
                <td>${item.name}</td>
                <td>${item.currentOrdered} / ${item.totalLimit}</td>
                <td>
                    <label class="switch">
                        <input type="checkbox" class="stock-toggle" data-id="${item.id}" ${item.manualSoldOut ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </td>
            `;
            $tbody.appendChild($tr);
        });

        // Add listeners to new toggles
        document.querySelectorAll('.stock-toggle').forEach(toggle => {
            toggle.addEventListener('change', handleStockToggle);
        });

    }, (error) => {
        console.error("Error listening to items: ", error);
        document.getElementById('stock-table-body').innerHTML = `<tr><td colspan="3"><p class="error-message">Error loading stock.</p></td></tr>`;
    });

    state.unsubscribers.push(unsub);
}

/**
 * Handles the "Manual Sold Out" toggle switch
 */
async function handleStockToggle(e) {
    const itemId = e.target.dataset.id;
    const isSoldOut = e.target.checked;
    
    e.target.disabled = true; // Disable toggle during update
    
    const itemRef = doc(db, 'items', itemId);
    
    try {
        // This uses a "Batch" write, but for a single item.
        // You could also just use `updateDoc()`.
        const batch = writeBatch(db);
        batch.update(itemRef, { manualSoldOut: isSoldOut });
        await batch.commit();
    } catch (error) {
        console.error("Error toggling stock: ", error);
        alert("Error updating stock. Please try again.");
    } finally {
        // Re-enable (the listener will update its visual state)
        e.target.disabled = false;
    }
}

/**
 * Renders the Live Orders tab
 */
function renderLiveOrders() {
    const $content = document.getElementById('orders-content');
    $content.innerHTML = `
        <h2>Live Orders</h2>
        <p>Showing new orders for today. This list updates in real-time.</p>
        <table class="orders-table" style="margin-top: 1rem;">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>GR Number</th>
                    <th>Items</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody id="orders-table-body">
                </tbody>
        </table>
    `;
    
    listenToLiveOrders();
}

/**
 * Listens for new orders and PREPENDS them to the table
 */
function listenToLiveOrders() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const startOfToday = Timestamp.fromDate(today);

    const q = query(collection(db, 'orders'), where('createdAt', '>=', startOfToday));

    const unsub = onSnapshot(q, (snapshot) => {
        const $tbody = document.getElementById('orders-table-body');
        if (!$tbody) return;

        snapshot.docChanges().forEach((change) => {
            // Only add new orders to the top
            if (change.type === 'added') {
                const order = change.doc.data();
                const time = order.createdAt.toDate().toLocaleTimeString();
                
                const itemsList = order.items.map(i => `${i.name} (x${i.quantity})`).join(', ');

                const $tr = document.createElement('tr');
                $tr.innerHTML = `
                    <td>${time}</td>
                    <td>${order.grNumber}</td>
                    <td>${itemsList}</td>
                    <td>$${order.totalPrice.toFixed(2)}</td>
                `;
                
                // Prepend to show newest first
                $tbody.prepend($tr);
            }
        });

    }, (error) => {
        console.error("Error listening to live orders: ", error);
    });

    state.unsubscribers.push(unsub);
}

/**
 * Renders the System Controls tab
 */
function renderSystemControls() {
    const $content = document.getElementById('system-content');
    $content.innerHTML = `
        <h2>System Controls</h2>
        <p>Warning: These actions are permanent and affect all users.</p>
        <div class="system-controls mt-2">
            <button id="reset-system-btn" class="btn btn-danger">
                Perform End-of-Day Reset
            </button>
            <p style="margin-top: 0.5rem; color: var(--secondary-color);">
                This will delete all of today's orders and reset all item stock counts to 0.
            </p>
        </div>
    `;

    document.getElementById('reset-system-btn').addEventListener('click', handleSystemReset);
}

/**
 * Handles the End-of-Day system reset
 */
async function handleSystemReset() {
    const confirmed = prompt(
        'This will delete ALL orders and reset ALL stock. This cannot be undone.\n\nType "RESET" to confirm.'
    );

    if (confirmed !== 'RESET') {
        alert("Reset cancelled.");
        return;
    }

    const $button = document.getElementById('reset-system-btn');
    $button.textContent = 'Resetting...';
    $button.disabled = true;

    try {
        // 1. Reset all item stock
        const batch = writeBatch(db);
        const itemsRef = collection(db, 'items');
        const itemsSnapshot = await getDocs(itemsRef);
        
        itemsSnapshot.forEach(doc => {
            batch.update(doc.ref, { 
                currentOrdered: 0,
                manualSoldOut: false // Also reset manual toggles
            });
        });

        // 2. Delete all orders
        // Note: Deleting a collection this way is not recommended for large
        // collections. But for ~700 orders, it's fine.
        const ordersRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersRef);
        
        ordersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        // 3. Commit all changes at once
        await batch.commit();

        alert("System reset complete. All orders deleted and stock reset.");
        
        // Refresh the dashboard views
        renderOverview();
        renderStockManagement();
        renderLiveOrders();

    } catch (error) {
        console.error("Error during system reset: ", error);
        alert("An error occurred. System may be in a partial state. Check Firebase.");
    } finally {
        $button.textContent = 'Perform End-of-Day Reset';
        $button.disabled = false;
    }
}


// --- APP INITIALIZATION ---

/**
 * Main function to start the application
 */
function init() {
    // Add a listener for hash changes (e.g., back button)
    window.addEventListener('hashchange', router);
    
    // Check ordering window on load
    checkOrderingWindow();

    // Start the router to render the correct initial page
    router();
}

// Start the app!
init();
