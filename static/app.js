const state = {
  authMode: "login",
  authenticated: false,
  products: [],
  filters: {
    search: "",
    category: "",
    brand: "",
    sort: "",
  },
};

const productGrid = document.getElementById("product-grid");
const categoryFilter = document.getElementById("category-filter");
const brandFilter = document.getElementById("brand-filter");
const sortFilter = document.getElementById("sort-filter");
const searchInput = document.getElementById("search-input");
const cartDrawer = document.getElementById("cart-drawer");
const cartItems = document.getElementById("cart-items");
const cartSubtotal = document.getElementById("cart-subtotal");
const cartCount = document.getElementById("cart-count");
const overlay = document.getElementById("overlay");
const authModal = document.getElementById("auth-modal");
const successModal = document.getElementById("success-modal");
const authOpenButton = document.getElementById("auth-open-button");
const logoutButton = document.getElementById("logout-button");
const ordersToggle = document.getElementById("orders-toggle");
const ordersPanel = document.getElementById("orders-panel");
const ordersList = document.getElementById("orders-list");
const ordersClose = document.getElementById("orders-close");
const authCloseButton = document.getElementById("auth-close");
const successCloseButton = document.getElementById("success-close");
const successOkButton = document.getElementById("success-ok");
const authForm = document.getElementById("auth-form");
const authMessage = document.getElementById("auth-message");
const authSubmit = document.getElementById("auth-submit");
const nameField = document.getElementById("name-field");
const addressField = document.getElementById("address-field");
const contactField = document.getElementById("contact-field");
const welcomeMessage = document.getElementById("welcome-message");
const orderMessage = document.getElementById("order-message");
const successMessage = document.getElementById("success-message");

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
}

function currency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function openOverlay() {
  overlay.classList.remove("hidden");
}

function closeOverlayIfUnused() {
  const cartOpen = cartDrawer.classList.contains("open");
  const modalOpen = !authModal.classList.contains("hidden");
  const successOpen = !successModal.classList.contains("hidden");
  if (!cartOpen && !modalOpen && !successOpen) {
    overlay.classList.add("hidden");
  }
}

function openCart() {
  cartDrawer.classList.add("open");
  openOverlay();
}

function closeCart() {
  cartDrawer.classList.remove("open");
  closeOverlayIfUnused();
}

function openAuthModal() {
  authModal.classList.remove("hidden");
  openOverlay();
}

function closeAuthModal() {
  authModal.classList.add("hidden");
  authMessage.textContent = "";
  closeOverlayIfUnused();
}

function openSuccessModal(message) {
  successMessage.textContent = message;
  successModal.classList.remove("hidden");
  openOverlay();
}

function closeSuccessModal() {
  successModal.classList.add("hidden");
  closeOverlayIfUnused();
}

function closeOrdersPanel() {
  ordersPanel.classList.add("hidden");
}

function openOrdersPanel() {
  ordersPanel.classList.remove("hidden");
  ordersPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setAuthMode(mode) {
  state.authMode = mode;
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === mode);
  });
  nameField.classList.toggle("hidden", mode !== "register");
  addressField.classList.toggle("hidden", mode !== "register");
  contactField.classList.toggle("hidden", mode !== "register");
  authSubmit.textContent = mode === "login" ? "Login" : "Create Account";
  authMessage.textContent = "";
}

function renderFilters(categories, brands) {
  categoryFilter.innerHTML = '<option value="">All categories</option>';
  categories.forEach((category) => {
    categoryFilter.insertAdjacentHTML(
      "beforeend",
      `<option value="${category}">${category}</option>`
    );
  });

  brandFilter.innerHTML = '<option value="">All brands</option>';
  brands.forEach((brand) => {
    brandFilter.insertAdjacentHTML("beforeend", `<option value="${brand}">${brand}</option>`);
  });

  categoryFilter.value = state.filters.category;
  brandFilter.value = state.filters.brand;
  sortFilter.value = state.filters.sort;
}

function renderProducts(products) {
  if (!products.length) {
    productGrid.innerHTML = `
      <div class="empty-state">
        <h3>No watches matched your search.</h3>
        <p>Try a different brand, category, or search term.</p>
      </div>
    `;
    return;
  }

  productGrid.innerHTML = products
    .map(
      (product, index) => `
        <article class="product-card" style="animation-delay:${index * 60}ms">
          <img src="${product.image}" alt="${product.name}" />
          <div class="product-info">
            <span class="pill">${product.category}</span>
            <div>
              <h3>${product.name}</h3>
              <p>${product.brand}</p>
            </div>
            <p>${product.description}</p>
            <div class="price-row">
              <span class="price">${currency(product.price)}</span>
              <button class="primary-button add-to-cart" data-id="${product.id}">Add to cart</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

async function loadProducts() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  const data = await requestJSON(`/api/products?${params.toString()}`);
  state.products = data.products;
  renderFilters(data.categories, data.brands);
  renderProducts(data.products);
}

function renderCart(cart) {
  cartCount.textContent = cart.itemCount;
  cartSubtotal.textContent = currency(cart.subtotal);

  if (!cart.items.length) {
    cartItems.innerHTML = `
      <div class="empty-state">
        <h3>Your cart is empty.</h3>
        <p>Add a watch to start your order.</p>
      </div>
    `;
    return;
  }

  cartItems.innerHTML = cart.items
    .map(
      (item) => `
        <article class="cart-item">
          <img src="${item.image}" alt="${item.name}" />
          <div class="cart-item-body">
            <div class="cart-line-top">
              <div>
                <strong>${item.name}</strong>
                <p>${item.brand}</p>
              </div>
              <span>${currency(item.lineTotal)}</span>
            </div>
            <div class="cart-line-controls">
              <div class="quantity-control">
                <button data-action="decrease" data-id="${item.id}">-</button>
                <span>${item.quantity}</span>
                <button data-action="increase" data-id="${item.id}">+</button>
              </div>
              <button class="text-button" data-action="remove" data-id="${item.id}">Remove</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderOrders(orders) {
  if (!orders.length) {
    ordersList.innerHTML = `
      <div class="empty-state">
        <h3>No orders yet.</h3>
        <p>Your placed orders will appear here.</p>
      </div>
    `;
    return;
  }

  ordersList.innerHTML = orders
    .map(
      (order) => `
        <article class="order-card">
          <div class="order-top">
            <div>
              <strong>Order #${order.id}</strong>
              <p>${new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}</p>
            </div>
            <div class="order-summary">
              <span>${order.status}</span>
              <strong>${currency(order.total)}</strong>
            </div>
          </div>
          <div class="order-items">
            ${order.items
              .map(
                (item) => `
                  <div class="order-item">
                    <img src="${item.image}" alt="${item.name}" />
                    <div>
                      <strong>${item.name}</strong>
                      <p>${item.brand}</p>
                      <p>Qty: ${item.quantity} · ${currency(item.price)}</p>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");
}

async function loadCart() {
  const cart = await requestJSON("/api/cart");
  renderCart(cart);
}

async function loadOrders() {
  ordersList.innerHTML = `
    <div class="empty-state">
      <h3>Loading orders...</h3>
      <p>Please wait while we fetch your order history.</p>
    </div>
  `;
  openOrdersPanel();

  try {
    const data = await requestJSON("/api/orders");
    renderOrders(data.orders);
    openOrdersPanel();
  } catch (error) {
    ordersList.innerHTML = `
      <div class="empty-state">
        <h3>Could not load orders.</h3>
        <p>${error.message}</p>
      </div>
    `;
    openOrdersPanel();
  }
}

async function refreshSession() {
  const sessionData = await requestJSON("/api/session");
  if (sessionData.authenticated) {
    state.authenticated = true;
    authOpenButton.textContent = `Hi, ${sessionData.user.name}`;
    logoutButton.classList.remove("hidden");
    ordersToggle.classList.remove("hidden");
    welcomeMessage.textContent = `Welcome back, ${sessionData.user.name}. Ready for your next Indian timepiece?`;
  } else {
    state.authenticated = false;
    authOpenButton.textContent = "Login / Sign Up";
    logoutButton.classList.add("hidden");
    ordersToggle.classList.add("hidden");
    closeOrdersPanel();
    welcomeMessage.textContent = "Browse our newest Indian arrivals.";
  }
}

async function handleAddToCart(productId) {
  const cart = await requestJSON("/api/cart", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  renderCart(cart);
  openCart();
}

async function updateCart(productId, nextQuantity) {
  const cart = await requestJSON(`/api/cart/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ quantity: nextQuantity }),
  });
  renderCart(cart);
}

async function removeCartItem(productId) {
  const cart = await requestJSON(`/api/cart/${productId}`, { method: "DELETE" });
  renderCart(cart);
}

async function handleCheckout() {
  try {
    const result = await requestJSON("/api/checkout", { method: "POST", body: JSON.stringify({}) });
    orderMessage.textContent = `${result.status}. Your order id is #${result.orderId}.`;
    orderMessage.classList.remove("hidden");
    closeCart();
    await loadCart();
    if (state.authenticated) {
      await loadOrders();
    }
    openSuccessModal(
      `Your order has been placed successfully and will be delivered soon. Your order id is #${result.orderId}.`
    );
  } catch (error) {
    orderMessage.textContent = error.message;
    orderMessage.classList.remove("hidden");
    if (error.message.includes("log in")) {
      openAuthModal();
    }
  }
}

document.getElementById("cart-toggle").addEventListener("click", openCart);
document.getElementById("cart-close").addEventListener("click", closeCart);
document.getElementById("checkout-button").addEventListener("click", handleCheckout);
authOpenButton.addEventListener("click", () => {
  if (!state.authenticated) {
    openAuthModal();
  }
});
logoutButton.addEventListener("click", async () => {
  await requestJSON("/api/logout", { method: "POST", body: JSON.stringify({}) });
  orderMessage.classList.add("hidden");
  await refreshSession();
  await loadCart();
  ordersList.innerHTML = "";
});
ordersToggle.addEventListener("click", async () => {
  if (ordersPanel.classList.contains("hidden")) {
    await loadOrders();
  } else {
    closeOrdersPanel();
  }
});
ordersClose.addEventListener("click", closeOrdersPanel);
authCloseButton.addEventListener("click", closeAuthModal);
successCloseButton.addEventListener("click", closeSuccessModal);
successOkButton.addEventListener("click", closeSuccessModal);
overlay.addEventListener("click", () => {
  closeCart();
  closeAuthModal();
  closeSuccessModal();
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.mode));
});

searchInput.addEventListener("input", async (event) => {
  state.filters.search = event.target.value.trim();
  await loadProducts();
});

categoryFilter.addEventListener("change", async (event) => {
  state.filters.category = event.target.value;
  await loadProducts();
});

brandFilter.addEventListener("change", async (event) => {
  state.filters.brand = event.target.value;
  await loadProducts();
});

sortFilter.addEventListener("change", async (event) => {
  state.filters.sort = event.target.value;
  await loadProducts();
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(authForm);
  const payload = Object.fromEntries(formData.entries());
  const endpoint = state.authMode === "login" ? "/api/login" : "/api/register";

  try {
    const result = await requestJSON(endpoint, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    authMessage.textContent = result.message;
    await refreshSession();
    if (state.authenticated) {
      await loadOrders();
    }
    setTimeout(() => {
      closeAuthModal();
      authForm.reset();
    }, 500);
  } catch (error) {
    authMessage.textContent = error.message;
  }
});

productGrid.addEventListener("click", async (event) => {
  const button = event.target.closest(".add-to-cart");
  if (!button) {
    return;
  }
  await handleAddToCart(button.dataset.id);
});

cartItems.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) {
    return;
  }

  const productId = Number(actionButton.dataset.id);
  const item = [...cartItems.querySelectorAll(".cart-item")].find((node) =>
    node.querySelector(`[data-id="${productId}"]`)
  );
  const quantityText = item?.querySelector(".quantity-control span")?.textContent || "1";
  const currentQuantity = Number(quantityText);

  if (actionButton.dataset.action === "increase") {
    await updateCart(productId, currentQuantity + 1);
  } else if (actionButton.dataset.action === "decrease") {
    await updateCart(productId, currentQuantity - 1);
  } else if (actionButton.dataset.action === "remove") {
    await removeCartItem(productId);
  }
});

async function init() {
  setAuthMode("login");
  await Promise.all([loadProducts(), loadCart(), refreshSession()]);
}

init().catch((error) => {
  welcomeMessage.textContent = error.message;
});
