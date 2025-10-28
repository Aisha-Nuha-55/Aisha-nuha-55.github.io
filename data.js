// /js/data.js

// Default menu items
const defaultItems = [
    { id: 1, name: "Premium Coffee", category: "Beverage", price: 3.00, stock: 30, available: true, image: "images/coffee.jpg" },
    { id: 2, name: "Veggie Sandwich", category: "Snack", price: 5.00, stock: 10, available: true, image: "images/sandwich.jpg" },
    { id: 3, name: "Chocolate Donut", category: "Dessert", price: 4.00, stock: 0, available: false, image: "images/donut.jpg" },
    { id: 4, name: "Fresh Orange Juice", category: "Beverage", price: 4.50, stock: 15, available: true, image: "images/juice.jpg" },
    { id: 5, name: "Chicken Burger", category: "Meal", price: 8.00, stock: 5, available: true, image: "images/burger.jpg" },
    { id: 6, name: "Apple Pie Slice", category: "Dessert", price: 3.50, stock: 8, available: true, image: "images/pie.jpg" }
];

// Load data from LocalStorage or use defaults
let menuItems = JSON.parse(localStorage.getItem("menuData")) || defaultItems;

// Save data to LocalStorage
const saveMenuItems = () => {
    // Before saving, ensure availability status is correct
    menuItems = menuItems.map(item => ({
        ...item,
        available: item.stock > 0
    }));
    localStorage.setItem("menuData", JSON.stringify(menuItems));
};

// Initial save if using defaults for the first time
if (!localStorage.getItem("menuData")) {
    saveMenuItems();
}

// Function to reset stock to initial values
const resetDailyStock = () => {
    menuItems = defaultItems.map(item => ({
        ...item,
        // Reset only stock and re-calculate availability
        stock: defaultItems.find(d => d.id === item.id).stock,
        available: defaultItems.find(d => d.id === item.id).stock > 0
    }));
    saveMenuItems();
    // Reload the page to reflect changes immediately
    window.location.reload();
};

export { menuItems, saveMenuItems, resetDailyStock, defaultItems };
