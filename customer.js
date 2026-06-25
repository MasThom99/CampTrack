/* ========================================
   CAMPTRACK CUSTOMER PORTAL - JAVASCRIPT
   Katalog, Search, Filter, Navigation
   ======================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbwfB6btiYTyECs_XXGu2j3Ojy8JvICAAm5Y7CswdbfnlJxpjcWnwIH4dDayvFL-sC-K/exec";

// --- STATE ---
let assets = [];
let currentPage = 'beranda';
let cartItems = [];

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
