require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../Frontend')));

initDatabase();

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart',     require('./routes/cart'));
app.use('/api/orders',   require('./routes/orders'));

app.get('/api/stats', (req, res) => {
    const { db } = require('./database');
    try {
        const productsCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const usersCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const avgRatingRow = db.prepare('SELECT AVG(rating) as avg FROM products').get();
        const globalRating = avgRatingRow && avgRatingRow.avg ? avgRatingRow.avg.toFixed(1) : 4.9;
        
        res.json({
            products: productsCount,
            users: usersCount,
            rating: globalRating
        });
    } catch (e) {
        console.error('Stats error:', e);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});

const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

app.post('/api/contact', async (req, res) => {
    const { name, email, subject, message } = req.body;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER,
        replyTo: email,
        subject: `[ShopNova Contact] ${subject} - from ${name}`,
        text: `From: ${name} (${email})\n\nMessage:\n${message}`
    };
    try {
        await transporter.sendMail(mailOptions);
        res.json({ message: 'Message sent successfully! 🚀' });
    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({ error: 'Failed to send email.' });
    }
});

// Serve frontend for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend', 'index.html'));
});

const os = require('os');
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return 'localhost';
}

const server = app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`\n🚀 ShopNova is running!`);
    console.log(`🏠 Local:   http://localhost:${PORT}`);
    console.log(`🌐 Network: http://${localIP}:${PORT}`);
    console.log(`📦 API:     http://${localIP}:${PORT}/api\n`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please close the other process or change the PORT in .env`);
    } else {
        console.error('❌ Server error:', err);
    }
    process.exit(1);
});
