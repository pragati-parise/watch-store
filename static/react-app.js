import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);

const initialFilters = {
  search: "",
  category: "",
  brand: "",
  sort: "",
};

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

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function App() {
  const [filters, setFilters] = useState(initialFilters);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [cart, setCart] = useState({ items: [], subtotal: 0, itemCount: 0 });
  const [session, setSession] = useState({ authenticated: false, user: null });
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    address: "",
    contact_number: "",
    email: "",
    password: "",
  });
  const [authMessage, setAuthMessage] = useState("");
  const [orderMessage, setOrderMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);

  const overlayOpen = drawerOpen || authOpen || successOpen;

  async function loadProducts(nextFilters = filters) {
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const data = await requestJSON(`/api/products?${params.toString()}`);
    setProducts(data.products);
    setCategories(data.categories);
    setBrands(data.brands);
  }

  async function loadCart() {
    const data = await requestJSON("/api/cart");
    setCart(data);
  }

  async function loadSession() {
    const data = await requestJSON("/api/session");
    setSession(data);
  }

  async function loadOrders({ openPanel = false } = {}) {
    setLoadingOrders(true);
    try {
      const data = await requestJSON("/api/orders");
      setOrders(data.orders);
      if (openPanel) {
        setOrdersOpen(true);
      }
    } finally {
      setLoadingOrders(false);
    }
  }

  useEffect(() => {
    Promise.all([loadProducts(initialFilters), loadCart(), loadSession()]).catch((error) => {
      setOrderMessage(error.message);
    });
  }, []);

  useEffect(() => {
    if (session.authenticated) {
      loadOrders().catch(() => {
        setOrders([]);
      });
    } else {
      setOrders([]);
      setOrdersOpen(false);
    }
  }, [session.authenticated]);

  const welcomeMessage = useMemo(() => {
    if (session.authenticated && session.user?.name) {
      return `Welcome back, ${session.user.name}. Ready for your next Indian timepiece?`;
    }
    return "Browse our newest Indian arrivals.";
  }, [session]);

  function updateFilter(key, value) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    loadProducts(nextFilters).catch((error) => setOrderMessage(error.message));
  }

  function updateAuthField(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({ ...current, [name]: value }));
  }

  async function submitAuth(event) {
    event.preventDefault();
    const endpoint = authMode === "login" ? "/api/login" : "/api/register";

    try {
      const result = await requestJSON(endpoint, {
        method: "POST",
        body: JSON.stringify(authForm),
      });
      setAuthMessage(result.message);
      await loadSession();
      setTimeout(() => {
        setAuthOpen(false);
        setAuthMessage("");
        setAuthForm({
          name: "",
          address: "",
          contact_number: "",
          email: "",
          password: "",
        });
      }, 400);
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function logout() {
    await requestJSON("/api/logout", { method: "POST", body: JSON.stringify({}) });
    setSuccessOpen(false);
    setAuthOpen(false);
    setOrderMessage("");
    await Promise.all([loadSession(), loadCart()]);
  }

  async function addToCart(productId) {
    const data = await requestJSON("/api/cart", {
      method: "POST",
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    setCart(data);
    setDrawerOpen(true);
  }

  async function updateCart(productId, quantity) {
    const data = await requestJSON(`/api/cart/${productId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity }),
    });
    setCart(data);
  }

  async function removeCartItem(productId) {
    const data = await requestJSON(`/api/cart/${productId}`, {
      method: "DELETE",
    });
    setCart(data);
  }

  async function checkout() {
    try {
      const result = await requestJSON("/api/checkout", {
        method: "POST",
        body: JSON.stringify({}),
      });
      setOrderMessage(`${result.status}. Your order id is #${result.orderId}.`);
      setSuccessMessage(
        `Your order has been placed successfully and will be delivered soon. Your order id is #${result.orderId}.`
      );
      setDrawerOpen(false);
      setSuccessOpen(true);
      await loadCart();
      if (session.authenticated) {
        await loadOrders({ openPanel: true });
      }
    } catch (error) {
      setOrderMessage(error.message);
      if (error.message.toLowerCase().includes("log in")) {
        setAuthMode("login");
        setAuthOpen(true);
      }
    }
  }

  return html`
    <div className="page-shell">
      <header className="hero">
        <nav className="topbar">
          <div>
            <p className="eyebrow">Indian watch commerce</p>
            <h1>Samay Sutra</h1>
          </div>
          <div className="topbar-actions">
            <button
              className="ghost-button"
              type="button"
              onClick=${() => {
                if (!session.authenticated) {
                  setAuthMode("login");
                  setAuthOpen(true);
                }
              }}
            >
              ${session.authenticated ? `Hi, ${session.user?.name ?? ""}` : "Login / Sign Up"}
            </button>
            <button
              className=${`ghost-button ${session.authenticated ? "" : "hidden"}`}
              type="button"
              onClick=${logout}
            >
              Logout
            </button>
            <button
              className=${`ghost-button ${session.authenticated ? "" : "hidden"}`}
              type="button"
              onClick=${() => {
                setOrdersOpen((open) => !open);
                if (!ordersOpen) {
                  loadOrders({ openPanel: true }).catch((error) => setOrderMessage(error.message));
                }
              }}
            >
              My Orders
            </button>
            <button className="cart-button" type="button" onClick=${() => setDrawerOpen(true)}>
              Cart <span>${cart.itemCount}</span>
            </button>
          </div>
        </nav>

        <section className="hero-content">
          <div className="hero-copy">
            <p className="hero-kicker">Har pal, behtar style</p>
            <h2>Discover standout Indian watch styles built for everyday elegance.</h2>
            <p>
              Browse premium timepieces, search by style, filter by category, and complete your
              order in a clean React shopping experience.
            </p>
            <a href="#catalogue" className="primary-link">Shop the collection</a>
          </div>
          <div className="hero-card">
            <span>Featured pick</span>
            <strong>Kohinoor Automatic</strong>
            <p>Automatic movement, matte black dial, refined leather finish.</p>
            <div className="hero-price">Rs. 19,999</div>
          </div>
        </section>
      </header>

      <main>
        <section className="toolbar" id="catalogue">
          <div className="toolbar-block search-block">
            <label htmlFor="search-input">Search watches</label>
            <input
              id="search-input"
              type="search"
              placeholder="Try Titan, sport, luxury..."
              value=${filters.search}
              onInput=${(event) => updateFilter("search", event.target.value.trim())}
            />
          </div>
          <div className="toolbar-block">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value=${filters.category}
              onChange=${(event) => updateFilter("category", event.target.value)}
            >
              <option value="">All categories</option>
              ${categories.map((category) => html`<option value=${category}>${category}</option>`)}
            </select>
          </div>
          <div className="toolbar-block">
            <label htmlFor="brand-filter">Brand</label>
            <select
              id="brand-filter"
              value=${filters.brand}
              onChange=${(event) => updateFilter("brand", event.target.value)}
            >
              <option value="">All brands</option>
              ${brands.map((brand) => html`<option value=${brand}>${brand}</option>`)}
            </select>
          </div>
          <div className="toolbar-block">
            <label htmlFor="sort-filter">Sort by</label>
            <select
              id="sort-filter"
              value=${filters.sort}
              onChange=${(event) => updateFilter("sort", event.target.value)}
            >
              <option value="">Newest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </section>

        <section className="status-strip">
          <p>${welcomeMessage}</p>
          <p className=${`order-message ${orderMessage ? "" : "hidden"}`}>${orderMessage}</p>
        </section>

        <section className="product-grid">
          ${products.length
            ? products.map(
                (product, index) => html`
                  <article className="product-card" style=${{ animationDelay: `${index * 60}ms` }}>
                    <img src=${product.image} alt=${product.name} />
                    <div className="product-info">
                      <span className="pill">${product.category}</span>
                      <div>
                        <h3>${product.name}</h3>
                        <p>${product.brand}</p>
                      </div>
                      <p>${product.description}</p>
                      <div className="price-row">
                        <span className="price">${currency(product.price)}</span>
                        <button className="primary-button" type="button" onClick=${() => addToCart(product.id)}>
                          Add to cart
                        </button>
                      </div>
                    </div>
                  </article>
                `
              )
            : html`
                <div className="empty-state">
                  <h3>No watches matched your search.</h3>
                  <p>Try a different brand, category, or search term.</p>
                </div>
              `}
        </section>

        ${ordersOpen
          ? html`
              <section className="orders-panel">
                <div className="orders-header">
                  <div>
                    <p className="orders-kicker">Account</p>
                    <h3>My Orders</h3>
                  </div>
                  <button className="text-button" type="button" onClick=${() => setOrdersOpen(false)}>
                    Hide
                  </button>
                </div>

                ${loadingOrders
                  ? html`
                      <div className="empty-state">
                        <h3>Loading orders...</h3>
                        <p>Please wait while we fetch your order history.</p>
                      </div>
                    `
                  : orders.length
                    ? orders.map(
                        (order) => html`
                          <article className="order-card">
                            <div className="order-top">
                              <div>
                                <strong>Order #${order.id}</strong>
                                <p>${formatDate(order.createdAt)}</p>
                              </div>
                              <div className="order-summary">
                                <span>${order.status}</span>
                                <strong>${currency(order.total)}</strong>
                              </div>
                            </div>
                            <div className="order-items">
                              ${order.items.map(
                                (item) => html`
                                  <div className="order-item">
                                    <img src=${item.image} alt=${item.name} />
                                    <div>
                                      <strong>${item.name}</strong>
                                      <p>${item.brand}</p>
                                      <p>Qty: ${item.quantity} | ${currency(item.price)}</p>
                                    </div>
                                  </div>
                                `
                              )}
                            </div>
                          </article>
                        `
                      )
                    : html`
                        <div className="empty-state">
                          <h3>No orders yet.</h3>
                          <p>Your placed orders will appear here.</p>
                        </div>
                      `}
              </section>
            `
          : null}
      </main>
    </div>

    <aside className=${`drawer ${drawerOpen ? "open" : ""}`}>
      <div className="drawer-header">
        <div>
          <p className="orders-kicker">Your bag</p>
          <h3>Shopping Cart</h3>
        </div>
        <button className="icon-button" type="button" onClick=${() => setDrawerOpen(false)}>x</button>
      </div>

      <div className="cart-items">
        ${cart.items.length
          ? cart.items.map(
              (item) => html`
                <article className="cart-item">
                  <img src=${item.image} alt=${item.name} />
                  <div className="cart-item-body">
                    <div className="cart-line-top">
                      <div>
                        <strong>${item.name}</strong>
                        <p>${item.brand}</p>
                      </div>
                      <span>${currency(item.lineTotal)}</span>
                    </div>
                    <div className="cart-line-controls">
                      <div className="quantity-control">
                        <button type="button" onClick=${() => updateCart(item.id, item.quantity - 1)}>-</button>
                        <span>${item.quantity}</span>
                        <button type="button" onClick=${() => updateCart(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <button className="text-button" type="button" onClick=${() => removeCartItem(item.id)}>
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              `
            )
          : html`
              <div className="empty-state">
                <h3>Your cart is empty.</h3>
                <p>Add a watch to start your order.</p>
              </div>
            `}
      </div>

      <div className="cart-footer">
        <div className="cart-total">
          <span>Subtotal</span>
          <strong>${currency(cart.subtotal)}</strong>
        </div>
        <button className="primary-button full-width" type="button" onClick=${checkout}>Pay Now</button>
      </div>
    </aside>

    <div
      className=${`overlay ${overlayOpen ? "" : "hidden"}`}
      onClick=${() => {
        setDrawerOpen(false);
        setAuthOpen(false);
        setSuccessOpen(false);
      }}
    ></div>

    <section className=${`modal ${authOpen ? "" : "hidden"}`}>
      <div className="modal-card">
        <button className="icon-button modal-close" type="button" onClick=${() => setAuthOpen(false)}>x</button>
        <p className="orders-kicker">Member access</p>
        <h3>Sign in or create an account</h3>

        <div className="auth-tabs">
          <button
            className=${`tab-button ${authMode === "login" ? "active" : ""}`}
            type="button"
            onClick=${() => setAuthMode("login")}
          >
            Login
          </button>
          <button
            className=${`tab-button ${authMode === "register" ? "active" : ""}`}
            type="button"
            onClick=${() => setAuthMode("register")}
          >
            Register
          </button>
        </div>

        <form onSubmit=${submitAuth}>
          ${authMode === "register"
            ? html`
                <div className="field">
                  <label htmlFor="auth-name">Name</label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    value=${authForm.name}
                    onInput=${updateAuthField}
                    placeholder="Your name"
                  />
                </div>
                <div className="field">
                  <label htmlFor="auth-address">Address</label>
                  <input
                    id="auth-address"
                    name="address"
                    type="text"
                    value=${authForm.address}
                    onInput=${updateAuthField}
                    placeholder="Full delivery address"
                  />
                </div>
                <div className="field">
                  <label htmlFor="auth-contact-number">Contact Number</label>
                  <input
                    id="auth-contact-number"
                    name="contact_number"
                    type="tel"
                    value=${authForm.contact_number}
                    onInput=${updateAuthField}
                    placeholder="10-digit mobile number"
                  />
                </div>
              `
            : null}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              name="email"
              type="email"
              value=${authForm.email}
              onInput=${updateAuthField}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              value=${authForm.password}
              onInput=${updateAuthField}
              placeholder="********"
              required
            />
          </div>
          <button className="primary-button full-width" type="submit">
            ${authMode === "login" ? "Login" : "Create Account"}
          </button>
          <p className="form-message">${authMessage}</p>
        </form>
      </div>
    </section>

    <section className=${`modal ${successOpen ? "" : "hidden"}`}>
      <div className="modal-card success-card">
        <button className="icon-button modal-close" type="button" onClick=${() => setSuccessOpen(false)}>x</button>
        <p className="orders-kicker success-eyebrow">Order confirmed</p>
        <h3>Order placed successfully</h3>
        <p>${successMessage}</p>
        <button className="primary-button full-width" type="button" onClick=${() => setSuccessOpen(false)}>
          Continue Shopping
        </button>
      </div>
    </section>
  `;
}

const root = createRoot(document.getElementById("root"));
root.render(html`<${App} />`);
