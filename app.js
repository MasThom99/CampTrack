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
    
    renderDashboard(); renderAset(); renderPinjam(); renderKembali(); renderRiwayat();
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

// --- SIMPAN ASET BARU (CREATE) ---
async function saveAset(){
  const kode = document.getElementById('a-kode').value.trim();
  const nama = document.getElementById('a-nama').value.trim();
  const tarif = parseInt(document.getElementById('a-tarif').value) || 0;
  
  // Validasi agar field wajib tidak kosong
  if(!kode || !nama || !tarif){
    alert('Lengkapi field Kode, Nama, dan Tarif!');
    return;
  }

  // Bungkus data dari form ke dalam objek payload
  const payload = {
    action: "tambah_aset",
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

  // Munculkan layar loading
  document.getElementById('global-loader').style.display = 'flex';

  try {
    // Kirim data ke Google Apps Script menggunakan POST
    const response = await fetch(API_URL, {
      method: "POST",
      // Gunakan text/plain agar tidak terkena blokir CORS Preflight dari browser
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.status === "success") {
      closeModal('modal-aset');
      alert('✅ Barang baru berhasil ditambahkan ke database!');
      
      // Minta peladen untuk menarik data terbaru agar tabel langsung ter-update
      await loadInitialData(); 
    } else {
      alert('❌ Gagal menyimpan data: ' + result.message);
    }
  } catch (error) {
    console.error("Post Error:", error);
    alert('Terjadi kesalahan saat mengirim data ke server.');
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

function doPinjam(){
  const nama=document.getElementById('p-nama').value.trim();
  const hp=document.getElementById('p-hp').value.trim();
  const asetId=parseInt(document.getElementById('p-barang').value);
  const t1=document.getElementById('p-tgl-pinjam').value;
  const t2=document.getElementById('p-tgl-kembali').value;
  const catatan=document.getElementById('p-catatan').value;
  if(!nama||!hp||!asetId||!t1||!t2){alert('Lengkapi semua field!');return;}
  if(new Date(t2)<=new Date(t1)){alert('Tanggal kembali harus setelah tanggal pinjam!');return;}
  const days=Math.ceil((new Date(t2)-new Date(t1))/(1000*3600*24));
  const aset=assets.find(a=>a.id===asetId);
  aset.status='Dipinjam';
  loans.push({id:nextLoanId++,nama,hp,asetId,tglPinjam:t1,tglKembali:t2,tglAktual:null,biaya:days*aset.tarif,denda:0,kondisi:null,status:'Dipinjam',catatan});
  document.getElementById('p-nama').value='';
  document.getElementById('p-hp').value='';
  document.getElementById('p-barang').value='';
  document.getElementById('p-tgl-kembali').value='';
  document.getElementById('p-catatan').value='';
  document.getElementById('p-estimasi').innerHTML='<span style="color:var(--muted)">Pilih barang dan tanggal untuk melihat estimasi biaya</span>';
  renderPinjam();
  alert('✅ Peminjaman berhasil dicatat!');
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
function renderKembali(){
  const el=document.getElementById('return-list');
  if(loans.length===0){el.innerHTML='<div class="empty-state"><i class="ti ti-package-off" aria-hidden="true"></i>Tidak ada peminjaman aktif untuk dikembalikan</div>';return;}
  el.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Peminjam</th><th>Barang</th><th>Tgl Pinjam</th><th>Batas Kembali</th><th>Biaya</th><th>Status</th><th>Aksi</th></tr></thead>
    <tbody>${loans.map(l=>{
      const a=assets.find(x=>x.id===l.asetId)||{nama:'?',foto:'📦'};
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
        <td><button class="btn btn-sm btn-acc" onclick="openReturn(${l.id})"><i class="ti ti-arrow-bar-to-left" aria-hidden="true"></i> Kembalikan</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function openReturn(id){
  const l=loans.find(x=>x.id===id); if(!l)return;
  const a=assets.find(x=>x.id===l.asetId)||{nama:'?',foto:'📦',tarif:0};
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

function calcDenda(){
  const id=parseInt(document.getElementById('ret-id').value);
  const l=loans.find(x=>x.id===id); if(!l)return;
  const retDT=new Date(document.getElementById('ret-tgl').value);
  const batas=new Date(l.tglKembali+'T23:59:59');
  const box=document.getElementById('ret-denda-box');
  if(retDT>batas){
    const hours=Math.ceil((retDT-batas)/(1000*3600));
    const denda=hours*5000;
    box.style.display='block';
    box.innerHTML=`<div class="denda-badge"><i class="ti ti-clock-exclamation" aria-hidden="true"></i>
      Terlambat <b>${hours} jam</b> · Denda: <b>${idr(denda)}</b> (Rp 5.000/jam)
    </div>`;
  } else {
    box.style.display='none';
  }
}

function saveReturn(){
  const id=parseInt(document.getElementById('ret-id').value);
  const idx=loans.findIndex(x=>x.id===id); if(idx<0)return;
  const l=loans[idx];
  const retDT=new Date(document.getElementById('ret-tgl').value);
  const batas=new Date(l.tglKembali+'T23:59:59');
  const kondisi=document.getElementById('ret-kondisi').value;
  let denda=0;
  let terlambat=false;
  if(retDT>batas){
    const hours=Math.ceil((retDT-batas)/(1000*3600));
    denda=hours*5000;
    terlambat=true;
  }
  const status=terlambat?'Terlambat':'Dikembalikan';
  history.push({...l, id:'H'+String(nextHistId++).padStart(3,'0'), tglAktual:document.getElementById('ret-tgl').value, denda, kondisi, status});
  const aset=assets.find(a=>a.id===l.asetId);
  if(aset) aset.status=kondisi==='Rusak'?'Rusak':'Tersedia';
  loans.splice(idx,1);
  closeModal('modal-return');
  renderKembali();
  const msg=denda>0?`✅ Barang dikembalikan.\n⚠️ Denda keterlambatan: ${idr(denda)}`:'✅ Barang berhasil dikembalikan tepat waktu!';
  alert(msg);
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

function renderQR(){
  const sel=document.getElementById('qr-trans');
  sel.innerHTML='<option value="">-- Pilih peminjaman --</option>';
  [...loans,...history].forEach(t=>{
    const a=assets.find(x=>x.id===t.asetId)||{nama:'?'};
    const opt=document.createElement('option');
    opt.value=t.id;
    opt.textContent=`${t.nama} · ${a.nama} · ${idr(t.biaya+(t.denda||0))}`;
    sel.appendChild(opt);
  });
  generateQR();
  sel.onchange=updateQR;
}

function updateQR(){
  const id=document.getElementById('qr-trans').value;
  const allTx=[...loans,...history];
  const t=allTx.find(x=>String(x.id)===String(id));
  const amEl=document.getElementById('qr-amount');
  const totEl=document.getElementById('qr-total');
  const infoEl=document.getElementById('qr-info');
  if(!t){
    amEl.innerHTML='<span style="color:var(--muted)">Pilih transaksi untuk melihat total tagihan</span>';
    totEl.textContent='Rp 0';
    infoEl.textContent='Pilih transaksi terlebih dahulu';
    return;
  }
  const total=t.biaya+(t.denda||0);
  const a=assets.find(x=>x.id===t.asetId)||{nama:'?'};
  amEl.innerHTML=`<div style="font-size:13px;color:var(--c1)">
    <b>${t.nama}</b> · ${a.nama}<br>
    Sewa: ${idr(t.biaya)} ${t.denda?`+ Denda: <span style="color:#e63946">${idr(t.denda)}</span>`:''}
    <br><b style="font-size:18px;color:var(--c2);font-family:'Syne',sans-serif">${idr(total)}</b>
  </div>`;
  totEl.textContent=idr(total);
  infoEl.textContent=`${qrPayMethod} · ${t.nama}`;
  generateQR();
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

function markPaid(){
  const id=document.getElementById('qr-trans').value;
  if(!id){alert('Pilih transaksi terlebih dahulu!');return;}
  alert('✅ Pembayaran dikonfirmasi!\nTerima kasih telah menggunakan CampTrack.');
  document.getElementById('qr-trans').value='';
  updateQR();
}

// INIT
document.querySelector('[onclick="openModal(\'modal-aset\')"]') && null;
document.getElementById('page-aset').querySelector('.btn-primary').onclick=openAddAset;
renderDashboard();