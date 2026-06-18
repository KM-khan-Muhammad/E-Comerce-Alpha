const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Get all products
router.get('/', (req, res) => {
    const { category, search, featured, sort, limit = 100, offset = 0, minPrice, maxPrice } = req.query;
    let query = `SELECT p.*, c.name as category_name, c.icon as category_icon FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
    const params = [];

    if (category && category !== 'all') { query += ` AND c.name = ?`; params.push(category); }
    if (search) {
        const terms = search.trim().split(/\s+/);
        terms.forEach(term => {
            query += ` AND (p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)`;
            params.push(`%${term}%`, `%${term}%`, `%${term}%`);
        });
    }
    if (featured === 'true') { query += ` AND p.featured = 1`; }
    if (minPrice) { query += ` AND p.price >= ?`; params.push(parseFloat(minPrice)); }
    if (maxPrice) { query += ` AND p.price <= ?`; params.push(parseFloat(maxPrice)); }

    switch (sort) {
        case 'price_asc': query += ' ORDER BY p.price ASC'; break;
        case 'price_desc': query += ' ORDER BY p.price DESC'; break;
        case 'rating': query += ' ORDER BY p.rating DESC'; break;
        case 'newest': query += ' ORDER BY p.created_at DESC'; break;
        default: query += ' ORDER BY p.featured DESC, p.rating DESC';
    }

    const countQuery = `SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const products = db.prepare(query).all(...params);
    res.json({ products, total: products.length });
});

// Get categories
router.get('/categories', (req, res) => {
    const categories = db.prepare('SELECT * FROM categories').all();
    res.json({ categories });
});

// Get current user's products
router.get('/my-products', authenticateToken, (req, res) => {
    const products = db.prepare(`
        SELECT p.*, c.name as category_name, c.icon as category_icon 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `).all(req.user.id);
    res.json({ products });
});

// Get single product
router.get('/:id', (req, res) => {
    const product = db.prepare(`
        SELECT p.*, c.name as category_name, c.icon as category_icon, 
               u.name as seller_name, u.email as seller_email 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
    `).get(req.params.id);
    
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const related = db.prepare(`SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id = ? AND p.id != ? LIMIT 4`).all(product.category_id, product.id);
    res.json({ product, related });
});

// Create product (Open to any logged-in user)
router.post('/', authenticateToken, (req, res) => {
    const { name, description, price, original_price, category_id, image_url, stock, featured } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'Name and price required.' });
    
    const result = db.prepare(`
        INSERT INTO products (name, description, price, original_price, category_id, image_url, stock, featured, user_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, description, price, original_price, category_id, image_url, stock || 0, featured ? 1 : 0, req.user.id);
    
    res.status(201).json({ product: db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid), message: 'Product created!' });
});

// Update product
router.put('/:id', authenticateToken, (req, res) => {
    const { name, description, price, original_price, category_id, image_url, stock, featured } = req.body;
    
    // Check ownership
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to edit this product.' });

    db.prepare(`
        UPDATE products 
        SET name = ?, description = ?, price = ?, original_price = ?, category_id = ?, image_url = ?, stock = ?, featured = ?
        WHERE id = ?
    `).run(name, description, price, original_price, category_id, image_url, stock || 0, featured ? 1 : 0, req.params.id);
    
    res.json({ message: 'Product updated successfully!' });
});

// Delete product
router.delete('/:id', authenticateToken, (req, res) => {
    // Check ownership
    const product = db.prepare('SELECT user_id FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    if (product.user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to delete this product.' });

    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ message: 'Product deleted successfully!' });
});

module.exports = router;
