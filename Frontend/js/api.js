// Auto-detect the API base URL depending on how the user accesses the site (localhost vs Network IP)
const API_BASE = `${window.location.protocol}//${window.location.hostname}:5001/api`;

// ── Token helpers ──────────────────────────────────────────────
const Auth = {
    getToken: () => localStorage.getItem('sn_token'),
    getUser: () => JSON.parse(localStorage.getItem('sn_user') || 'null'),
    setSession(user, token) {
        localStorage.setItem('sn_token', token);
        localStorage.setItem('sn_user', JSON.stringify(user));
    },
    clear() {
        localStorage.removeItem('sn_token');
        localStorage.removeItem('sn_user');
    },
    isLoggedIn: () => !!localStorage.getItem('sn_token'),
};

// ── HTTP helper ────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const token = Auth.getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
}

// ── Cart badge updater ─────────────────────────────────────────
async function refreshCartBadge() {
    const badge = document.getElementById('cart-badge');
    if (!badge) return;
    if (!Auth.isLoggedIn()) {
        badge.textContent = '0';
        badge.style.display = 'none';
        return;
    }
    try {
        const { items } = await apiFetch('/cart');
        const count = items?.reduce((acc, i) => acc + i.quantity, 0) || 0;
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    } catch {
        badge.textContent = '0';
        badge.style.display = 'none';
    }
}

// ── Toast Notification ─────────────────────────────────────────
function showToast(message, type = 'success') {
    const existing = document.querySelector('.sn-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `sn-toast sn-toast--${type}`;
    const icons = {
        success: '<i class="fa-solid fa-circle-check"></i>',
        error: '<i class="fa-solid fa-circle-xmark"></i>',
        info: '<i class="fa-solid fa-circle-info"></i>',
        warning: '<i class="fa-solid fa-triangle-exclamation"></i>'
    };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('sn-toast--show'));
    setTimeout(() => {
        toast.classList.remove('sn-toast--show');
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}

// ── Format helpers ─────────────────────────────────────────────
const fmt = {
    price: (n) => `$${parseFloat(n).toFixed(2)}`,
    date: (d) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    stars: (r) => {
        const full = Math.floor(r), half = r % 1 >= 0.5 ? 1 : 0;
        return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - half);
    }
};

// ── Navbar auth state ──────────────────────────────────────────
function updateNavAuth() {
    const user = Auth.getUser();
    const guestLinks = document.querySelectorAll('.nav-guest');
    const memberLinks = document.querySelectorAll('.nav-member');
    const userNameEl = document.getElementById('nav-username');
    const navLinks = document.querySelector('.nav-links');

    if (user) {
        guestLinks.forEach(el => el.style.display = 'none');
        memberLinks.forEach(el => {
            el.style.display = el.tagName === 'DIV' ? 'flex' : 'block';
        });
        if (userNameEl) userNameEl.textContent = user.name.split(' ')[0];

        // Desktop nav links addition
        if (navLinks && !document.getElementById('nav-add-product')) {
            const addLink = document.createElement('a');
            addLink.href = 'add-product.html';
            addLink.id = 'nav-add-product';
            addLink.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Add Product';
            addLink.style.color = 'var(--accent2)';
            navLinks.appendChild(addLink);

            const myLink = document.createElement('a');
            myLink.href = 'my-products.html';
            myLink.id = 'nav-my-products';
            myLink.innerHTML = '<i class="fa-solid fa-list-check"></i> My Products';
            myLink.style.color = 'var(--accent)';
            navLinks.appendChild(myLink);
        }
    } else {
        guestLinks.forEach(el => {
            el.style.display = el.tagName === 'DIV' ? 'flex' : 'block';
        });
        memberLinks.forEach(el => el.style.display = 'none');
        const addBtn = document.getElementById('nav-add-product');
        if (addBtn) addBtn.remove();
        const myBtn = document.getElementById('nav-my-products');
        if (myBtn) myBtn.remove();
    }
}

function logout() {
    Auth.clear();
    showToast('Logged out. See you soon! 👋', 'info');
    setTimeout(() => window.location.href = '/index.html', 1000);
}

// Run on every page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavAuth();
    refreshCartBadge();
});
