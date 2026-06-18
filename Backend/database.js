const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'shopnova.db');
const db = new Database(DB_PATH);

function initDatabase() {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT DEFAULT 'customer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            icon TEXT DEFAULT '📦'
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            original_price REAL,
            category_id INTEGER,
            image_url TEXT,
            stock INTEGER DEFAULT 0,
            rating REAL DEFAULT 4.5,
            reviews_count INTEGER DEFAULT 0,
            featured INTEGER DEFAULT 0,
            user_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES categories(id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            UNIQUE(user_id, product_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            subtotal REAL NOT NULL,
            shipping REAL DEFAULT 0,
            tax REAL DEFAULT 0,
            total REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            shipping_name TEXT,
            shipping_address TEXT,
            shipping_city TEXT,
            shipping_zip TEXT,
            payment_method TEXT DEFAULT 'card',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
    `);

    seedData();
    console.log('✅ Database initialized');
    return db;
}

function seedData() {
    const count = db.prepare('SELECT COUNT(*) as c FROM categories').get();
    if (count.c > 0) return;

    const cats = [
        { name: 'Electronics', icon: 'fa-bolt' },
        { name: 'Fashion', icon: 'fa-shirt' },
        { name: 'Home & Living', icon: 'fa-house' },
        { name: 'Sports', icon: 'fa-basketball' },
        { name: 'Beauty', icon: 'fa-wand-magic-sparkles' },
        { name: 'Books', icon: 'fa-book' }
    ];
    const insC = db.prepare('INSERT INTO categories (name, icon) VALUES (?, ?)');
    cats.forEach(c => insC.run(c.name, c.icon));

    const hash = bcrypt.hashSync('test1234', 10);
    // Removed default admin seeding as requested
    console.log('✅ Seeded sample categories');
}

module.exports = { db, initDatabase };
