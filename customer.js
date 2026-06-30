/* ========================================
   CAMPTRACK CUSTOMER PORTAL - JAVASCRIPT
   Katalog, Search, Filter, Navigation
   ======================================== */

const API_URL = "https://script.google.com/macros/s/AKfycbwfB6btiYTyECs_XXGu2j3Ojy8JvICAAm5Y7CswdbfnlJxpjcWnwIH4dDayvFL-sC-K/exec";

// --- STATE ---
let assets = [];
let currentPage = 'beranda';
let cartItems = []; // { id, nama, tarif, foto, tglMulai, tglSelesai }
let wishlistItems = []; // { id }
let currentUser = null; // { id, nama, hp, email, password, created_at }
let reviews = []; // { id, asetId, userId, userName, rating, komentar, created_at, balasan_admin }

// --- HELPERS ---
const idr = v => 'Rp ' + Math.round(v).toLocaleString('id-ID');
const today = () => new Date().toISOString().slice(0, 10);
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };


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
  if (page === 'keranjang') renderCart();
  if (page === 'pesanan') renderOrders();
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

      // Load reviews (async, non-blocking)
      await loadReviews();

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

  // Compute actual rating from reviews
  const assetReviews = reviews.filter(r => String(r.asetId) === String(asset.id));
  const avgRating = assetReviews.length > 0
    ? (assetReviews.reduce((sum, r) => sum + r.rating, 0) / assetReviews.length).toFixed(1)
    : '-';
  const reviewCount = assetReviews.length;

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
            <i class="ti ti-star-filled"></i> ${avgRating}
            <span>(${reviewCount})</span>
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

  // Get reviews for this asset
  const assetReviews = reviews.filter(r => String(r.asetId) === String(id));
  const avgRating = assetReviews.length > 0
    ? (assetReviews.reduce((sum, r) => sum + r.rating, 0) / assetReviews.length).toFixed(1)
    : '0';
  const reviewCount = assetReviews.length;

  content.innerHTML = `
    <div class="detail-img">${asset.foto || '📦'}</div>
    <div class="detail-info">
      <div class="detail-category">${asset.kat}</div>
      <h1 class="detail-name">${asset.nama}</h1>
      <div class="detail-rating-summary">
        <div class="stars-display">${renderStars(parseFloat(avgRating))}</div>
        <span class="rating-value">${avgRating}</span>
        <span class="rating-count">(${reviewCount} ulasan)</span>
      </div>
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

    <!-- REVIEW SECTION -->
    <div class="detail-reviews-section">
      <div class="reviews-header">
        <h3><i class="ti ti-star"></i> Ulasan Pelanggan</h3>
        <div class="reviews-summary-bar">
          <div class="summary-avg">
            <span class="avg-number">${avgRating}</span>
            <div class="avg-stars">${renderStars(parseFloat(avgRating))}</div>
            <span class="avg-count">${reviewCount} ulasan</span>
          </div>
          ${reviewCount > 0 ? renderRatingBars(assetReviews) : ''}
        </div>
      </div>

      <!-- WRITE REVIEW FORM -->
      <div class="write-review-box" id="write-review-box">
        <h4><i class="ti ti-pencil"></i> Tulis Ulasan</h4>
        ${currentUser ? `
          <form id="form-review" onsubmit="return submitReview(event, ${asset.id})">
            <div class="star-input" id="star-input">
              <span>Rating:</span>
              <div class="star-select">
                ${[1,2,3,4,5].map(n => `<button type="button" class="star-btn" data-rating="${n}" onclick="setRating(${n})"><i class="ti ti-star"></i></button>`).join('')}
              </div>
              <input type="hidden" id="review-rating" value="0">
            </div>
            <div class="form-group">
              <textarea id="review-text" rows="3" placeholder="Ceritakan pengalaman Anda menggunakan barang ini..." required minlength="10"></textarea>
            </div>
            <button type="submit" class="btn-submit-review">
              <i class="ti ti-send"></i> Kirim Ulasan
            </button>
          </form>
        ` : `
          <div class="review-login-prompt">
            <i class="ti ti-lock"></i>
            <p>Silakan <button class="btn-auth-toggle" onclick="navTo('login')">masuk</button> untuk menulis ulasan.</p>
          </div>
        `}
      </div>

      <!-- REVIEWS LIST -->
      <div class="reviews-list" id="reviews-list-${asset.id}">
        ${assetReviews.length > 0 ? assetReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(r => renderReviewCard(r)).join('') : `
          <div class="no-reviews">
            <i class="ti ti-message-off"></i>
            <p>Belum ada ulasan untuk barang ini. Jadilah yang pertama!</p>
          </div>
        `}
      </div>
    </div>
  `;

  navTo('detail');
}


// --- CART & WISHLIST MODULE ---
function addToCart(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset || asset.status !== 'Tersedia') return;

  const existing = cartItems.find(c => c.id === id);
  if (existing) {
    showToast('Barang ini sudah ada di keranjang.', 'error');
    return;
  }

  cartItems.push({
    id: asset.id,
    nama: asset.nama,
    tarif: asset.tarif,
    foto: asset.foto || '📦',
    kat: asset.kat,
    tglMulai: today(),
    tglSelesai: tomorrow()
  });

  saveCartLocal();
  updateCartBadge();
  showToast(`${asset.nama} ditambahkan ke keranjang!`, 'success');
}

function removeFromCart(id) {
  cartItems = cartItems.filter(c => c.id !== id);
  saveCartLocal();
  updateCartBadge();
  renderCart();
  showToast('Barang dihapus dari keranjang.', 'success');
}

function updateCartDate(id, field, value) {
  const item = cartItems.find(c => c.id === id);
  if (item) {
    item[field] = value;
    saveCartLocal();
    renderCart();
  }
}

function clearCart() {
  if (cartItems.length === 0) return;
  if (confirm('Hapus semua barang dari keranjang?')) {
    cartItems = [];
    saveCartLocal();
    updateCartBadge();
    renderCart();
    showToast('Keranjang dikosongkan.', 'success');
  }
}

function getCartTotal() {
  return cartItems.reduce((sum, item) => {
    const days = calcDays(item.tglMulai, item.tglSelesai);
    return sum + (days * item.tarif);
  }, 0);
}

function calcDays(start, end) {
  if (!start || !end) return 1;
  const diff = Math.ceil((new Date(end) - new Date(start)) / (1000 * 3600 * 24));
  return Math.max(1, diff);
}

// --- WISHLIST ---
function addToWishlist(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;

  const existing = wishlistItems.find(w => w.id === id);
  if (existing) {
    // Toggle: remove if already in wishlist
    wishlistItems = wishlistItems.filter(w => w.id !== id);
    saveWishlistLocal();
    showToast(`${asset.nama} dihapus dari wishlist.`, 'success');
  } else {
    wishlistItems.push({ id: asset.id });
    saveWishlistLocal();
    showToast(`${asset.nama} disimpan ke wishlist!`, 'success');
  }

  // Re-render if on cart page
  if (currentPage === 'keranjang') renderCart();
}

function removeFromWishlist(id) {
  wishlistItems = wishlistItems.filter(w => w.id !== id);
  saveWishlistLocal();
  renderCart();
  showToast('Dihapus dari wishlist.', 'success');
}

function moveWishlistToCart(id) {
  const asset = assets.find(a => a.id === id);
  if (!asset) return;
  if (asset.status !== 'Tersedia') {
    showToast('Barang ini sedang tidak tersedia.', 'error');
    return;
  }
  // Remove from wishlist
  wishlistItems = wishlistItems.filter(w => w.id !== id);
  saveWishlistLocal();
  // Add to cart
  addToCart(id);
  renderCart();
}

function isInWishlist(id) {
  return wishlistItems.some(w => w.id === id);
}

// --- CART BADGE ---
function updateCartBadge() {
  const count = cartItems.length;
  const badge = document.getElementById('cart-badge');
  const bottomBadge = document.getElementById('bottom-cart-badge');
  if (badge) badge.textContent = count;
  if (bottomBadge) bottomBadge.textContent = count;
}

// --- LOCAL STORAGE ---
function saveCartLocal() {
  localStorage.setItem('camptrack_cart', JSON.stringify(cartItems));
}
function loadCartLocal() {
  const saved = localStorage.getItem('camptrack_cart');
  if (saved) { try { cartItems = JSON.parse(saved); } catch(e) { cartItems = []; } }
}
function saveWishlistLocal() {
  localStorage.setItem('camptrack_wishlist', JSON.stringify(wishlistItems));
}
function loadWishlistLocal() {
  const saved = localStorage.getItem('camptrack_wishlist');
  if (saved) { try { wishlistItems = JSON.parse(saved); } catch(e) { wishlistItems = []; } }
}

// --- RENDER CART PAGE ---
function renderCart() {
  const cartContent = document.getElementById('cart-items-list');
  const wishContent = document.getElementById('wishlist-items-list');
  const summaryEl = document.getElementById('cart-summary');
  if (!cartContent) return;

  // CART TAB
  if (cartItems.length === 0) {
    cartContent.innerHTML = `
      <div class="cart-empty">
        <i class="ti ti-shopping-cart-off"></i>
        <h3>Keranjang Kosong</h3>
        <p>Belum ada barang di keranjang. Yuk cari alat kemping!</p>
        <button class="btn-primary-lg" onclick="navTo('katalog')"><i class="ti ti-backpack"></i> Lihat Katalog</button>
      </div>`;
    if (summaryEl) summaryEl.style.display = 'none';
  } else {
    cartContent.innerHTML = cartItems.map(item => {
      const days = calcDays(item.tglMulai, item.tglSelesai);
      const subtotal = days * item.tarif;
      return `
        <div class="cart-item">
          <div class="cart-item-img">${item.foto}</div>
          <div class="cart-item-info">
            <div class="cart-item-name">${item.nama}</div>
            <div class="cart-item-price">${idr(item.tarif)} <small>/hari</small></div>
            <div class="cart-item-dates">
              <div class="cart-date-group">
                <label>Mulai</label>
                <input type="date" value="${item.tglMulai}" min="${today()}"
                  onchange="updateCartDate(${item.id}, 'tglMulai', this.value)">
              </div>
              <div class="cart-date-group">
                <label>Selesai</label>
                <input type="date" value="${item.tglSelesai}" min="${item.tglMulai || today()}"
                  onchange="updateCartDate(${item.id}, 'tglSelesai', this.value)">
              </div>
            </div>
            <div class="cart-item-subtotal">
              <span>${days} hari × ${idr(item.tarif)} =</span>
              <strong>${idr(subtotal)}</strong>
            </div>
          </div>
          <div class="cart-item-actions">
            <button class="btn-cart-action" onclick="addToWishlist(${item.id})" title="Simpan ke wishlist">
              <i class="ti ti-heart"></i>
            </button>
            <button class="btn-cart-action danger" onclick="removeFromCart(${item.id})" title="Hapus">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </div>`;
    }).join('');

    // SUMMARY
    if (summaryEl) {
      summaryEl.style.display = 'block';
      const totalDays = cartItems.reduce((s, i) => s + calcDays(i.tglMulai, i.tglSelesai), 0);
      const grandTotal = getCartTotal();
      summaryEl.innerHTML = `
        <div class="summary-row"><span>Total Barang</span><strong>${cartItems.length} item</strong></div>
        <div class="summary-row"><span>Total Durasi</span><strong>${totalDays} hari</strong></div>
        <div class="summary-divider"></div>
        <div class="summary-row total"><span>Grand Total</span><strong>${idr(grandTotal)}</strong></div>
        <button class="btn-checkout" onclick="handleCheckout()">
          <i class="ti ti-credit-card"></i> Checkout Sekarang
        </button>
        <button class="btn-clear-cart" onclick="clearCart()">
          <i class="ti ti-trash"></i> Kosongkan Keranjang
        </button>`;
    }
  }

  // WISHLIST TAB
  if (wishContent) {
    if (wishlistItems.length === 0) {
      wishContent.innerHTML = `
        <div class="cart-empty">
          <i class="ti ti-heart-off"></i>
          <h3>Wishlist Kosong</h3>
          <p>Simpan barang yang Anda incar untuk nanti!</p>
          <button class="btn-primary-lg" onclick="navTo('katalog')"><i class="ti ti-backpack"></i> Lihat Katalog</button>
        </div>`;
    } else {
      wishContent.innerHTML = wishlistItems.map(w => {
        const asset = assets.find(a => a.id === w.id);
        if (!asset) return '';
        const isAvail = asset.status === 'Tersedia';
        return `
          <div class="wishlist-item">
            <div class="wishlist-item-img">${asset.foto || '📦'}</div>
            <div class="wishlist-item-info">
              <div class="wishlist-item-name">${asset.nama}</div>
              <div class="wishlist-item-price">${idr(asset.tarif)}/hari</div>
              <span class="wishlist-status ${isAvail ? 'avail' : 'not-avail'}">
                ${isAvail ? 'Tersedia' : asset.status}
              </span>
            </div>
            <div class="wishlist-item-actions">
              <button class="btn-cart-action primary" onclick="moveWishlistToCart(${asset.id})" title="Pindah ke keranjang" ${!isAvail ? 'disabled' : ''}>
                <i class="ti ti-shopping-cart-plus"></i>
              </button>
              <button class="btn-cart-action danger" onclick="removeFromWishlist(${asset.id})" title="Hapus">
                <i class="ti ti-x"></i>
              </button>
            </div>
          </div>`;
      }).join('');
    }
  }

  // Update tab counters
  const cartTab = document.getElementById('tab-cart-count');
  const wishTab = document.getElementById('tab-wish-count');
  if (cartTab) cartTab.textContent = cartItems.length;
  if (wishTab) wishTab.textContent = wishlistItems.length;
}

function switchCartTab(tab) {
  document.querySelectorAll('.cart-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.cart-tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.cart-tab-btn[data-tab="${tab}"]`)?.classList.add('active');
  document.getElementById('tab-content-' + tab)?.classList.add('active');
}

// --- CHECKOUT & ORDER MODULE ---
let orders = []; // { id, items, totalBiaya, status, statusBayar, metodeBayar, catatan, createdAt }

function generateOrderId() {
  const now = new Date();
  const date = now.toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(Math.random() * 900) + 100;
  return `ORD-${date}-${rand}`;
}

function handleCheckout() {
  if (!currentUser) {
    showToast('Silakan masuk untuk melanjutkan checkout.', 'error');
    navTo('login');
    return;
  }
  if (cartItems.length === 0) {
    showToast('Keranjang kosong!', 'error');
    return;
  }
  // Navigate to checkout page and render
  renderCheckoutPage();
  navTo('checkout');
}

function renderCheckoutPage() {
  const el = document.getElementById('checkout-content');
  if (!el) return;

  const grandTotal = getCartTotal();

  el.innerHTML = `
    <div class="checkout-layout">
      <div class="checkout-items-section">
        <h3><i class="ti ti-list-check"></i> Ringkasan Pesanan</h3>
        <div class="checkout-items">
          ${cartItems.map(item => {
            const days = calcDays(item.tglMulai, item.tglSelesai);
            const sub = days * item.tarif;
            return `
              <div class="checkout-item-row">
                <span class="checkout-item-emoji">${item.foto}</span>
                <div class="checkout-item-detail">
                  <strong>${item.nama}</strong>
                  <small>${days} hari (${item.tglMulai} s/d ${item.tglSelesai}) × ${idr(item.tarif)}</small>
                </div>
                <span class="checkout-item-sub">${idr(sub)}</span>
              </div>`;
          }).join('')}
        </div>
        <div class="checkout-total-row">
          <span>Total (${cartItems.length} item)</span>
          <strong>${idr(grandTotal)}</strong>
        </div>
      </div>

      <div class="checkout-form-section">
        <h3><i class="ti ti-file-text"></i> Detail Pemesanan</h3>
        <form id="form-checkout" onsubmit="return submitOrder(event)">
          <div class="form-group">
            <label>Nama Pemesan</label>
            <input type="text" id="co-nama" value="${currentUser ? currentUser.nama : ''}" readonly>
          </div>
          <div class="form-group">
            <label>No. HP / WhatsApp</label>
            <input type="text" id="co-hp" value="${currentUser ? currentUser.hp : ''}" readonly>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="text" id="co-email" value="${currentUser ? currentUser.email : ''}" readonly>
          </div>
          <div class="form-group">
            <label>Metode Pembayaran</label>
            <select id="co-metode" required>
              <option value="QRIS">QRIS</option>
              <option value="Transfer BCA">Transfer BCA</option>
              <option value="GoPay">GoPay</option>
              <option value="OVO">OVO</option>
              <option value="DANA">DANA</option>
              <option value="Tunai di Toko">Tunai di Toko</option>
            </select>
          </div>
          <div class="form-group">
            <label>Catatan (opsional)</label>
            <textarea id="co-catatan" rows="2" placeholder="Misal: mau ambil sore jam 4..."></textarea>
          </div>
          <div class="checkout-agree">
            <input type="checkbox" id="co-agree" required>
            <label for="co-agree">Saya setuju dengan syarat & ketentuan penyewaan CampTrack</label>
          </div>
          <button type="submit" class="btn-checkout" id="btn-submit-order">
            <i class="ti ti-send"></i> Konfirmasi Pesanan
          </button>
          <button type="button" class="btn-clear-cart" onclick="navTo('keranjang')">
            <i class="ti ti-arrow-left"></i> Kembali ke Keranjang
          </button>
        </form>
      </div>
    </div>
  `;
}

async function submitOrder(event) {
  event.preventDefault();

  const metode = document.getElementById('co-metode').value;
  const catatan = document.getElementById('co-catatan').value.trim();
  const agree = document.getElementById('co-agree').checked;

  if (!agree) {
    showToast('Centang persetujuan syarat & ketentuan.', 'error');
    return false;
  }

  const orderId = generateOrderId();
  const grandTotal = getCartTotal();

  const orderData = {
    id: orderId,
    customerId: currentUser.id,
    customerName: currentUser.nama,
    customerHp: currentUser.hp,
    customerEmail: currentUser.email,
    items: cartItems.map(item => ({
      asetId: item.id,
      nama: item.nama,
      tarif: item.tarif,
      tglMulai: item.tglMulai,
      tglSelesai: item.tglSelesai,
      hari: calcDays(item.tglMulai, item.tglSelesai),
      subtotal: calcDays(item.tglMulai, item.tglSelesai) * item.tarif
    })),
    totalBiaya: grandTotal,
    metodeBayar: metode,
    catatan: catatan,
    status: 'Menunggu Pembayaran',
    statusBayar: 'Belum Bayar',
    createdAt: new Date().toISOString()
  };

  const btnSubmit = document.getElementById('btn-submit-order');
  btnSubmit.disabled = true;
  btnSubmit.innerHTML = '<div class="spinner-loader" style="width:20px;height:20px;border-width:2px"></div> Memproses...';

  try {
    const payload = {
      action: 'create_order',
      data: orderData
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Save order locally
      orders.push(orderData);
      saveOrdersLocal();
      // Clear cart
      cartItems = [];
      saveCartLocal();
      updateCartBadge();
      // Show confirmation
      showOrderConfirmation(orderData);
      showToast('Pesanan berhasil dibuat!', 'success');
    } else {
      showToast(result.message || 'Gagal membuat pesanan.', 'error');
    }
  } catch (error) {
    console.error('Order Error:', error);
    // Fallback: save locally
    orders.push(orderData);
    saveOrdersLocal();
    cartItems = [];
    saveCartLocal();
    updateCartBadge();
    showOrderConfirmation(orderData);
    showToast('Pesanan disimpan (mode lokal).', 'success');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = '<i class="ti ti-send"></i> Konfirmasi Pesanan';
  }

  return false;
}

function showOrderConfirmation(order) {
  const el = document.getElementById('checkout-content');
  if (!el) return;

  el.innerHTML = `
    <div class="order-confirm">
      <div class="confirm-icon"><i class="ti ti-circle-check"></i></div>
      <h2>Pesanan Berhasil!</h2>
      <p>Pesanan Anda telah diterima dan menunggu pembayaran.</p>

      <div class="confirm-order-id">
        <span>Nomor Pesanan</span>
        <strong>${order.id}</strong>
      </div>

      <div class="confirm-details">
        <div class="confirm-row"><span>Total Tagihan</span><strong>${idr(order.totalBiaya)}</strong></div>
        <div class="confirm-row"><span>Metode Bayar</span><strong>${order.metodeBayar}</strong></div>
        <div class="confirm-row"><span>Status</span><span class="badge-status pending">${order.status}</span></div>
      </div>

      ${order.metodeBayar !== 'Tunai di Toko' ? `
        <div class="confirm-qr">
          <h4>Scan untuk Membayar</h4>
          <div class="qr-placeholder">
            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" width="160" height="160">
              <rect width="200" height="200" fill="#ffffff" rx="12"/>
              <rect x="20" y="20" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
              <rect x="30" y="30" width="20" height="20" fill="#2d6a4f" rx="2"/>
              <rect x="140" y="20" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
              <rect x="150" y="30" width="20" height="20" fill="#2d6a4f" rx="2"/>
              <rect x="20" y="140" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
              <rect x="30" y="150" width="20" height="20" fill="#2d6a4f" rx="2"/>
              <path d="M80 30 h40 v20 h-20 v20 h20 v20 h-40 z M30 80 h20 v40 h-20 z M150 80 h20 v60 h-20 z M80 150 h50 v20 h-50 z M110 110 h40 v20 h-40 z" fill="#1a3a2a" opacity="0.8"/>
            </svg>
            <span class="qr-label-text">CAMPTRACK · ${order.metodeBayar}</span>
          </div>
          <p class="qr-note">Bayar dalam <strong>2 jam</strong> atau pesanan otomatis dibatalkan.</p>
        </div>
      ` : `
        <div class="confirm-info-box">
          <i class="ti ti-info-circle"></i>
          <p>Silakan datang ke toko dan bayar saat pengambilan barang.<br><strong>Alamat:</strong> Jl. Gunung Slamet No. 42, Purwokerto</p>
        </div>
      `}

      <div class="confirm-actions">
        <button class="btn-primary-lg" onclick="navTo('pesanan')"><i class="ti ti-package"></i> Lihat Pesanan Saya</button>
        <button class="btn-outline-lg" onclick="navTo('katalog')" style="color:var(--primary);border-color:var(--primary)"><i class="ti ti-backpack"></i> Lanjut Belanja</button>
      </div>
    </div>
  `;
}

// --- ORDER TRACKING ---
function renderOrders() {
  const el = document.getElementById('orders-list');
  const guestEl = document.getElementById('pesanan-guest');
  const contentEl = document.getElementById('pesanan-content');
  if (!el) return;

  if (!currentUser) {
    if (contentEl) contentEl.style.display = 'none';
    if (guestEl) guestEl.style.display = 'block';
    return;
  }

  if (contentEl) contentEl.style.display = 'block';
  if (guestEl) guestEl.style.display = 'none';

  // Filter orders for current user
  const myOrders = orders.filter(o => String(o.customerId) === String(currentUser.id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (myOrders.length === 0) {
    el.innerHTML = `
      <div class="cart-empty">
        <i class="ti ti-package-off"></i>
        <h3>Belum Ada Pesanan</h3>
        <p>Anda belum pernah memesan. Yuk mulai sewa alat kemping!</p>
        <button class="btn-primary-lg" onclick="navTo('katalog')"><i class="ti ti-backpack"></i> Lihat Katalog</button>
      </div>`;
    return;
  }

  el.innerHTML = myOrders.map(order => {
    const statusClass = getStatusClass(order.status);
    const date = new Date(order.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const itemNames = order.items.map(i => i.nama).join(', ');

    return `
      <div class="order-card">
        <div class="order-card-header">
          <div class="order-id-badge">${order.id}</div>
          <span class="badge-status ${statusClass}">${order.status}</span>
        </div>
        <div class="order-card-body">
          <div class="order-items-preview">
            <i class="ti ti-backpack"></i> ${itemNames}
          </div>
          <div class="order-card-meta">
            <span><i class="ti ti-calendar"></i> ${date}</span>
            <span><i class="ti ti-credit-card"></i> ${order.metodeBayar}</span>
          </div>
        </div>
        <div class="order-card-footer">
          <div class="order-total">
            <span>Total</span>
            <strong>${idr(order.totalBiaya)}</strong>
          </div>
          <div class="order-timeline">
            ${renderTimeline(order.status)}
          </div>
        </div>
      </div>`;
  }).join('');
}

function getStatusClass(status) {
  switch(status) {
    case 'Menunggu Pembayaran': return 'pending';
    case 'Menunggu Konfirmasi': return 'waiting';
    case 'Dikonfirmasi': return 'confirmed';
    case 'Diambil': return 'active';
    case 'Dikembalikan': return 'done';
    case 'Dibatalkan': return 'cancelled';
    default: return 'pending';
  }
}

function renderTimeline(currentStatus) {
  const steps = ['Dipesan', 'Dibayar', 'Dikonfirmasi', 'Diambil', 'Dikembalikan'];
  const statusMap = {
    'Menunggu Pembayaran': 0,
    'Menunggu Konfirmasi': 1,
    'Dikonfirmasi': 2,
    'Diambil': 3,
    'Dikembalikan': 4,
    'Dibatalkan': -1
  };
  const currentStep = statusMap[currentStatus] ?? 0;

  if (currentStep === -1) {
    return '<div class="timeline-cancelled"><i class="ti ti-x"></i> Pesanan Dibatalkan</div>';
  }

  return `<div class="timeline-steps">
    ${steps.map((step, idx) => `
      <div class="timeline-step ${idx <= currentStep ? 'done' : ''} ${idx === currentStep ? 'current' : ''}">
        <div class="timeline-dot"></div>
        <span>${step}</span>
      </div>
    `).join('')}
  </div>`;
}

// --- LOCAL ORDER STORAGE ---
function saveOrdersLocal() {
  localStorage.setItem('camptrack_orders', JSON.stringify(orders));
}
function loadOrdersLocal() {
  const saved = localStorage.getItem('camptrack_orders');
  if (saved) { try { orders = JSON.parse(saved); } catch(e) { orders = []; } }
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
  const validPages = ['beranda', 'katalog', 'keranjang', 'pesanan', 'login', 'profil', 'checkout'];
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

  // Load local reviews as fallback
  loadReviewsLocal();

  // Load cart and wishlist from localStorage
  loadCartLocal();
  loadWishlistLocal();
  loadOrdersLocal();

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
   REVIEW MODULE - Rating, Display, Submit
   ======================================== */

// --- RENDER STARS ---
function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= Math.floor(rating)) {
      html += '<i class="ti ti-star-filled star-filled"></i>';
    } else if (i - 0.5 <= rating) {
      html += '<i class="ti ti-star-half-filled star-filled"></i>';
    } else {
      html += '<i class="ti ti-star star-empty"></i>';
    }
  }
  return html;
}

// --- RENDER RATING BARS (distribution) ---
function renderRatingBars(reviewsArr) {
  const total = reviewsArr.length;
  if (total === 0) return '';

  let html = '<div class="rating-bars">';
  for (let i = 5; i >= 1; i--) {
    const count = reviewsArr.filter(r => r.rating === i).length;
    const pct = Math.round((count / total) * 100);
    html += `
      <div class="rating-bar-row">
        <span class="bar-label">${i}</span>
        <i class="ti ti-star-filled" style="font-size:12px;color:var(--accent)"></i>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <span class="bar-count">${count}</span>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

// --- RENDER SINGLE REVIEW CARD ---
function renderReviewCard(review) {
  const initial = review.userName ? review.userName.charAt(0).toUpperCase() : '?';
  const date = new Date(review.created_at).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  return `
    <div class="review-card">
      <div class="review-card-header">
        <div class="review-avatar">${initial}</div>
        <div class="review-meta">
          <strong>${review.userName}</strong>
          <span>${date}</span>
        </div>
        <div class="review-stars">${renderStars(review.rating)}</div>
      </div>
      <p class="review-text">${review.komentar}</p>
      ${review.balasan_admin ? `
        <div class="review-reply">
          <div class="reply-header"><i class="ti ti-message-reply"></i> <strong>Balasan Admin</strong></div>
          <p>${review.balasan_admin}</p>
        </div>
      ` : ''}
    </div>
  `;
}

// --- SET RATING (star input) ---
function setRating(rating) {
  document.getElementById('review-rating').value = rating;
  const stars = document.querySelectorAll('#star-input .star-btn');
  stars.forEach((btn, idx) => {
    const icon = btn.querySelector('i');
    if (idx < rating) {
      icon.className = 'ti ti-star-filled';
      btn.classList.add('active');
    } else {
      icon.className = 'ti ti-star';
      btn.classList.remove('active');
    }
  });
}

// --- SUBMIT REVIEW ---
async function submitReview(event, asetId) {
  event.preventDefault();

  if (!currentUser) {
    showToast('Silakan masuk untuk menulis ulasan.', 'error');
    navTo('login');
    return false;
  }

  const rating = parseInt(document.getElementById('review-rating').value);
  const komentar = document.getElementById('review-text').value.trim();

  if (rating === 0) {
    showToast('Pilih rating bintang terlebih dahulu!', 'error');
    return false;
  }
  if (komentar.length < 10) {
    showToast('Ulasan minimal 10 karakter.', 'error');
    return false;
  }

  // Check if user already reviewed this item
  const existing = reviews.find(r => String(r.asetId) === String(asetId) && String(r.userId) === String(currentUser.id));
  if (existing) {
    showToast('Anda sudah pernah mengulas barang ini.', 'error');
    return false;
  }

  try {
    const payload = {
      action: 'submit_review',
      data: {
        asetId: asetId,
        userId: currentUser.id,
        userName: currentUser.nama,
        rating: rating,
        komentar: komentar
      }
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const result = await response.json();

    if (result.status === 'success') {
      // Add to local state
      const newReview = {
        id: result.id || Date.now(),
        asetId: asetId,
        userId: currentUser.id,
        userName: currentUser.nama,
        rating: rating,
        komentar: komentar,
        created_at: new Date().toISOString(),
        balasan_admin: ''
      };
      reviews.push(newReview);
      showToast('Ulasan berhasil dikirim! Terima kasih.', 'success');
      openDetail(asetId); // Re-render detail page
    } else {
      showToast(result.message || 'Gagal mengirim ulasan.', 'error');
    }
  } catch (error) {
    console.error('Review Error:', error);
    // Fallback: save locally
    const newReview = {
      id: 'local_' + Date.now(),
      asetId: asetId,
      userId: currentUser.id,
      userName: currentUser.nama,
      rating: rating,
      komentar: komentar,
      created_at: new Date().toISOString(),
      balasan_admin: ''
    };
    reviews.push(newReview);
    saveReviewsLocal();
    showToast('Ulasan disimpan (mode lokal).', 'success');
    openDetail(asetId);
  }

  return false;
}

// --- LOCAL REVIEW STORAGE ---
function saveReviewsLocal() {
  localStorage.setItem('camptrack_reviews', JSON.stringify(reviews));
}

function loadReviewsLocal() {
  const saved = localStorage.getItem('camptrack_reviews');
  if (saved) {
    try {
      reviews = JSON.parse(saved);
    } catch (e) {
      reviews = [];
    }
  }
}

// --- LOAD REVIEWS FROM API ---
async function loadReviews() {
  try {
    const response = await fetch(`${API_URL}?page=reviews`);
    const result = await response.json();

    if (result.status === 'success' && result.reviews) {
      reviews = result.reviews.map(r => ({
        id: r.id_review || r.id,
        asetId: r.id_aset || r.asetId,
        userId: r.id_customer || r.userId,
        userName: r.nama || r.userName,
        rating: Number(r.rating),
        komentar: r.komentar,
        created_at: r.created_at,
        balasan_admin: r.balasan_admin || ''
      }));
    }
  } catch (error) {
    console.log('Reviews API unavailable, using local data.');
    loadReviewsLocal();
  }
}

// --- GET AVERAGE RATING FOR ASSET ---
function getAssetRating(asetId) {
  const assetReviews = reviews.filter(r => String(r.asetId) === String(asetId));
  if (assetReviews.length === 0) return { avg: 0, count: 0 };
  const avg = assetReviews.reduce((sum, r) => sum + r.rating, 0) / assetReviews.length;
  return { avg: parseFloat(avg.toFixed(1)), count: assetReviews.length };
}


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
