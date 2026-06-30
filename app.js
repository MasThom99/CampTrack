const API_URL = "https://script.google.com/macros/s/AKfycbwfB6btiYTyECs_XXGu2j3Ojy8JvICAAm5Y7CswdbfnlJxpjcWnwIH4dDayvFL-sC-K/exec";

const idr = v => 'Rp ' + Math.round(v).toLocaleString('id-ID');
const today = () => new Date().toISOString().slice(0,10);
const nowDT = () => { const n=new Date(); return n.toISOString().slice(0,16); };
const fmtDate = d => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '-';
const fmtDT = d => d ? new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';

// DATA (Sudah dikosongkan untuk menunggu data dari Google Sheets)
let assets = [];
let loans = [];
let history = [];

let nextAsetId = 9;
let nextLoanId = 2;
let nextHistId = 2;
let selectedPay = 'QRIS';
let currentEditId = null;

// --- FUNGSI KOMUNIKASI API ---
async function fetchFromAPI(pageParam) {
  document.getElementById('global-loader').style.display = 'flex';
  try {
    const response = await fetch(`${API_URL}?page=${pageParam}`);
    const result = await response.json();
    if (result.status === "success") return result;
    alert("Gagal mengambil data: " + result.message);
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    alert("Terjadi kesalahan jaringan.");
    return null;
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

async function loadInitialData() {
  const data = await fetchFromAPI('dashboard');
  if (data) {
    // Mapping Data
    assets = data.assets.map(item => ({
      id: item.id_aset, kode: item.kode, nama: item.nama_barang,
      kat: item.kategori, tarif: item.tarif, status: item.status,
      foto: item.foto, desc: item.deskripsi
    }));
    
    let allTransactions = data.transactions.map(item => ({
      id: item.id_transaksi, nama: item.nama_peminjam, hp: item.no_hp,
      asetId: item.id_aset, tglPinjam: item.tgl_pinjam, tglKembali: item.batas_kembali,
      tglAktual: item.tgl_aktual, biaya: item.biaya, denda: item.denda,
      kondisi: item.kondisi, status: item.status_transaksi, catatan: item.catatan
    }));
    
    loans = allTransactions.filter(t => t.status === 'Dipinjam');
    history = allTransactions.filter(t => t.status !== 'Dipinjam');
    
    renderDashboard(); renderAset(); renderPinjam(); renderKembali(); renderRiwayat(); renderQROptions();
  }
}

// NAV
function nav(page) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.getElementById('nav-'+page).classList.add('active');
  if(page==='dashboard') renderDashboard();
  if(page==='aset') renderAset();
  if(page==='pinjam') renderPinjam();
  if(page==='kembali') renderKembali();
  if(page==='riwayat') renderRiwayat();
  if(page==='qr') renderQR();
  if(page==='orders') loadOnlineOrders();
}

// LOGIN
function doLogin(){
  const u=document.getElementById('login-user').value;
  const p=document.getElementById('login-pass').value;
  if(u==='admin'&&p==='admin123'){
    document.getElementById('login-page').style.display='none';
    document.getElementById('app').style.display='flex';
    
    // Panggil fungsi penyedot data, BUKAN langsung menggambar layar!
    loadInitialData(); 
  } else {
    alert('Username atau password salah!\nGunakan: admin / admin123');
  }
}
function doLogout(){
  document.getElementById('login-page').style.display='flex';
  document.getElementById('app').style.display='none';
}
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});

// MODAL
function openModal(id){document.getElementById(id).style.display='flex'}
function closeModal(id){document.getElementById(id).style.display='none'}
document.querySelectorAll('.modal-overlay').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.style.display='none'}));

// DASHBOARD
function renderDashboard(){
  const tot=assets.length;
  const av=assets.filter(a=>a.status==='Tersedia').length;
  const bo=assets.filter(a=>a.status==='Dipinjam').length;
  const da=assets.filter(a=>a.status==='Rusak').length;
  const tr=loans.length+history.length;
  document.getElementById('s-total').textContent=tot;
  document.getElementById('s-avail').textContent=av;
  document.getElementById('s-borrowed').textContent=bo;
  document.getElementById('s-damaged').textContent=da;
  document.getElementById('s-trans').textContent=tr;
  const allTx=[...loans.map(l=>({...l,src:'active'})),...history.map(h=>({...h,src:'hist'}))].slice(-5).reverse();
  const b=document.getElementById('recent-body');
  if(allTx.length===0){b.innerHTML='<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:2rem">Belum ada transaksi</td></tr>';return;}
  b.innerHTML=allTx.map(t=>{
    const aset=assets.find(a=>a.id===t.asetId)||{nama:'?'};
    const st=t.status==='Dikembalikan'?'returned':t.status==='Terlambat'?'overdue':t.status==='Dipinjam'?'borrowed':'returned';
    return `<tr>
      <td><b>${t.nama}</b><br><small style="color:var(--muted)">${t.hp}</small></td>
      <td>${aset.foto||'📦'} ${aset.nama}</td>
      <td>${fmtDate(t.tglPinjam)}</td>
      <td><span class="badge ${st}">${t.status}</span></td>
    </tr>`;
  }).join('');
}

// ASET
function renderAset(){
  const q=(document.getElementById('search-aset').value||'').toLowerCase();
  const kat=document.getElementById('filter-kat').value;
  const sta=document.getElementById('filter-stat').value;
  let data=assets.filter(a=>{
    return (!q||a.nama.toLowerCase().includes(q)||a.kode.toLowerCase().includes(q))
      &&(!kat||a.kat===kat)&&(!sta||a.status===sta);
  });
  const b=document.getElementById('aset-body');
  if(data.length===0){
    b.innerHTML='<tr><td colspan="7"><div class="empty-state"><i class="ti ti-inbox" aria-hidden="true"></i>Tidak ada barang ditemukan</div></td></tr>';
    return;
  }
  b.innerHTML=data.map(a=>{
    const sc=a.status==='Tersedia'?'available':a.status==='Dipinjam'?'borrowed':'damaged';
    return `<tr>
      <td><div class="asset-thumb" aria-hidden="true">${a.foto}</div></td>
      <td><span class="tag">${a.kode}</span></td>
      <td><b>${a.nama}</b><br><small style="color:var(--muted)">${a.desc}</small></td>
      <td><span style="font-size:12px;color:var(--muted)">${a.kat}</span></td>
      <td><b>${idr(a.tarif)}</b>/hari</td>
      <td><span class="badge ${sc}">${a.status}</span></td>
      <td><div class="btn-group">
        <button class="btn btn-sm btn-outline" onclick="editAset(${a.id})"><i class="ti ti-edit" aria-hidden="true"></i></button>
        <button class="btn btn-sm btn-danger" onclick="deleteAset(${a.id})"><i class="ti ti-trash" aria-hidden="true"></i></button>
      </div></td>
    </tr>`;
  }).join('');
}

function openAddAset(){
  currentEditId=null;
  document.getElementById('modal-aset-title').textContent='Tambah Aset Baru';
  ['a-kode','a-nama','a-foto','a-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('a-tarif').value='';
  document.getElementById('a-kat').value='Tenda & Bivak';
  document.getElementById('a-status').value='Tersedia';
  openModal('modal-aset');
}

function editAset(id){
  const a=assets.find(x=>x.id===id); if(!a)return;
  currentEditId=id;
  document.getElementById('modal-aset-title').textContent='Edit Aset';
  document.getElementById('a-kode').value=a.kode;
  document.getElementById('a-nama').value=a.nama;
  document.getElementById('a-kat').value=a.kat;
  document.getElementById('a-tarif').value=a.tarif;
  document.getElementById('a-status').value=a.status;
  document.getElementById('a-foto').value=a.foto;
  document.getElementById('a-desc').value=a.desc;
  openModal('modal-aset');
}

// --- SIMPAN ASET (MENDUKUNG CREATE & UPDATE) ---
async function saveAset(){
  const kode = document.getElementById('a-kode').value.trim();
  const nama = document.getElementById('a-nama').value.trim();
  const tarif = parseInt(document.getElementById('a-tarif').value) || 0;
  
  if(!kode || !nama || !tarif){
    alert('Lengkapi field Kode, Nama, dan Tarif!');
    return;
  }

  // Cek apakah variabel global currentEditId berisi ID (berarti mode EDIT) atau null (berarti TAMBAH BARU)
  const isEdit = currentEditId !== null;
  
  const payload = {
    action: isEdit ? "edit_aset" : "tambah_aset",
    id: currentEditId, // Mengirimkan ID lama jika mode edit
    data: {
      kode: kode,
      nama: nama,
      kat: document.getElementById('a-kat').value,
      tarif: tarif,
      status: document.getElementById('a-status').value,
      foto: document.getElementById('a-foto').value || '📦',
      desc: document.getElementById('a-desc').value
    }
  };

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      closeModal('modal-aset');
      alert('✅ ' + result.message);
      // Sinkronisasi ulang data frontend dengan database terbaru
      await loadInitialData(); 
    } else {
      alert('❌ Gagal: ' + result.message);
    }
  } catch (error) {
    console.error("Post Error:", error);
    alert('Terjadi kesalahan jaringan saat menyimpan data.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// --- HAPUS ASET (DELETE) ---
async function deleteAset(id){
  // Definisikan dialog konfirmasi demi integritas data
  if(!confirm('Apakah Anda yakin ingin menghapus aset ini dari database secara permanen?')) return;
  
  const payload = {
    action: "hapus_aset",
    id: id
  };

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      alert('✅ ' + result.message);
      // Tarik ulang data terbaru pasca eliminasi baris database
      await loadInitialData(); 
    } else {
      alert('❌ Gagal menghapus: ' + result.message);
    }
  } catch (error) {
    console.error("Delete Error:", error);
    alert('Terjadi kesalahan jaringan saat menghapus data.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// PEMINJAMAN
function renderPinjam(){
  const avail=assets.filter(a=>a.status==='Tersedia');
  const sel=document.getElementById('p-barang');
  sel.innerHTML='<option value="">-- Pilih barang --</option>';
  avail.forEach(a=>{
    const opt=document.createElement('option');
    opt.value=a.id;
    opt.textContent=`${a.foto} ${a.nama} (${idr(a.tarif)}/hari)`;
    sel.appendChild(opt);
  });
  document.getElementById('p-tgl-pinjam').value=today();
  document.getElementById('p-tgl-kembali').value='';
  renderActiveLoans();
  sel.onchange=updateEstimasi;
  document.getElementById('p-tgl-kembali').onchange=updateEstimasi;
}

function updateEstimasi(){
  const asetId=parseInt(document.getElementById('p-barang').value);
  const t1=document.getElementById('p-tgl-pinjam').value;
  const t2=document.getElementById('p-tgl-kembali').value;
  const el=document.getElementById('p-estimasi');
  if(!asetId||!t1||!t2){el.innerHTML='<span style="color:var(--muted)">Pilih barang dan tanggal untuk melihat estimasi biaya</span>';return;}
  const a=assets.find(x=>x.id===asetId);
  const days=Math.max(1,Math.ceil((new Date(t2)-new Date(t1))/(1000*3600*24)));
  const total=days*a.tarif;
  el.innerHTML=`<div style="font-size:13px;color:var(--c1)"><b>${a.nama}</b><br>
    <span style="color:var(--muted)">${days} hari × ${idr(a.tarif)} =</span>
    <b style="font-size:18px;color:var(--c2);font-family:'Syne',sans-serif"> ${idr(total)}</b>
    <br><small style="color:var(--muted)">Denda keterlambatan: <b>Rp 5.000/jam</b></small>
  </div>`;
}

// --- PROSES PEMINJAMAN (CREATE TRANSACTION) ---
async function doPinjam(){
  const nama = document.getElementById('p-nama').value.trim();
  const hp = document.getElementById('p-hp').value.trim();
  const asetId = parseInt(document.getElementById('p-barang').value);
  const t1 = document.getElementById('p-tgl-pinjam').value;
  const t2 = document.getElementById('p-tgl-kembali').value;
  const catatan = document.getElementById('p-catatan').value;
  
  // Validasi Input
  if(!nama || !hp || !asetId || !t1 || !t2){
    alert('Lengkapi semua field form peminjaman!');
    return;
  }
  if(new Date(t2) <= new Date(t1)){
    alert('Tanggal kembali harus setelah tanggal pinjam!');
    return;
  }
  
  // Hitung total biaya di frontend
  const aset = assets.find(a => a.id === asetId);
  const days = Math.ceil((new Date(t2) - new Date(t1)) / (1000 * 3600 * 24));
  const totalBiaya = days * aset.tarif;
  
  // Bungkus data untuk dikirim ke server
  const payload = {
    action: "tambah_peminjaman",
    data: {
      nama: nama,
      hp: hp,
      asetId: asetId,
      tglPinjam: t1,
      tglKembali: t2,
      biaya: totalBiaya,
      catatan: catatan
    }
  };
  
  document.getElementById('global-loader').style.display = 'flex';
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });
    
    const result = await response.json();
    
    if(result.status === "success") {
      alert('✅ ' + result.message);
      
      // Kosongkan form kembali seperti semula
      document.getElementById('p-nama').value = '';
      document.getElementById('p-hp').value = '';
      document.getElementById('p-barang').value = '';
      document.getElementById('p-tgl-kembali').value = '';
      document.getElementById('p-catatan').value = '';
      document.getElementById('p-estimasi').innerHTML = '<span style="color:var(--muted)">Pilih barang dan tanggal untuk melihat estimasi biaya</span>';
      
      // Trik Sakti: Panggil ulang data dari database agar layar tersinkronisasi otomatis
      await loadInitialData();
    } else {
      alert('❌ Gagal memproses peminjaman: ' + result.message);
    }
  } catch (error) {
    console.error("Tx Error:", error);
    alert('Terjadi kesalahan jaringan saat mengirim transaksi.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

function renderActiveLoans(){
  const el=document.getElementById('active-loans');
  if(loans.length===0){el.innerHTML='<div class="empty-state"><i class="ti ti-mood-happy" aria-hidden="true"></i>Tidak ada peminjaman aktif</div>';return;}
  el.innerHTML=loans.map(l=>{
    const a=assets.find(x=>x.id===l.asetId)||{nama:'?',foto:'📦'};
    const over=new Date()>new Date(l.tglKembali);
    return `<div style="padding:.875rem;border:1px solid var(--border);border-radius:var(--rad2);margin-bottom:.75rem;background:${over?'#fff8f5':'#f8fdf9'}">
      <div style="display:flex;justify-content:space-between;align-items:start">
        <div>
          <b style="font-size:14px">${a.foto} ${a.nama}</b>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">${l.nama} · ${l.hp}</div>
        </div>
        ${over?`<span class="badge overdue">Terlambat</span>`:`<span class="badge borrowed">Aktif</span>`}
      </div>
      <div style="font-size:12px;color:var(--muted);margin-top:.5rem">
        📅 ${fmtDate(l.tglPinjam)} → ${fmtDate(l.tglKembali)} · <b style="color:var(--c2)">${idr(l.biaya)}</b>
      </div>
    </div>`;
  }).join('');
}

// PENGEMBALIAN
// --- PENGEMBALIAN ---
function renderKembali(){
  const el=document.getElementById('return-list');
  if(loans.length===0){el.innerHTML='<div class="empty-state"><i class="ti ti-package-off" aria-hidden="true"></i>Tidak ada peminjaman aktif untuk dikembalikan</div>';return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Peminjam</th><th>Barang</th><th>Tgl Pinjam</th><th>Batas Kembali</th><th>Biaya</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>${loans.map(l=>{
      // Diperbaiki: Menggunakan String() agar kebal terhadap bentrok tipe data
      const a=assets.find(x=>String(x.id)===String(l.asetId))||{nama:'?',foto:'📦'};
      const over=new Date()>new Date(l.tglKembali);
      const sc=over?'overdue':'borrowed';
      const sl=over?'Terlambat!':'Aktif';
      return `<tr>
        <td><b>${l.nama}</b><br><small style="color:var(--muted)">${l.hp}</small></td>
        <td>${a.foto} ${a.nama}</td>
        <td>${fmtDate(l.tglPinjam)}</td>
        <td style="color:${over?'#e63946':'inherit'}">${fmtDate(l.tglKembali)}</td>
        <td>${idr(l.biaya)}</td>
        <td><span class="badge ${sc}">${sl}</span></td>
        <td><button class="btn btn-sm btn-acc" onclick="openReturn('${l.id}')"><i class="ti ti-arrow-bar-to-left" aria-hidden="true"></i> Kembalikan</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function openReturn(id){
  // Diperbaiki: Ubah semua id jadi String agar cocok
  const l=loans.find(x=>String(x.id)===String(id)); 
  if(!l) return;
  const a=assets.find(x=>String(x.id)===String(l.asetId))||{nama:'?',foto:'📦',tarif:0};
  
  document.getElementById('ret-id').value=id;
  document.getElementById('ret-tgl').value=nowDT();
  document.getElementById('ret-kondisi').value='Baik';
  
  const over=new Date()>new Date(l.tglKembali);
  document.getElementById('ret-info').innerHTML=`
    <div class="card" style="background:var(--c5);border:none;margin-bottom:0">
      <div class="info-row"><i class="ti ti-user" aria-hidden="true"></i><b>${l.nama}</b> (${l.hp})</div>
      <div class="info-row"><i class="ti ti-backpack" aria-hidden="true"></i>${a.foto} <b>${a.nama}</b></div>
      <div class="info-row"><i class="ti ti-calendar" aria-hidden="true"></i>Batas kembali: <b style="color:${over?'#e63946':'var(--c2)'}">${fmtDate(l.tglKembali)}</b></div>
      <div class="info-row"><i class="ti ti-receipt" aria-hidden="true"></i>Biaya sewa: <b>${idr(l.biaya)}</b></div>
    </div>`;
  
  document.getElementById('ret-denda-box').style.display='none';
  document.getElementById('ret-tgl').onchange=calcDenda;
  openModal('modal-return');
  calcDenda();
}

// --- FUNGSI KALKULASI DENDA (DIPERBAIKI) ---
function calcDenda(){
  const id=document.getElementById('ret-id').value;
  const l=loans.find(x=>String(x.id)===String(id)); 
  if(!l) return;
  
  const retDT=new Date(document.getElementById('ret-tgl').value);
  
  // DIPERBAIKI: Menggunakan setter kalender asli, bukan tempel teks
  const batas = new Date(l.tglKembali);
  batas.setHours(23, 59, 59, 999); 
  
  const box=document.getElementById('ret-denda-box');
  
  if(retDT > batas){
    const hours = Math.ceil((retDT - batas) / (1000 * 3600));
    const denda = hours * 5000;
    box.style.display='block';
    box.innerHTML=`<div class="denda-badge"><i class="ti ti-clock-exclamation" aria-hidden="true"></i>
      Terlambat <b>${hours} jam</b> · Denda: <b>${idr(denda)}</b> (Rp 5.000/jam)
    </div>`;
  } else {
    box.style.display='none';
  }
}

// --- FUNGSI SIMPAN PENGEMBALIAN (DIPERBAIKI) ---
async function saveReturn(){
  const id = document.getElementById('ret-id').value;
  const l = loans.find(x => String(x.id) === String(id)); 
  if(!l) return;

  const retDT = new Date(document.getElementById('ret-tgl').value);
  
  // DIPERBAIKI JAGA DI SINI
  const batas = new Date(l.tglKembali);
  batas.setHours(23, 59, 59, 999);
  
  const kondisi = document.getElementById('ret-kondisi').value;
  
  let denda = 0;
  let terlambat = false;
  if(retDT > batas){
    const hours = Math.ceil((retDT - batas) / (1000 * 3600));
    denda = hours * 5000;
    terlambat = true;
  }
  
  const statusTx = terlambat ? 'Terlambat' : 'Dikembalikan';
  
  const payload = {
    action: "proses_pengembalian",
    data: {
      idTransaksi: l.id,
      idAset: l.asetId,
      tglAktual: document.getElementById('ret-tgl').value,
      denda: denda,
      kondisi: kondisi,
      status: statusTx
    }
  };

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      closeModal('modal-return');
      const msg = denda > 0 ? `✅ Barang dikembalikan.\n⚠️ Denda keterlambatan: ${idr(denda)}` : '✅ Barang berhasil dikembalikan tepat waktu!';
      alert(msg);
      await loadInitialData();
    } else {
      alert('❌ Gagal memproses pengembalian: ' + result.message);
    }
  } catch (error) {
    console.error("Return Error:", error);
    alert('Terjadi kesalahan jaringan saat memproses pengembalian.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// RIWAYAT
function renderRiwayat(){
  const q=(document.getElementById('search-riwayat').value||'').toLowerCase();
  const fs=document.getElementById('filter-riwayat').value;
  let data=[...history].filter(h=>{
    const a=assets.find(x=>x.id===h.asetId)||{nama:''};
    return(!q||h.nama.toLowerCase().includes(q)||a.nama.toLowerCase().includes(q))
      &&(!fs||h.status===fs);
  }).reverse();
  const b=document.getElementById('riwayat-body');
  if(data.length===0){b.innerHTML='<tr><td colspan="9"><div class="empty-state"><i class="ti ti-history" aria-hidden="true"></i>Belum ada riwayat</div></td></tr>';return;}
  b.innerHTML=data.map(h=>{
    const a=assets.find(x=>x.id===h.asetId)||{nama:'?',foto:'📦'};
    const sc=h.status==='Dikembalikan'?'returned':'overdue';
    return `<tr>
      <td><span class="tag">${h.id}</span></td>
      <td><b>${h.nama}</b><br><small style="color:var(--muted)">${h.hp}</small></td>
      <td>${a.foto} ${a.nama}</td>
      <td>${fmtDate(h.tglPinjam)}</td>
      <td>${fmtDate(h.tglKembali)}</td>
      <td>${h.tglAktual?fmtDT(h.tglAktual):'-'}</td>
      <td>${idr(h.biaya)}</td>
      <td>${h.denda>0?`<span class="denda-badge" style="font-size:11px;padding:.2rem .5rem">${idr(h.denda)}</span>`:'<span style="color:var(--c3);font-size:12px">—</span>'}</td>
      <td><span class="badge ${sc}">${h.status}</span></td>
    </tr>`;
  }).join('');
}

// QR
let qrPayMethod = 'QRIS';
function selectPay(name, el){
  document.querySelectorAll('.pay-card').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  qrPayMethod=name;
  updateQR();
  generateQR();
}

// --- RENDER DROPDOWN QR (TAMPILAN LEBIH CANTIK) ---
function renderQROptions() {
  const select = document.getElementById('qr-trans');
  if (!select) return;

  // Deteksi nama penampung data
  let dataTx = typeof allTransactions !== 'undefined' ? allTransactions : (typeof transactions !== 'undefined' ? transactions : (typeof loans !== 'undefined' ? loans : []));

  // Saring transaksi yang belum lunas
  const unpaidTx = dataTx.filter(tx => {
    const statusPay = tx.status_pembayaran || tx.statusPembayaran || '';
    return statusPay.toLowerCase() !== 'lunas';
  });

  if (unpaidTx.length === 0) {
    select.innerHTML = '<option value="">-- Tidak ada tagihan menunggak --</option>';
  } else {
    select.innerHTML = '<option value="">-- Pilih peminjaman --</option>' + unpaidTx.map(tx => {
      const txId = tx.id || tx.id_transaksi || tx.idTransaksi;
      const txNama = tx.nama || tx.nama_peminjam || tx.namaPeminjam || 'Tanpa Nama';
      
      // Cari nama barang agar dropdown tampil elegan
      const a = assets.find(x => String(x.id) === String(tx.asetId)) || {nama: 'Barang'};
      
      // Hasilnya misal: "Agus — Kompor Portable"
      return `<option value="${txId}">${txNama} — ${a.nama}</option>`;
    }).join('');
  }
  
  document.getElementById('qr-amount').innerHTML = 'Pilih transaksi untuk melihat total tagihan';
  document.getElementById('qr-total').innerText = 'Rp 0';
  document.getElementById('qr-info').innerText = 'Pilih transaksi terlebih dahulu';
  document.getElementById('qr-svg').innerHTML = '';
}

// --- UPDATE TAMPILAN QR & KALKULASI DENDA REAL-TIME ---
function updateQR() {
  const selectedId = document.getElementById('qr-trans').value;
  let dataTx = typeof allTransactions !== 'undefined' ? allTransactions : (typeof transactions !== 'undefined' ? transactions : (typeof loans !== 'undefined' ? loans : []));

  const tx = dataTx.find(x => {
    const targetId = x.id || x.id_transaksi || x.idTransaksi;
    return String(targetId) === String(selectedId);
  });
  
  const elAmount = document.getElementById('qr-amount');
  const elTotal = document.getElementById('qr-total');
  const elInfo = document.getElementById('qr-info');
  const elSvg = document.getElementById('qr-svg');
  
  if (!tx) {
    elAmount.innerHTML = 'Pilih transaksi untuk melihat total tagihan';
    elTotal.innerText = 'Rp 0';
    elInfo.innerText = 'Pilih transaksi terlebih dahulu';
    elSvg.innerHTML = '';
    return;
  }

  // 1. AMBIL BIAYA POKOK DAN DENDA DARI DATABASE
  const biayaSewa = Number(tx.biaya) || 0;
  let denda = Number(tx.denda) || 0;

  // 2. LOGIKA REAL-TIME: Jika status barang MASIH DIPINJAM, hitung otomatis dendanya sekarang juga!
  if (tx.status === 'Dipinjam') {
    const now = new Date(); // Waktu saat ini
    const batas = new Date(tx.tglKembali);
    batas.setHours(23, 59, 59, 999);
    
    if (now > batas) {
      const hours = Math.ceil((now - batas) / (1000 * 3600));
      denda = hours * 5000; // Tarif denda Rp 5.000/jam
    }
  }

  // 3. KALKULASI TOTAL
  const totalBayar = biayaSewa + denda;
  const txNama = tx.nama || tx.nama_peminjam || 'Pelanggan';

  // 4. RENDER TAMPILAN
  let rincianHTML = `Biaya Sewa: <b style="color:var(--c1)">${idr(biayaSewa)}</b>`;
  if (denda > 0) {
    rincianHTML += `<br><span style="color:#e63946">Denda Keterlambatan: <b>+ ${idr(denda)}</b></span>`;
  }
  
  elAmount.innerHTML = rincianHTML;
  elTotal.innerText = idr(totalBayar);
  elInfo.innerText = `Tagihan untuk: ${txNama}`;

  elSvg.innerHTML = `
    <rect width="200" height="200" fill="#ffffff" rx="12"/>
    <rect x="20" y="20" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
    <rect x="30" y="30" width="20" height="20" fill="#2d6a4f" rx="2"/>
    <rect x="140" y="20" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
    <rect x="150" y="30" width="20" height="20" fill="#2d6a4f" rx="2"/>
    <rect x="20" y="140" width="40" height="40" fill="none" stroke="#2d6a4f" stroke-width="6" rx="4"/>
    <rect x="30" y="150" width="20" height="20" fill="#2d6a4f" rx="2"/>
    <path d="M80 30 h40 v20 h-20 v20 h20 v20 h-40 z M30 80 h20 v40 h-20 z M150 80 h20 v60 h-20 z M80 150 h50 v20 h-50 z M110 110 h40 v20 h-40 z" fill="#1a3a2a" opacity="0.8"/>
  `;
}

function generateQR(){
  const svg=document.getElementById('qr-svg');
  svg.innerHTML='';
  const size=200, mod=20, cell=size/mod;
  // Deterministic simple QR-like pattern
  const seed=Date.now()%1000;
  function bit(r,c){
    if(r<7&&c<7||r<7&&c>12||r>12&&c<7) return true; // finder patterns
    if(r===7||c===7) return false;
    return ((r*c+r+c+seed)%3===0);
  }
  const bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
  bg.setAttribute('width',size);bg.setAttribute('height',size);bg.setAttribute('fill','white');
  svg.appendChild(bg);
  for(let r=0;r<mod;r++) for(let c=0;c<mod;c++){
    if(bit(r,c)){
      const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');
      rect.setAttribute('x',c*cell+1);rect.setAttribute('y',r*cell+1);
      rect.setAttribute('width',cell-1);rect.setAttribute('height',cell-1);
      rect.setAttribute('fill','#1a3a2a');rect.setAttribute('rx','1');
      svg.appendChild(rect);
    }
  }
  // Center logo
  const cx=document.createElementNS('http://www.w3.org/2000/svg','rect');
  cx.setAttribute('x',82);cx.setAttribute('y',82);cx.setAttribute('width',36);cx.setAttribute('height',36);
  cx.setAttribute('fill','white');cx.setAttribute('rx','4');svg.appendChild(cx);
  const ct=document.createElementNS('http://www.w3.org/2000/svg','text');
  ct.setAttribute('x',100);ct.setAttribute('y',106);ct.setAttribute('text-anchor','middle');
  ct.setAttribute('font-size','22');svg.appendChild(ct);ct.textContent='🏕️';
  document.getElementById('qr-label').textContent=`CAMPTRACK · ${qrPayMethod}`;
}

// --- KONFIRMASI PEMBAYARAN (UPDATE STATUS BAYAR KE DATABASE) ---
async function markPaid(){
  const id = document.getElementById('qr-trans').value;
  if(!id){
    alert('Pilih transaksi terlebih dahulu pada dropdown!');
    return;
  }
  
  const payload = {
    action: "bayar_transaksi",
    id: parseInt(id)
  };

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      alert('✅ ' + result.message + '\nTerima kasih telah menggunakan CampTrack.');
      
      // Reset pilihan dropdown dan tampilan QR setelah sukses lunas
      document.getElementById('qr-trans').value = '';
      updateQR();
      
      // Sinkronisasi data lokal dengan database terbaru Google Sheets
      await loadInitialData();
    } else {
      alert('❌ Gagal mengonfirmasi pembayaran: ' + result.message);
    }
  } catch (error) {
    console.error("Payment Error:", error);
    alert('Terjadi kesalahan jaringan saat memproses pembayaran.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// INIT
document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', () => {});
});

/* ========================================
   PESANAN ONLINE MODULE
   Integrasi Admin ↔ Customer Portal
   ======================================== */

// --- LOAD PESANAN ONLINE DARI API ---
function loadOnlineOrders() {
  const container = document.getElementById("admin-orders-list");
  const badge = document.getElementById("admin-order-badge");

  if (!container) return;
  container.innerHTML = `<div style="text-align:center; grid-column:1/-1; padding:2rem; color:var(--muted);">
    <div class="spinner-loader" style="width:30px;height:30px;border-width:3px;margin:0 auto 0.75rem;border-color:#e2ede5;border-top-color:#2d6a4f;"></div>
    Mengambil pesanan online...
  </div>`;

  fetch(`${API_URL}?page=orders`)
    .then(res => res.json())
    .then(response => {
      // API bisa return response.orders ATAU kita ambil dari format customer portal
      let ordersArray = response.orders || response.data || [];

      // Update badge
      if (badge) {
        const pendingCount = ordersArray.filter(o => {
          const st = o.status_pesanan || o.statusPesanan || o.status || '';
          return st !== 'Dikonfirmasi' && st !== 'Diambil' && st !== 'Dikembalikan' && st !== 'Dibatalkan';
        }).length;

        if (pendingCount > 0) {
          badge.textContent = pendingCount;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }

      if (ordersArray.length === 0) {
        container.innerHTML = `
          <div style="text-align:center; grid-column:1/-1; padding:3rem; color:var(--muted);">
            <i class="ti ti-box-off" style="font-size:3rem; display:block; margin-bottom:0.75rem; color:var(--border);"></i>
            <p style="font-size:14px;">Tidak ada pesanan online saat ini.</p>
            <p style="font-size:12px; color:var(--muted);">Pesanan dari Customer Portal akan muncul di sini.</p>
          </div>`;
        return;
      }

      // Render pesanan
      container.innerHTML = ordersArray.map(order => {
        // Normalisasi field (support berbagai format dari Google Sheets)
        const idPesanan = order.id_pesanan || order.idPesanan || order.id || 'ORD-???';
        const namaPemesan = order.nama_pemesan || order.namaPemesan || order.customerName || order.nama || 'Pelanggan';
        const noHp = order.no_hp || order.noHp || order.customerHp || order.hp || '-';
        const email = order.email || order.customerEmail || '-';
        const metodeBayar = order.metode_bayar || order.metodeBayar || 'QRIS';
        const catatan = order.catatan || '-';
        const totalBiaya = Number(order.total_biaya || order.totalBiaya || 0);
        const statusPesanan = order.status_pesanan || order.statusPesanan || order.status || 'Menunggu';
        const statusBayar = order.status_bayar || order.statusBayar || 'Belum Bayar';
        const tglPesan = order.created_at || order.createdAt || order.tgl_pesan || '';

        // Parse items (bisa JSON string atau sudah array)
        let itemsHtml = '';
        const rawItems = order.detail_items || order.detailItems || order.items;
        if (rawItems) {
          try {
            const items = typeof rawItems === 'string' ? JSON.parse(rawItems) : rawItems;
            if (Array.isArray(items)) {
              itemsHtml = items.map(it =>
                `<li>${it.nama || it.name || 'Barang'} ${it.hari ? `<small style="color:var(--muted)">(${it.hari} hari)</small>` : ''}</li>`
              ).join('');
            } else {
              itemsHtml = `<li>${rawItems}</li>`;
            }
          } catch(e) {
            itemsHtml = `<li>${rawItems}</li>`;
          }
        } else {
          itemsHtml = '<li><em style="color:var(--muted)">Detail item tidak tersedia</em></li>';
        }

        // Status color
        const stColor = statusPesanan.includes('Menunggu') ? '#f4a261' :
                        statusPesanan === 'Dikonfirmasi' ? '#2d6a4f' :
                        statusPesanan === 'Dibatalkan' ? '#e63946' : '#6b8f7b';

        const bayarColor = statusBayar === 'Lunas' ? '#2d6a4f' : '#e63946';

        return `
          <div class="card" style="padding:1.25rem; border-radius:var(--rad2); display:flex; flex-direction:column; gap:0.6rem;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-family:'Syne',sans-serif; font-weight:700; font-size:13px; color:var(--c1); background:var(--c5); padding:0.2rem 0.6rem; border-radius:6px;">${idPesanan}</span>
              <span style="background:${stColor}; color:white; font-size:11px; padding:3px 10px; border-radius:12px; font-weight:700;">${statusPesanan}</span>
            </div>
            <div>
              <h4 style="margin:0; font-size:15px; color:var(--c1);">${namaPemesan}</h4>
              <p style="font-size:12px; color:var(--muted); margin:0.2rem 0 0;"><i class="ti ti-phone"></i> ${noHp} ${email !== '-' ? `· <i class="ti ti-mail"></i> ${email}` : ''}</p>
            </div>

            <div style="background:var(--c5); padding:0.75rem; border-radius:8px;">
              <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--muted); display:block; margin-bottom:0.25rem;">Barang Disewa:</span>
              <ul style="padding-left:1.25rem; margin:0; font-size:13px; color:var(--c1);">${itemsHtml}</ul>
            </div>

            <div style="display:flex; gap:1rem; font-size:12px; color:var(--muted); flex-wrap:wrap;">
              <span><i class="ti ti-credit-card"></i> ${metodeBayar}</span>
              <span style="color:${bayarColor}; font-weight:600;"><i class="ti ti-coin"></i> ${statusBayar}</span>
              ${tglPesan ? `<span><i class="ti ti-calendar"></i> ${fmtDT(tglPesan)}</span>` : ''}
            </div>

            ${catatan !== '-' ? `<p style="font-size:12px; margin:0; color:var(--muted);"><i class="ti ti-note"></i> <em>${catatan}</em></p>` : ''}

            <div style="border-top:1px solid var(--border); padding-top:0.75rem; margin-top:auto; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <small style="color:var(--muted);">Total Tagihan</small><br>
                <strong style="font-size:18px; color:var(--c2); font-family:'Syne',sans-serif;">${idr(totalBiaya)}</strong>
              </div>
              ${statusPesanan.includes('Menunggu') ? `
                <div style="display:flex; gap:0.5rem;">
                  <button class="btn btn-sm btn-outline" onclick="tolakPesananOnline('${idPesanan}')" style="color:#e63946; border-color:#e63946;">
                    <i class="ti ti-x"></i> Tolak
                  </button>
                  <button class="btn btn-sm btn-primary" onclick="terimaPesananOnline('${idPesanan}')">
                    <i class="ti ti-check"></i> Konfirmasi
                  </button>
                </div>
              ` : `
                <span style="font-size:12px; color:var(--muted);"><i class="ti ti-circle-check"></i> Sudah diproses</span>
              `}
            </div>
          </div>
        `;
      }).join('');
    })
    .catch(err => {
      console.error("Load Orders Error:", err);
      container.innerHTML = `
        <div style="text-align:center; grid-column:1/-1; padding:2rem;">
          <i class="ti ti-alert-triangle" style="font-size:2.5rem; color:#e63946; display:block; margin-bottom:0.5rem;"></i>
          <p style="color:#e63946; font-size:14px; font-weight:600;">Gagal memuat pesanan online</p>
          <p style="font-size:12px; color:var(--muted);">Pastikan Google Apps Script sudah handle endpoint <code>?page=orders</code></p>
          <button class="btn btn-sm btn-outline" onclick="loadOnlineOrders()" style="margin-top:0.75rem"><i class="ti ti-refresh"></i> Coba Lagi</button>
        </div>`;
    });
}

// --- KONFIRMASI PESANAN ---
async function terimaPesananOnline(idPesanan) {
  if (!confirm(`Konfirmasi pesanan ${idPesanan}?\n\nPesanan akan diubah statusnya menjadi "Dikonfirmasi" dan barang akan dicatat sebagai dipinjam.`)) return;

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "terima_pesanan",
        idPesanan: idPesanan
      }),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      alert('✅ Pesanan ' + idPesanan + ' berhasil dikonfirmasi!\nBarang akan otomatis tercatat sebagai dipinjam.');
      loadOnlineOrders(); // Refresh list
      await loadInitialData(); // Sinkronkan data aset & transaksi
    } else {
      alert('❌ Gagal: ' + (result.message || 'Error tidak diketahui'));
    }
  } catch (error) {
    console.error("Confirm Order Error:", error);
    alert('Terjadi kesalahan jaringan.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}

// --- TOLAK PESANAN ---
async function tolakPesananOnline(idPesanan) {
  const alasan = prompt(`Alasan menolak pesanan ${idPesanan}:`, 'Barang tidak tersedia');
  if (alasan === null) return; // User cancelled

  document.getElementById('global-loader').style.display = 'flex';

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "tolak_pesanan",
        idPesanan: idPesanan,
        alasan: alasan
      }),
      redirect: "follow"
    });

    const result = await response.json();

    if (result.status === "success") {
      alert('Pesanan ' + idPesanan + ' ditolak.');
      loadOnlineOrders();
    } else {
      alert('❌ Gagal: ' + (result.message || 'Error'));
    }
  } catch (error) {
    console.error("Reject Order Error:", error);
    alert('Terjadi kesalahan jaringan.');
  } finally {
    document.getElementById('global-loader').style.display = 'none';
  }
}ctor('[onclick="openModal(\'modal-aset\')"]') && null;
document.getElementById('page-aset').querySelector('.btn-primary').onclick=openAddAset;
renderDashboard();