from __future__ import annotations

import os
import sqlite3
from functools import wraps
from pathlib import Path

from flask import Flask, g, jsonify, render_template, request, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
DATABASE = BASE_DIR / "watch_store.db"

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "watch-store-dev-secret")


PRODUCT_SEED = [
    {
        "name": "Rajwadi Chronograph",
        "brand": "Titan",
        "category": "Luxury",
        "price": 18999.0,
        "image": "https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=900&q=80",
        "description": "A polished steel chronograph built for refined festive and formal looks.",
    },
    {
        "name": "Noor Rose",
        "brand": "Fastrack",
        "category": "Women",
        "price": 7999.0,
        "image": "https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?auto=format&fit=crop&w=900&q=80",
        "description": "Rose-gold detailing and a slim dial for an elegant everyday Indian style.",
    },
    {
        "name": "Goa Diver",
        "brand": "Sonata",
        "category": "Sport",
        "price": 11999.0,
        "image": "https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=900&q=80",
        "description": "A rugged diver-inspired watch with luminous markers and bold weekend energy.",
    },
    {
        "name": "Kohinoor Automatic",
        "brand": "Titan",
        "category": "Luxury",
        "price": 19999.0,
        "image": "https://images.unsplash.com/photo-1434056886845-dac89ffe9b56?auto=format&fit=crop&w=900&q=80",
        "description": "Automatic movement, matte black dial, and a refined leather strap for premium dressing.",
    },
    {
        "name": "Monsoon Field",
        "brand": "Maxima",
        "category": "Casual",
        "price": 3999.0,
        "image": "https://images.unsplash.com/photo-1508057198894-247b23fe5ade?auto=format&fit=crop&w=900&q=80",
        "description": "A reliable field watch with crisp numerals and a durable strap for daily wear.",
    },
    {
        "name": "Metro Digital",
        "brand": "boAt",
        "category": "Smart",
        "price": 6499.0,
        "image": "https://images.unsplash.com/photo-1434493907317-a46b5bbe7834?auto=format&fit=crop&w=900&q=80",
        "description": "A hybrid digital watch for fitness tracking and clean urban styling.",
    },
    {
        "name": "Darbar Classic",
        "brand": "HMT",
        "category": "Formal",
        "price": 9499.0,
        "image": "https://images.unsplash.com/photo-1490367532201-b9bc1dc483f6?auto=format&fit=crop&w=900&q=80",
        "description": "Minimal dial design with timeless proportions for office-ready wear.",
    },
    {
        "name": "Delhi Edge Carbon",
        "brand": "Fire-Boltt",
        "category": "Sport",
        "price": 13999.0,
        "image": "https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=900&q=80",
        "description": "Carbon-texture dial and performance strap for a fast, athletic feel.",
    },
]


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_: object | None) -> None:
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()
    cursor.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            contact_number TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            brand TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL,
            image TEXT NOT NULL,
            description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            total REAL NOT NULL,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY(order_id) REFERENCES orders(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        );
        """
    )

    existing_products = cursor.execute(
        "SELECT name, brand, category, price, image, description FROM products ORDER BY id"
    ).fetchall()
    existing_product_data = [
        {
            "name": row[0],
            "brand": row[1],
            "category": row[2],
            "price": row[3],
            "image": row[4],
            "description": row[5],
        }
        for row in existing_products
    ]

    if existing_product_data != PRODUCT_SEED:
        cursor.execute("DELETE FROM order_items")
        cursor.execute("DELETE FROM orders")
        cursor.execute("DELETE FROM products")
        cursor.executemany(
            """
            INSERT INTO products (name, brand, category, price, image, description)
            VALUES (:name, :brand, :category, :price, :image, :description)
            """,
            PRODUCT_SEED,
        )

    user_columns = [row[1] for row in cursor.execute("PRAGMA table_info(users)").fetchall()]
    if "address" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN address TEXT NOT NULL DEFAULT ''")
    if "contact_number" not in user_columns:
        cursor.execute("ALTER TABLE users ADD COLUMN contact_number TEXT NOT NULL DEFAULT ''")

    db.commit()
    db.close()


def login_required(view):
    @wraps(view)
    def wrapped_view(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Please log in to continue."}), 401
        return view(*args, **kwargs)

    return wrapped_view


def get_cart() -> dict[str, int]:
    cart = session.get("cart", {})
    if not isinstance(cart, dict):
        return {}
    return cart


def build_cart_payload() -> dict[str, object]:
    cart = get_cart()
    if not cart:
        return {"items": [], "subtotal": 0, "itemCount": 0}

    product_ids = [int(product_id) for product_id in cart.keys()]
    placeholders = ",".join("?" for _ in product_ids)
    rows = get_db().execute(
        f"SELECT * FROM products WHERE id IN ({placeholders})", product_ids
    ).fetchall()

    products_by_id = {str(row["id"]): row for row in rows}
    items = []
    subtotal = 0.0
    item_count = 0

    for product_id, quantity in cart.items():
        row = products_by_id.get(product_id)
        if row is None:
            continue

        qty = max(1, int(quantity))
        line_total = row["price"] * qty
        subtotal += line_total
        item_count += qty
        items.append(
            {
                "id": row["id"],
                "name": row["name"],
                "brand": row["brand"],
                "price": row["price"],
                "image": row["image"],
                "quantity": qty,
                "lineTotal": round(line_total, 2),
            }
        )

    return {
        "items": items,
        "subtotal": round(subtotal, 2),
        "itemCount": item_count,
    }


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/products")
def get_products():
    search = request.args.get("search", "").strip().lower()
    category = request.args.get("category", "").strip().lower()
    brand = request.args.get("brand", "").strip().lower()
    sort = request.args.get("sort", "").strip().lower()

    rows = get_db().execute("SELECT * FROM products").fetchall()
    products = []

    for row in rows:
        product = dict(row)
        haystack = f"{product['name']} {product['brand']} {product['category']} {product['description']}".lower()
        if search and search not in haystack:
            continue
        if category and product["category"].lower() != category:
            continue
        if brand and product["brand"].lower() != brand:
            continue
        products.append(product)

    if sort == "price_asc":
        products.sort(key=lambda item: item["price"])
    elif sort == "price_desc":
        products.sort(key=lambda item: item["price"], reverse=True)
    else:
        products.sort(key=lambda item: item["id"])

    categories = sorted({row["category"] for row in rows})
    brands = sorted({row["brand"] for row in rows})
    return jsonify({"products": products, "categories": categories, "brands": brands})


@app.post("/api/register")
def register():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    address = payload.get("address", "").strip()
    contact_number = payload.get("contact_number", "").strip()

    if not name or not email or not password or not address or not contact_number:
        return jsonify({"error": "Name, email, password, address, and contact number are required."}), 400

    db = get_db()
    try:
        cursor = db.execute(
            """
            INSERT INTO users (name, email, password_hash, address, contact_number)
            VALUES (?, ?, ?, ?, ?)
            """,
            (name, email, generate_password_hash(password), address, contact_number),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify({"error": "An account with that email already exists."}), 409

    session["user_id"] = cursor.lastrowid
    session["user_name"] = name
    session.setdefault("cart", {})
    return jsonify(
        {
            "message": "Account created successfully.",
            "user": {"name": name, "email": email, "address": address, "contact_number": contact_number},
        }
    )


@app.post("/api/login")
def login():
    payload = request.get_json(silent=True) or {}
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")

    user = get_db().execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["name"]
    session.setdefault("cart", {})
    return jsonify(
        {"message": "Logged in successfully.", "user": {"name": user["name"], "email": user["email"]}}
    )


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."})


@app.get("/api/session")
def current_session():
    is_authenticated = "user_id" in session
    return jsonify(
        {
            "authenticated": is_authenticated,
            "user": {"name": session.get("user_name")} if is_authenticated else None,
        }
    )


@app.get("/api/cart")
def get_cart_data():
    return jsonify(build_cart_payload())


@app.post("/api/cart")
def add_to_cart():
    payload = request.get_json(silent=True) or {}
    product_id = str(payload.get("productId", "")).strip()
    quantity = int(payload.get("quantity", 1))

    product = get_db().execute("SELECT id FROM products WHERE id = ?", (product_id,)).fetchone()
    if product is None:
        return jsonify({"error": "Product not found."}), 404

    cart = get_cart()
    cart[product_id] = cart.get(product_id, 0) + max(1, quantity)
    session["cart"] = cart
    session.modified = True
    return jsonify({"message": "Item added to cart.", **build_cart_payload()})


@app.patch("/api/cart/<int:product_id>")
def update_cart_item(product_id: int):
    payload = request.get_json(silent=True) or {}
    quantity = int(payload.get("quantity", 1))
    cart = get_cart()
    key = str(product_id)

    if key not in cart:
        return jsonify({"error": "Item is not in your cart."}), 404

    if quantity <= 0:
        cart.pop(key, None)
    else:
        cart[key] = quantity

    session["cart"] = cart
    session.modified = True
    return jsonify({"message": "Cart updated.", **build_cart_payload()})


@app.delete("/api/cart/<int:product_id>")
def remove_cart_item(product_id: int):
    cart = get_cart()
    cart.pop(str(product_id), None)
    session["cart"] = cart
    session.modified = True
    return jsonify({"message": "Item removed from cart.", **build_cart_payload()})


@app.post("/api/checkout")
@login_required
def checkout():
    cart_payload = build_cart_payload()
    if not cart_payload["items"]:
        return jsonify({"error": "Your cart is empty."}), 400

    db = get_db()
    cursor = db.execute(
        "INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)",
        (session["user_id"], cart_payload["subtotal"], "Paid"),
    )
    order_id = cursor.lastrowid
    for item in cart_payload["items"]:
        db.execute(
            """
            INSERT INTO order_items (order_id, product_id, quantity, price)
            VALUES (?, ?, ?, ?)
            """,
            (order_id, item["id"], item["quantity"], item["price"]),
        )

    db.commit()
    session["cart"] = {}
    session.modified = True
    return jsonify(
        {
            "message": "Order placed successfully.",
            "orderId": order_id,
            "status": "Order placed",
        }
    )


@app.get("/api/orders")
@login_required
def get_orders():
    rows = get_db().execute(
        """
        SELECT
            o.id AS order_id,
            o.total,
            o.status,
            o.created_at,
            p.name,
            p.brand,
            p.image,
            oi.quantity,
            oi.price
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON p.id = oi.product_id
        WHERE o.user_id = ?
        ORDER BY o.created_at DESC, o.id DESC, oi.id DESC
        """,
        (session["user_id"],),
    ).fetchall()

    orders_by_id: dict[int, dict[str, object]] = {}
    for row in rows:
        order_id = row["order_id"]
        if order_id not in orders_by_id:
            orders_by_id[order_id] = {
                "id": order_id,
                "total": row["total"],
                "status": row["status"],
                "createdAt": row["created_at"],
                "items": [],
            }

        orders_by_id[order_id]["items"].append(
            {
                "name": row["name"],
                "brand": row["brand"],
                "image": row["image"],
                "quantity": row["quantity"],
                "price": row["price"],
            }
        )

    return jsonify({"orders": list(orders_by_id.values())})


init_db()


if __name__ == "__main__":
    app.run(debug=True)
