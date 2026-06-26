/* ========================================
   CAMPTRACK CUSTOMER PORTAL - JAVASCRIPT
   Katalog, Search, Filter, Navigation
   ======================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbwfB6btiYTyECs_XXGu2j3Ojy8JvICAAm5Y7CswdbfnlJxpjcWnwIH4dDayvFL-sC-K/exec";

// --- STATE ---
let assets = [];
let currentPage = 'beranda';
let cartItems = [];
let currentUser = null; // { id, nama, hp, email, password, created_at }

// --- HELPERS ---
const idr = v => 'Rp ' + Math.round(v).toLocaleString('id-ID');


// --- LOADER ---
function showLoader() {
  document.getElementById('global-loader').style.display = 'flex';
}
function hideLoader() {
  document.getElementById('global-loader').style.display = 'none';
}

// --- NAVIGATION ---
function navTo(page) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const target = document.getElementById('page-' + page);
  if (target) {
    target.classList.add('active');
  }

  // Update navbar active state
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === page);
  });

  // Update bottom nav active state
  document.querySelectorAll('.bottom-nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.page === page);
  });

  currentPage = page;
  closeMobileMenu();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Render page-specific content
  if (page === 'katalog') renderCatalog();
  if (page === 'beranda') renderPopular();
}


// --- MOBILE MENU ---
function toggleMobileMenu() {
  document.getElementById('mobile-menu').classList.toggle('show');
}
function closeMobileMenu() {
  document.getElementById('mobile-menu').classList.remove('show');
}

// --- FETCH DATA FROM API ---
async function loadCatalog() {
  showLoader();
  try {
    const response = await fetch(`${API_URL}?page=dashboard`);
    const result = await response.json();

    if (result.status === 'success') {
      assets = result.assets.map(item => ({
        id: item.id_aset,
        kode: item.kode,
        nama: item.nama_barang,
        kat: item.kategori,
        tarif: item.tarif,
        status: item.status,
        foto: item.foto,
        desc: item.deskripsi
      }));

      // Update hero stats
      const heroTotal = document.getElementById('hero-total-items');
      if (heroTotal) {
        const available = assets.filter(a => a.status === 'Tersedia').length;
        heroTotal.textContent = available + '+';
      }

      renderPopular();
      renderCatalog();
    } else {
      showError('Gagal memuat data katalog.');
    }
  } catch (error) {
    console.error('Fetch Error:', error);
    showError('Terjadi kesalahan jaringan. Silakan coba lagi.');
  } finally {
    hideLoader();
  }
}

function showError(msg) {
  alert(msg);
}


// --- RENDER POPULAR (Beranda) ---
function renderPopular() {
  const grid = document.getElementById('popular-grid');
  if (!grid) return;

  // Show max 4 available items as "popular"
  const popular = assets
    .filter(a => a.status === 'Tersedia')
    .slice(0, 4);

  if (popular.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:14px;">Belum ada barang tersedia.</p>';
    return;
  }

  grid.innerHTML = popular.map(a => createCatalogCard(a)).join('');
}

// --- RENDER CATALOG (Full page) ---
function renderCatalog() {
  const grid = document.getElementById('catalog-grid');
  const emptyEl = document.getElementById('catalog-empty');
  const resultInfo = document.getElementById('result-info');
  if (!grid) return;

  // Get filter values
  const query = (document.getElementById('search-catalog')?.value || '').toLowerCase().trim();
  const category = document.getElementById('filter-category')?.value || '';
  const sort = document.getElementById('filter-sort')?.value || 'nama';

  // Filter assets
  let filtered = assets.filter(a => {
    const matchQuery = !query
      || a.nama.toLowerCase().includes(query)
      || a.kode.toLowerCase().includes(query)
      || a.desc.toLowerCase().includes(query);
    const matchCategory = !category || a.kat === category;
    return matchQuery && matchCategory;
  });

  // Sort
  switch (sort) {
    case 'harga-asc':
      filtered.sort((a, b) => a.tarif - b.tarif);
      break;
    case 'harga-desc':
      filtered.sort((a, b) => b.tarif - a.tarif);
      break;
    case 'nama':
    default:
      filtered.sort((a, b) => a.nama.localeCompare(b.nama));
      break;
  }

  // Update result info
  if (resultInfo) {
    const availCount = filtered.filter(a => a.status === 'Tersedia').length;
    resultInfo.textContent = `Menampilkan ${filtered.length} barang (${availCount} tersedia)`;
  }

  // Render
  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
  } else {
    if (emptyEl) emptyEl.style.display = 'none';
    grid.innerHTML = filtered.map(a => createCatalogCard(a)).join('');
  }
}


// --- CATALOG CARD TEMPLATE ---
function createCatalogCard(asset) {
  const isAvailable = asset.status === 'Tersedia';
  const badgeClass = isAvailable ? '' : 'unavailable';
  const badgeText = isAvailable ? 'Tersedia' : asset.status;

  return `
    <div class="catalog-card" onclick="openDetail(${asset.id})">
      <div class="catalog-card-img">
        ${asset.foto || '📦'}
        <span class="catalog-card-badge ${badgeClass}">${badgeText}</span>
      </div>
      <div class="catalog-card-body">
        <div class="catalog-card-category">${asset.kat}</div>
        <div class="catalog-card-name">${asset.nama}</div>
        <div class="catalog-card-desc">${asset.desc || 'Alat kemping berkualitas'}</div>
        <div class="catalog-card-footer">
          <div class="catalog-card-price">${idr(asset.tarif)} <small>/hari</small></div>
          <div class="catalog-card-rating">
            <i class="ti ti-star-filled"></i> 4.${Math.floor(Math.random() * 3) + 7}
            <span>(${Math.floor(Math.random() * 20) + 5})</span>
          </div>
        </div>
        <button class="btn-add-cart ${isAvailable ? '' : 'disabled'}"
          onclick="event.stopPropagation(); ${isAvailable ? `addToCart(${asset.id})` : ''}">
          <i class="ti ti-${isAvailable ? 'shopping-cart-plus' : 'lock'}"></i>
          ${isAvailable ? 'Tambah ke Keranjang' : 'Tidak Tersedia'}
        </button>
      </div>
    </div>
  `;
}


// --- DETAIL PAGE ---
function openDetail(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const isAvailable = asset.status === 'Tersedia';
  const content = document.getElementById('detail-content');

  content.innerHTML = `
    <div class="detail-img">${asset.foto || '📦'}</div>
    <div class="detail-info">
      <div class="detail-category">${asset.kat}</div>
      <h1 class="detail-name">${asset.nama}</h1>
      <p class="detail-desc">${asset.desc || 'Alat kemping berkualitas tinggi untuk petualangan outdoor Anda.'}</p>
      <div class="detail-price">${idr(asset.tarif)} <small>/ hari</small></div>
      <div class="detail-status ${isAvailable ? 'available' : 'unavailable'}">
        <i class="ti ti-${isAvailable ? 'circle-check' : 'circle-x'}"></i>
        ${isAvailable ? 'Tersedia untuk disewa' : 'Sedang tidak tersedia'}
      </div>
      <div class="detail-meta">
        <div><i class="ti ti-barcode"></i> Kode: ${asset.kode}</div>
        <div><i class="ti ti-category"></i> Kategori: ${asset.kat}</div>
        <div><i class="ti ti-coin"></i> Tarif: ${idr(asset.tarif)} per hari</div>
        <div><i class="ti ti-clock"></i> Denda keterlambatan: Rp 5.000/jam</div>
      </div>
      <div class="detail-actions">
        <button class="btn-order ${isAvailable ? '' : 'disabled'}"
          onclick="${isAvailable ? `addToCart(${asset.id})` : ''}">
          <i class="ti ti-shopping-cart-plus"></i>
          ${isAvailable ? 'Tambah ke Keranjang' : 'Tidak Tersedia'}
        </button>
        <button class="btn-wishlist" onclick="addToWishlist(${asset.id})">
          <i class="ti ti-heart"></i> Simpan
        </button>
      </div>
    </div>
  `;

  navTo('detail');
}


// --- CART (Basic - placeholder for Stage 4) ---
function addToCart(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset || asset.status !== 'Tersedia') return;

  // Check if already in cart
  const existing = cartItems.find(c => c.id === id);
  if (existing) {
    alert('Barang ini sudah ada di keranjang Anda.');
    return;
  }

  cartItems.push({ id: asset.id, nama: asset.nama, tarif: asset.tarif });
  updateCartBadge();
  alert(`✅ ${asset.nama} ditambahkan ke keranjang!`);
}

function addToWishlist(id) {
  alert('💚 Fitur Wishlist akan tersedia di update berikutnya!');
}

function updateCartBadge() {
  const count = cartItems.length;
  const badge = document.getElementById('cart-badge');
  const bottomBadge = document.getElementById('bottom-cart-badge');
  if (badge) badge.textContent = count;
  if (bottomBadge) bottomBadge.textContent = count;
}

// --- FILTER BY CATEGORY (from beranda) ---
function filterByCategory(category) {
  navTo('katalog');
  // Set the filter dropdown
  const sel = document.getElementById('filter-category');
  if (sel) {
    sel.value = category;
    renderCatalog();
  }
}


// --- HASH ROUTING ---
function handleHash() {
  const hash = window.location.hash.replace('#', '') || 'beranda';
  const validPages = ['beranda', 'katalog', 'keranjang', 'pesanan', 'login', 'profil'];
  if (validPages.includes(hash)) {
    navTo(hash);
  }
}

// --- DEBOUNCE for search ---
let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(renderCatalog, 300);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  // Restore session from localStorage
  restoreSession();

  // Load catalog data from API
  loadCatalog();

  // Handle hash navigation
  handleHash();
  window.addEventListener('hashchange', handleHash);

  // Replace oninput with debounced version
  const searchInput = document.getElementById('search-catalog');
  if (searchInput) {
    searchInput.removeAttribute('oninput');
    searchInput.addEventListener('input', debounceSearch);
  }

  // Close mobile menu on outside click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });

  // Update cart badge on load
  updateCartBadge();
});



/* ========================================
   AUTH MODULE - Register, Login, Session
   ======================================== */

// --- SESSION MANAGEMENT ---
function restoreSession() {
  const saved = localStorage.getItem('camptrack_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      updateUIForLoggedIn();
    } catch (e) {
      localStorage.removeItem('camptrack_user');
      currentUser = null;
      updateUIForGuest();
    }
  } else {
    updateUIForGuest();
  }
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem('camptrack_user', JSON.stringify(user));
  updateUIForLoggedIn();
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem('camptrack_user');
  updateUIForGuest();
}

// --- UI STATE UPDATES ---
function updateUIForLoggedIn() {
  if (!currentUser) return;

  const initial = currentUser.nama ? currentUser.nama.charAt(0).toUpperCase() : '?';

  // Desktop navbar
  const navGuest = document.getElementById('nav-guest');
  const navUser = document.getElementById('nav-user');
  if (navGuest) navGuest.style.display = 'none';
  if (navUser) {
    navUser.style.display = 'flex';
    const avatar = document.getElementById('nav-avatar');
    const username = document.getElementById('nav-username');
    if (avatar) avatar.textContent = initial;
    if (username) username.textContent = currentUser.nama.split(' ')[0];
  }

  // Mobile menu
  const mobileGuest = document.getElementById('mobile-menu-guest');
  const mobileUser = document.getElementById('mobile-menu-user');
  if (mobileGuest) mobileGuest.style.display = 'none';
  if (mobileUser) {
    mobileUser.style.display = 'block';
    const mName = document.getElementById('mobile-user-name');
    const mEmail = document.getElementById('mobile-user-email');
    if (mName) mName.textContent = currentUser.nama;
    if (mEmail) mEmail.textContent = currentUser.email;
    const mAvatar = mobileUser.querySelector('.user-avatar-sm');
    if (mAvatar) mAvatar.textContent = initial;
  }

  // Profil page
  const profilContent = document.getElementById('profil-content');
  const profilGuest = document.getElementById('profil-guest');
  if (profilContent) profilContent.style.display = 'block';
  if (profilGuest) profilGuest.style.display = 'none';

  // Fill profil data
  const pAvatar = document.getElementById('profil-avatar');
  const pName = document.getElementById('profil-name');
  const pEmail = document.getElementById('profil-email');
  if (pAvatar) pAvatar.textContent = initial;
  if (pName) pName.textContent = currentUser.nama;
  if (pEmail) pEmail.textContent = currentUser.email;

  // Fill edit form
  const editNama = document.getElementById('edit-nama');
  const editHp = document.getElementById('edit-hp');
  const editEmail = document.getElementById('edit-email');
  if (editNama) editNama.value = currentUser.nama;
  if (editHp) editHp.value = currentUser.hp;
  if (editEmail) editEmail.value = currentUser.email;

  // Stats
  const statSince = document.getElementById('stat-member-since');
  if (statSince && currentUser.created_at) {
    statSince.textContent = new Date(currentUser.created_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

function updateUIForGuest() {
  // Desktop navbar
  const navGuest = document.getElementById('nav-guest');
  const navUser = document.getElementById('nav-user');
  if (navGuest) navGuest.style.display = 'flex';
  if (navUser) navUser.style.display = 'none';

  // Mobile menu
  const mobileGuest = document.getElementById('mobile-menu-guest');
  const mobileUser = document.getElementById('mobile-menu-user');
  if (mobileGuest) mobileGuest.style.display = 'block';
  if (mobileUser) mobileUser.style.display = 'none';

  // Profil page
  const profilContent = document.getElementById('profil-content');
  const profilGuest = document.getElementById('profil-guest');
  if (profilContent) profilContent.style.display = 'none';
  if (profilGuest) profilGuest.style.display = 'block';
}

// --- AUTH FORM TOGGLE ---
function toggleAuthForm(mode) {
  const loginForm = document.getElementById('form-login');
  const registerForm = document.getElementById('form-register');
  const title = document.getElementById('auth-title');
  const subtitle = document.getElementById('auth-subtitle');
  const toggleText = document.getElementById('auth-toggle-text');

  if (mode === 'register') {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    title.textContent = 'Daftar Akun Baru';
    subtitle.textContent = 'Buat akun untuk memesan alat kemping online';
    toggleText.innerHTML = 'Sudah punya akun? <button type="button" class="btn-auth-toggle" onclick="toggleAuthForm(\'login\')">Masuk di sini</button>';
  } else {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    title.textContent = 'Masuk ke CampTrack';
    subtitle.textContent = 'Masuk untuk memesan alat kemping favorit Anda';
    toggleText.innerHTML = 'Belum punya akun? <button type="button" class="btn-auth-toggle" onclick="toggleAuthForm(\'register\')">Daftar sekarang</button>';
  }
}

// --- TOGGLE PASSWORD VISIBILITY ---
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'ti ti-eye-off';
  } else {
    input.type = 'password';
    icon.className = 'ti ti-eye';
  }
}

// --- REGISTER HANDLER ---
async function handleRegister(event) {
  event.preventDefault();

  const nama = document.getElementById('reg-nama').value.trim();
  const hp = document.getElementById('reg-hp').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;

  // Validasi
  if (!nama || !hp || !email || !password) {
    showToast('Lengkapi semua field!', 'error');
    return false;
  }
  if (password.length < 6) {
    showToast('Password minimal 6 karakter!', 'error');
    return false;
  }
  if (password !== password2) {
    showToast('Konfirmasi password tidak cocok!', 'error');
    return false;
  }
  if (!/^08\d{8,12}$/.test(hp)) {
    showToast('Format No. HP tidak valid! Gunakan 08xxxxxxxxxx', 'error');
    return false;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showToast('Format email tidak valid!', 'error');
    return false;
  }

  // Send to API
  const btnReg = document.getElementById('btn-register');
  btnReg.disabled = true;
  btnReg.innerHTML = '<div class="spinner-loader" style="width:20px;height:20px;border-width:2px"></div> Mendaftar...';

  try {
    const payload = {
      action: 'register_customer',
      data: { nama, hp, email, password }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Auto-login after register
      const user = {
        id: result.id || Date.now(),
        nama: nama,
        hp: hp,
        email: email,
        password: password,
        created_at: new Date().toISOString()
      };
      saveSession(user);
      showToast('Akun berhasil dibuat! Selamat datang, ' + nama.split(' ')[0] + '!', 'success');
      document.getElementById('form-register').reset();
      navTo('beranda');
    } else {
      showToast(result.message || 'Gagal mendaftar. Coba lagi.', 'error');
    }
  } catch (error) {
    console.error('Register Error:', error);
    // Fallback: save locally if API fails (offline-capable)
    const user = {
      id: 'local_' + Date.now(),
      nama: nama,
      hp: hp,
      email: email,
      password: password,
      created_at: new Date().toISOString()
    };
    saveSession(user);
    showToast('Akun dibuat (mode lokal). Selamat datang!', 'success');
    document.getElementById('form-register').reset();
    navTo('beranda');
  } finally {
    btnReg.disabled = false;
    btnReg.innerHTML = '<i class="ti ti-user-plus"></i> Daftar Akun';
  }

  return false;
}

// --- LOGIN HANDLER ---
async function handleLogin(event) {
  event.preventDefault();

  const emailOrHp = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!emailOrHp || !password) {
    showToast('Lengkapi email/HP dan password!', 'error');
    return false;
  }

  const btnLogin = document.getElementById('btn-login');
  btnLogin.disabled = true;
  btnLogin.innerHTML = '<div class="spinner-loader" style="width:20px;height:20px;border-width:2px"></div> Masuk...';

  try {
    const payload = {
      action: 'login_customer',
      data: { emailOrHp, password }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success' && result.user) {
      const user = {
        id: result.user.id || result.user.id_customer,
        nama: result.user.nama,
        hp: result.user.hp || result.user.no_hp,
        email: result.user.email,
        password: password,
        created_at: result.user.created_at || new Date().toISOString()
      };
      saveSession(user);
      showToast('Selamat datang kembali, ' + user.nama.split(' ')[0] + '!', 'success');
      document.getElementById('form-login').reset();
      navTo('beranda');
    } else {
      showToast(result.message || 'Email/HP atau password salah!', 'error');
    }
  } catch (error) {
    console.error('Login Error:', error);
    // Fallback: check local storage for previously registered users
    const savedUser = localStorage.getItem('camptrack_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if ((user.email === emailOrHp || user.hp === emailOrHp) && user.password === password) {
        currentUser = user;
        updateUIForLoggedIn();
        showToast('Masuk berhasil (mode lokal)!', 'success');
        document.getElementById('form-login').reset();
        navTo('beranda');
      } else {
        showToast('Email/HP atau password salah!', 'error');
      }
    } else {
      showToast('Terjadi kesalahan jaringan. Coba lagi.', 'error');
    }
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = '<i class="ti ti-login"></i> Masuk';
  }

  return false;
}

// --- LOGOUT ---
function handleLogout() {
  if (confirm('Yakin ingin keluar dari akun Anda?')) {
    clearSession();
    showToast('Anda telah keluar.', 'success');
    navTo('beranda');
    closeMobileMenu();
  }
}

// --- EDIT PROFIL ---
async function handleEditProfil(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast('Anda belum login!', 'error');
    return false;
  }

  const nama = document.getElementById('edit-nama').value.trim();
  const hp = document.getElementById('edit-hp').value.trim();
  const email = document.getElementById('edit-email').value.trim();

  if (!nama || !hp || !email) {
    showToast('Lengkapi semua field!', 'error');
    return false;
  }

  try {
    const payload = {
      action: 'update_customer',
      data: { id: currentUser.id, nama, hp, email }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success') {
      currentUser.nama = nama;
      currentUser.hp = hp;
      currentUser.email = email;
      saveSession(currentUser);
      showToast('Profil berhasil diperbarui!', 'success');
    } else {
      showToast(result.message || 'Gagal menyimpan perubahan.', 'error');
    }
  } catch (error) {
    // Fallback: save locally
    currentUser.nama = nama;
    currentUser.hp = hp;
    currentUser.email = email;
    saveSession(currentUser);
    showToast('Profil diperbarui (mode lokal).', 'success');
  }

  return false;
}

// --- CHANGE PASSWORD ---
async function handleChangePassword(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast('Anda belum login!', 'error');
    return false;
  }

  const oldPass = document.getElementById('old-pass').value;
  const newPass = document.getElementById('new-pass').value;
  const newPass2 = document.getElementById('new-pass2').value;

  if (oldPass !== currentUser.password) {
    showToast('Password lama tidak sesuai!', 'error');
    return false;
  }
  if (newPass.length < 6) {
    showToast('Password baru minimal 6 karakter!', 'error');
    return false;
  }
  if (newPass !== newPass2) {
    showToast('Konfirmasi password baru tidak cocok!', 'error');
    return false;
  }

  try {
    const payload = {
      action: 'change_password_customer',
      data: { id: currentUser.id, oldPassword: oldPass, newPassword: newPass }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success') {
      currentUser.password = newPass;
      saveSession(currentUser);
      showToast('Password berhasil diubah!', 'success');
      document.getElementById('form-change-pass').reset();
    } else {
      showToast(result.message || 'Gagal mengubah password.', 'error');
    }
  } catch (error) {
    // Fallback: save locally
    currentUser.password = newPass;
    saveSession(currentUser);
    showToast('Password diubah (mode lokal).', 'success');
    document.getElementById('form-change-pass').reset();
  }

  return false;
}

// --- TOAST NOTIFICATION ---
function showToast(message, type = 'success') {
  // Remove existing toast
  const existing = document.querySelector('.toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast-notification toast-${type}`;
  toast.innerHTML = `
    <i class="ti ti-${type === 'success' ? 'circle-check' : 'alert-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-remove after 3.5s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// --- AUTH GUARD (for pages that require login) ---
function requireAuth(redirectPage) {
  if (!currentUser) {
    showToast('Silakan masuk terlebih dahulu.', 'error');
    navTo('login');
    return false;
  }
  return true;
}
