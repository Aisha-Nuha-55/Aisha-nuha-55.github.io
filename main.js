// /js/main.js

import { menuItems, saveMenuItems } from './data.js';

// --- Utility Functions ---

/** Gets the current cart data from localStorage. */
const getCart = () => JSON.parse(localStorage.getItem("cart")) || [];

/** Saves the cart data to localStorage. */
const saveCart = (cart) => localStorage.setItem("cart", JSON.stringify(cart));

/** Updates the cart counter in the navigation bar. */
const updateCartCounter = () => {
    const cart = getCart();
    const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
    const counterElement = document.getElementById('cart-counter');
    if (counterElement) {
        counterElement.textContent = totalItems;
        counterElement.style.display = totalItems > 0 ? 'inline-block' : 'none';
    }
};

// --- Cart Logic (menu.html and cart.html) ---

/** Adds an item to the cart or increases its quantity. */
const addToCart = (itemId) => {
    const item = menuItems.find(i => i.id === itemId);
    if (!item || item.stock <= 0) return;

    let cart = getCart();
    const existingItem = cart.find(i => i.id === itemId);

    if (existingItem) {
        if (existingItem.quantity < item.stock) {
            existingItem.quantity += 1;
        } else {
            alert(`Maximum stock for ${item.name} reached!`);
            return;
        }
    } else {
        cart.push({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 1,
            image: item.image
        });
    }

    saveCart(cart);
    updateCartCounter();
    // Simple toast notification simulation
    alert(`${item.name} added to cart!`);
    // Decrement stock in menuItems array and save
    item.stock -= 1;
    saveMenuItems();
    // Re-render menu/cart to reflect new stock/quantity
    if (window.location.pathname.includes('menu.html')) renderMenuItems();
    if (window.location.pathname.includes('cart.html')) renderCartItems();
};

/** Handles quantity changes in the cart. */
const updateCartQuantity = (itemId, change) => {
    let cart = getCart();
    const itemIndex = cart.findIndex(i => i.id === itemId);

    if (itemIndex > -1) {
        const itemInCart = cart[itemIndex];
        const menuItem = menuItems.find(i => i.id === itemId);

        // Update the item's stock in the menuItems array
        menuItem.stock -= change;
        saveMenuItems(); // Save updated stock

        itemInCart.quantity += change;

        // Remove item if quantity drops to 0 or less
        if (itemInCart.quantity <= 0) {
            cart.splice(itemIndex, 1);
        } else if (itemInCart.quantity > menuItem.stock + itemInCart.quantity - change) { // Prevent exceeding initial stock before change
            alert(`Maximum stock for ${itemInCart.name} reached!`);
            // Revert the stock change if the action was blocked
            menuItem.stock += change; 
            saveMenuItems();
            return;
        }

        saveCart(cart);
        updateCartCounter();
        renderCartItems(); // Re-render cart page
    }
};

/** Clears the entire cart and restores stock. */
const clearCart = () => {
    if (confirm("Are you sure you want to clear your cart?")) {
        let cart = getCart();
        cart.forEach(cartItem => {
            const menuItem = menuItems.find(i => i.id === cartItem.id);
            if (menuItem) {
                // Return stock to menuItems
                menuItem.stock += cartItem.quantity;
            }
        });

        saveMenuItems(); // Save updated stock
        localStorage.removeItem("cart");
        updateCartCounter();
        renderCartItems();
        if (window.location.pathname.includes('menu.html')) renderMenuItems();
    }
};

/** Simulates the checkout process. */
const checkout = () => {
    if (getCart().length === 0) {
        alert("Your cart is empty. Please add items to checkout.");
        return;
    }
    // Note: Stock decrement already happened in addToCart/updateCartQuantity
    localStorage.removeItem("cart");
    updateCartCounter();
    renderCartItems();
    alert("Order successful! Your food will be ready shortly.");
    // Optionally redirect back to menu
    // setTimeout(() => window.location.href = "menu.html", 2000);
};

// --- Menu Page Rendering (menu.html) ---

/** Renders menu items based on current filters. */
const renderMenuItems = () => {
    const menuContainer = document.getElementById('menu-items-container');
    if (!menuContainer) return;

    const searchTerm = document.getElementById('search-bar')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('category-filter')?.value || 'All';

    // Apply filters
    const filteredItems = menuItems.filter(item => {
        const matchesName = item.name.toLowerCase().includes(searchTerm);
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        return matchesName && matchesCategory;
    });

    menuContainer.innerHTML = filteredItems.map(item => {
        const isAvailable = item.available && item.stock > 0;
        const buttonText = isAvailable ? 'Add to Cart' : 'Out of Stock';
        const availabilityClass = isAvailable ? 'text-success' : 'text-danger';
        const availabilityIcon = isAvailable ? '&#x2705;' : '&#x274C;';

        return `
            <div class="col-lg-4 col-md-6 mb-4">
                <div class="card h-100 shadow-sm border-0 menu-card">
                    <img src="${item.image}" class="card-img-top item-image" alt="${item.name}">
                    <div class="card-body d-flex flex-column">
                        <h5 class="card-title fw-bold">${item.name}</h5>
                        <p class="card-text text-muted small mb-1">${item.category}</p>
                        <p class="card-text fs-4 fw-bolder text-primary">\$${item.price.toFixed(2)}</p>
                        <p class="card-text ${availabilityClass} small">
                            ${availabilityIcon} ${item.stock > 0 ? item.stock + ' in stock' : 'Out of Stock'}
                        </p>
                        <button class="btn btn-warning mt-auto add-to-cart-btn" 
                                ${isAvailable ? '' : 'disabled'}
                                onclick="window.addToCart(${item.id})">
                            ${buttonText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
};

// --- Cart Page Rendering (cart.html) ---

/** Renders items in the shopping cart. */
const renderCartItems = () => {
    const cartContainer = document.getElementById('cart-items-container');
    const cartTotalElement = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');

    if (!cartContainer || !cartTotalElement) return;

    let cart = getCart();
    let total = 0;

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p class="text-center p-5">Your cart is empty. Start ordering from the <a href="menu.html">Menu</a>!</p>';
        cartTotalElement.textContent = '$0.00';
        checkoutBtn.disabled = true;
        return;
    }

    cartContainer.innerHTML = cart.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;

        return `
            <li class="list-group-item d-flex justify-content-between align-items-center cart-item-list p-3 mb-2 rounded shadow-sm">
                <div class="d-flex align-items-center">
                    <img src="${item.image}" alt="${item.name}" class="cart-item-image me-3 rounded">
                    <div>
                        <h6 class="mb-0 fw-bold">${item.name}</h6>
                        <small class="text-muted">\$${item.price.toFixed(2)} ea.</small>
                    </div>
                </div>
                <div class="d-flex align-items-center">
                    <div class="input-group quantity-control me-3" style="width: 120px;">
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.updateCartQuantity(${item.id}, -1)">-</button>
                        <input type="text" class="form-control form-control-sm text-center" value="${item.quantity}" readonly>
                        <button class="btn btn-sm btn-outline-secondary" onclick="window.updateCartQuantity(${item.id}, 1)">+</button>
                    </div>
                    <span class="fw-bold me-3" style="min-width: 60px;">\$${subtotal.toFixed(2)}</span>
                    <button class="btn btn-sm btn-outline-danger" onclick="window.updateCartQuantity(${item.id}, -${item.quantity})">
                        <i class="bi bi-trash"></i> Remove
                    </button>
                </div>
            </li>
        `;
    }).join('');

    cartTotalElement.textContent = `$${total.toFixed(2)}`;
    checkoutBtn.disabled = false;
};

// --- Event Listeners and Initialization ---

window.onload = () => {
    updateCartCounter();

    // Attach event listeners for menu page
    if (window.location.pathname.includes('menu.html')) {
        renderMenuItems();
        document.getElementById('search-bar').addEventListener('input', renderMenuItems);
        document.getElementById('category-filter').addEventListener('change', renderMenuItems);
    }

    // Attach event listeners for cart page
    if (window.location.pathname.includes('cart.html')) {
        renderCartItems();
        document.getElementById('checkout-btn').addEventListener('click', checkout);
        document.getElementById('clear-cart-btn').addEventListener('click', clearCart);
    }
};

// Expose functions to the global scope for use in HTML onclick attributes
window.addToCart = addToCart;
window.updateCartQuantity = updateCartQuantity;
window.clearCart = clearCart;
window.checkout = checkout;
window.renderMenuItems = renderMenuItems; // For admin.js to trigger a refresh

// Function to populate category filter dropdown
document.addEventListener('DOMContentLoaded', () => {
    const filter = document.getElementById('category-filter');
    if (filter) {
        const categories = [...new Set(menuItems.map(item => item.category))];
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            filter.appendChild(option);
        });
    }
});
