const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get cart
router.get('/', authenticateToken, (req, res) => {
    const items = db.prepare(`
        SELECT ci.id, ci.quantity, ci.product_id, p.name, p.price, p.original_price, p.image_url, p.stock, p.rating, c.name as category_name
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE ci.user_id = ?
    `).all(req.user.id);
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    const count = items.reduce((s, i) => s + i.quantity, 0);
    res.json({ items, total: parseFloat(total.toFixed(2)), count });
});

// Add to cart
router.post('/add', authenticateToken, (req, res) => {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'Product ID required.' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock.' });
    if (product.user_id === req.user.id) return res.status(400).json({ error: "You cannot buy your own product!" });

    const existing = db.prepare('SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?').get(req.user.id, product_id);
    if (existing) {
        const newQty = existing.quantity + parseInt(quantity);
        if (product.stock < newQty) return res.status(400).json({ error: 'Insufficient stock.' });
        db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(newQty, existing.id);
    } else {
        db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(req.user.id, product_id, quantity);
    }
    const count = db.prepare('SELECT SUM(quantity) as count FROM cart_items WHERE user_id = ?').get(req.user.id);
    res.json({ message: `${product.name} added to cart! 🛒`, count: count.count || 0 });
});

// Update quantity
router.put('/update/:id', authenticateToken, (req, res) => {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ error: 'Valid quantity required.' });
    const item = db.prepare('SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON ci.product_id = p.id WHERE ci.id = ? AND ci.user_id = ?').get(req.params.id, req.user.id);
    if (!item) return res.status(404).json({ error: 'Cart item not found.' });
    if (item.stock < quantity) return res.status(400).json({ error: 'Insufficient stock.' });
    db.prepare('UPDATE cart_items SET quantity = ? WHERE id = ?').run(quantity, req.params.id);
    res.json({ message: 'Cart updated!' });
});

// Remove item
router.delete('/remove/:id', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM cart_items WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: 'Item removed.' });
});

// Clear cart
router.delete('/clear', authenticateToken, (req, res) => {
    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Cart cleared.' });
});

module.exports = router;
