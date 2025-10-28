// /js/admin.js

import { menuItems, saveMenuItems, resetDailyStock } from './data.js';
// Assuming renderMenuItems is exposed globally by main.js
const refreshMenuPage = () => {
    if (window.renderMenuItems) {
        window.renderMenuItems();
    }
};

// --- Admin Login ---

const login = () => {
    const user = document.getElementById("username")?.value;
    const pass = document.getElementById("password")?.value;
    
    if (user === "admin" && pass === "canteen123") {
        localStorage.setItem("isAdmin", true);
        window.location.reload(); // Reloads admin.html to show panel
    } else {
        alert("Invalid credentials. Try Username: admin, Password: canteen123");
    }
};

const logout = () => {
    localStorage.removeItem("isAdmin");
    window.location.reload();
};

const checkAuth = () => {
    const isAdmin = localStorage.getItem("isAdmin") === "true";
    const loginForm = document.getElementById('admin-login-form');
    const adminPanel = document.getElementById('admin-panel-content');

    if (loginForm && adminPanel) {
        if (isAdmin) {
            loginForm.style.display = 'none';
            adminPanel.style.display = 'block';
            renderAdminTable();
        } else {
            loginForm.style.display = 'block';
            adminPanel.style.display = 'none';
        }
    }
};

// --- Admin Table Rendering ---

const renderAdminTable = () => {
    const tableBody = document.getElementById('menu-admin-body');
    if (!tableBody) return;

    tableBody.innerHTML = menuItems.map(item => {
        const availableStatus = item.stock > 0 ? 'Available' : 'Out of Stock';
        return `
            <tr data-id="${item.id}">
                <td class="align-middle">${item.id}</td>
                <td class="align-middle">
                    <input type="text" class="form-control item-name" value="${item.name}">
                </td>
                <td class="align-middle">
                    <input type="text" class="form-control item-category" value="${item.category}">
                </td>
                <td class="align-middle">
                    <input type="number" step="0.01" class="form-control item-price" value="${item.price.toFixed(2)}">
                </td>
                <td class="align-middle">
                    <input type="number" class="form-control item-stock" value="${item.stock}" min="0">
                </td>
                <td class="align-middle">
                    <span class="badge ${item.stock > 0 ? 'bg-success' : 'bg-danger'}">${availableStatus}</span>
                </td>
                <td class="align-middle">
                    <button class="btn btn-sm btn-danger delete-item-btn" onclick="window.deleteItem(${item.id})">Delete</button>
                </td>
            </tr>
        `;
    }).join('');
};

// --- Admin CRUD Operations ---

const saveChanges = () => {
    const rows = document.querySelectorAll('#menu-admin-body tr');
    let updatedItems = [];

    rows.forEach(row => {
        const id = parseInt(row.getAttribute('data-id'));
        const name = row.querySelector('.item-name').value.trim();
        const category = row.querySelector('.item-category').value.trim();
        const price = parseFloat(row.querySelector('.item-price').value);
        const stock = parseInt(row.querySelector('.item-stock').value);

        const newItem = {
            id: id,
            name: name,
            category: category,
            price: isNaN(price) ? 0 : price,
            stock: isNaN(stock) || stock < 0 ? 0 : stock,
            available: stock > 0,
            // Keep existing image if it was an existing item
            image: menuItems.find(item => item.id === id)?.image || 'images/default.jpg'
        };
        updatedItems.push(newItem);
    });

    // Update the global menuItems array and save
    menuItems.length = 0; // Clear the original array
    menuItems.push(...updatedItems);
    saveMenuItems();

    // Re-render the admin table and refresh the menu page
    renderAdminTable();
    refreshMenuPage();
    alert("Menu changes saved successfully!");
};

const addItem = () => {
    // Simple way to ensure unique ID
    const newId = Math.max(...menuItems.map(item => item.id), 0) + 1;
    const newItem = {
        id: newId,
        name: "New Item",
        category: "Other",
        price: 0.00,
        stock: 5,
        available: true,
        image: "images/default.jpg" // Placeholder image
    };
    menuItems.push(newItem);
    saveMenuItems();
    renderAdminTable();
};

const deleteItem = (itemId) => {
    if (confirm(`Are you sure you want to delete item ID: ${itemId}?`)) {
        const index = menuItems.findIndex(item => item.id === itemId);
        if (index > -1) {
            menuItems.splice(index, 1);
            saveMenuItems();
            renderAdminTable();
            refreshMenuPage();
        }
    }
};

// --- Event Listeners and Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();

    if (document.getElementById('login-btn')) {
        document.getElementById('login-btn').addEventListener('click', login);
    }
    if (document.getElementById('logout-btn')) {
        document.getElementById('logout-btn').addEventListener('click', logout);
    }
    if (document.getElementById('save-changes-btn')) {
        document.getElementById('save-changes-btn').addEventListener('click', saveChanges);
    }
    if (document.getElementById('add-item-btn')) {
        document.getElementById('add-item-btn').addEventListener('click', addItem);
    }
    if (document.getElementById('reset-stock-btn')) {
        document.getElementById('reset-stock-btn').addEventListener('click', resetDailyStock);
    }
});

// Expose functions globally
window.login = login;
window.logout = logout;
window.deleteItem = deleteItem;
window.saveChanges = saveChanges;
window.addItem = addItem;
window.resetDailyStock = resetDailyStock;
