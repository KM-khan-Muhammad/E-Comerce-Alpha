const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Place order
router.post('/', authenticateToken, (req, res) => {
    const { shipping_name, shipping_address, shipping_city, shipping_zip, payment_method = 'card' } = req.body;
    if (!shipping_name || !shipping_address || !shipping_city || !shipping_zip) {
        return res.status(400).json({ error: 'All shipping fields are required.' });
    }

    const cartItems = db.prepare(`
        SELECT ci.quantity, p.id as product_id, p.name, p.price, p.stock, p.user_id
        FROM cart_items ci JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
    `).all(req.user.id);

    if (!cartItems.length) return res.status(400).json({ error: 'Your cart is empty.' });

    for (const item of cartItems) {
        if (item.stock < item.quantity) return res.status(400).json({ error: `Insufficient stock for "${item.name}".` });
        if (item.user_id === req.user.id) return res.status(400).json({ error: `You cannot purchase your own product: "${item.name}".` });
    }

    const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const shipping = subtotal > 100 ? 0 : 9.99;
    const tax = subtotal * 0.08;
    const total = subtotal + shipping + tax;

    const placeOrder = db.transaction(() => {
        const order = db.prepare(`
            INSERT INTO orders (user_id, subtotal, shipping, tax, total, status, shipping_name, shipping_address, shipping_city, shipping_zip, payment_method)
            VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)
        `).run(req.user.id, subtotal.toFixed(2), shipping.toFixed(2), tax.toFixed(2), total.toFixed(2), shipping_name, shipping_address, shipping_city, shipping_zip, payment_method);

        const insItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, quantity, price) VALUES (?, ?, ?, ?, ?)');
        const updStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
        cartItems.forEach(item => {
            insItem.run(order.lastInsertRowid, item.product_id, item.name, item.quantity, item.price);
            updStock.run(item.quantity, item.product_id);
        });

        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
        return order.lastInsertRowid;
    });

    const orderId = placeOrder();
    res.status(201).json({ orderId, message: 'Order placed successfully! 🎉', total: total.toFixed(2) });
});

// Get user orders
router.get('/', authenticateToken, (req, res) => {
    const orders = db.prepare(`
        SELECT o.*, COUNT(oi.id) as item_count
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `).all(req.user.id);
    res.json({ orders });
});

// Get single order
router.get('/:id', authenticateToken, (req, res) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    const items = db.prepare(`
        SELECT oi.*, p.image_url FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
    `).all(order.id);
    res.json({ order, items });
});

module.exports = router;
