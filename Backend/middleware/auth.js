const jwt = require('jsonwebtoken');
const { db } = require('../database');
const JWT_SECRET = process.env.JWT_SECRET || 'shopnova_ultra_secret_key_2024_xk9p';

function authenticateToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.userId);
        if (!user) return res.status(401).json({ error: 'Invalid token.' });
        req.user = user;
        next();
    } catch {
        res.status(403).json({ error: 'Invalid or expired token.' });
    }
}

module.exports = { authenticateToken, JWT_SECRET };
