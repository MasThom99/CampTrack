// ==========================================
// KODE.GS - API GATEWAY (ADMIN & CUSTOMER)
// VERSI DIPERBAIKI - CampTrack
// ==========================================

function memberikanResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Fungsi pembantu untuk mengubah data Sheet menjadi JSON (Array of Objects)
function getSheetData(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Kosong (hanya header)
  
  var headers = data[0];
  var result = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).toLowerCase().replace(/\s+/g, '_');
      obj[key] = data[i][j];
    }
    result.push(obj);
  }
  return result;
}

// ==========================================
// FUNGSI GET (MEMBACA DATA)
// ==========================================
function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var page = (e.parameter && e.parameter.page) ? e.parameter.page : 'dashboard';
    var response = { status: "success" };

    if (page === "reviews") {
      // Endpoint khusus: hanya ambil ulasan
      var sheetUlasan = ss.getSheetByName("Ulasan");
      response.reviews = sheetUlasan ? getSheetData(sheetUlasan) : [];

    } else if (page === "orders") {
      // Endpoint khusus: hanya ambil pesanan online
      var sheetPesanan = ss.getSheetByName("Pesanan");
      response.orders = sheetPesanan ? getSheetData(sheetPesanan) : [];

    } else {
      // Default (dashboard): ambil semua data utama
      var sheetAset = ss.getSheetByName("Aset");
      if (sheetAset) response.assets = getSheetData(sheetAset);
      
      var sheetTransaksi = ss.getSheetByName("Transaksi");
      if (sheetTransaksi) response.transactions = getSheetData(sheetTransaksi);
      
      // Juga sertakan pesanan untuk badge notifikasi admin
      var sheetPesanan = ss.getSheetByName("Pesanan");
      if (sheetPesanan) response.orders = getSheetData(sheetPesanan);
    }
    
    return memberikanResponse(response);
  } catch (error) {
    return memberikanResponse({ status: "error", message: error.toString() });
  }
}

// ==========================================
// FUNGSI POST (MENERIMA & MENYIMPAN DATA)
// ==========================================
function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var payload = JSON.parse(e.postData.contents);
    var now = new Date().toISOString();
    
    // ==========================================
    // BAGIAN 1: AKSI PELANGGAN (CUSTOMER PORTAL)
    // ==========================================
    
    // --- 1A. REGISTER ---
    if (payload.action === "register_customer") {
      var sheet = ss.getSheetByName("Pelanggan");
      var data = sheet.getDataRange().getValues();
      
      // Validasi duplikat
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][2]) === String(payload.data.hp) || String(data[i][3]) === String(payload.data.email)) {
          return memberikanResponse({status: "error", message: "Email atau No. HP sudah terdaftar!"});
        }
      }
      
      var newId = new Date().getTime();
      // Kolom: id_customer | nama | no_hp | email | password | created_at
      sheet.appendRow([newId, payload.data.nama, payload.data.hp, payload.data.email, payload.data.password, now]);
      return memberikanResponse({status: "success", id: newId});
    }
    
    // --- 1B. LOGIN ---
    else if (payload.action === "login_customer") {
      var sheet = ss.getSheetByName("Pelanggan");
      var data = sheet.getDataRange().getValues();
      var user = null;
      
      for (var i = 1; i < data.length; i++) {
        var matchIdentity = (String(data[i][2]) === String(payload.data.emailOrHp)) || 
                            (String(data[i][3]) === String(payload.data.emailOrHp));
        var matchPass = String(data[i][4]) === String(payload.data.password);
        
        if (matchIdentity && matchPass) {
          user = {
            id_customer: data[i][0],
            nama: data[i][1],
            hp: data[i][2],
            email: data[i][3],
            created_at: data[i][5]
          };
          break;
        }
      }
      
      if (user) {
        return memberikanResponse({status: "success", user: user});
      } else {
        return memberikanResponse({status: "error", message: "Email/HP atau password salah!"});
      }
    }
    
    // --- 1C. CREATE ORDER (Checkout dari Customer Portal) ---
    else if (payload.action === "create_order") {
      var sheet = ss.getSheetByName("Pesanan");
      var d = payload.data;
      
      // Simpan detail items sebagai JSON string
      var itemsStr = JSON.stringify(d.items);
      
      // Kolom sheet "Pesanan":
      // id_pesanan | id_customer | nama_pemesan | no_hp | email | total_biaya | metode_bayar | catatan | status_pesanan | status_bayar | detail_items | created_at
      sheet.appendRow([
        d.id,                          // A: id_pesanan
        d.customerId,                  // B: id_customer
        d.customerName,                // C: nama_pemesan
        d.customerHp || '',            // D: no_hp
        d.customerEmail || '',         // E: email
        Number(d.totalBiaya),          // F: total_biaya
        d.metodeBayar,                 // G: metode_bayar
        d.catatan || '',               // H: catatan
        'Menunggu Pembayaran',         // I: status_pesanan
        'Belum Bayar',                 // J: status_bayar
        itemsStr,                      // K: detail_items (JSON)
        now                            // L: created_at
      ]);
      return memberikanResponse({status: "success", message: "Pesanan berhasil dibuat!"});
    }
    
    // --- 1D. SUBMIT REVIEW ---
    else if (payload.action === "submit_review") {
      var sheet = ss.getSheetByName("Ulasan");
      var d = payload.data;
      var newId = "REV-" + new Date().getTime();
      
      // Kolom: id_review | id_aset | id_customer | nama | rating | komentar | balasan_admin | created_at
      sheet.appendRow([newId, d.asetId, d.userId, d.userName, Number(d.rating), d.komentar, "", now]);
      return memberikanResponse({status: "success", id: newId});
    }

    // --- 1E. UPDATE PROFIL ---
    else if (payload.action === "update_customer") {
      var sheet = ss.getSheetByName("Pelanggan");
      var data = sheet.getDataRange().getValues();
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.data.id)) {
          sheet.getRange(i + 1, 2).setValue(payload.data.nama);
          sheet.getRange(i + 1, 3).setValue(payload.data.hp);
          sheet.getRange(i + 1, 4).setValue(payload.data.email);
          return memberikanResponse({status: "success", message: "Profil berhasil diperbarui!"});
        }
      }
      return memberikanResponse({status: "error", message: "User tidak ditemukan."});
    }

    // --- 1F. GANTI PASSWORD ---
    else if (payload.action === "change_password_customer") {
      var sheet = ss.getSheetByName("Pelanggan");
      var data = sheet.getDataRange().getValues();
      
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(payload.data.id)) {
          if (String(data[i][4]) === String(payload.data.oldPassword)) {
            sheet.getRange(i + 1, 5).setValue(payload.data.newPassword);
            return memberikanResponse({status: "success", message: "Password berhasil diubah!"});
          } else {
            return memberikanResponse({status: "error", message: "Password lama tidak sesuai!"});
          }
        }
      }
      return memberikanResponse({status: "error", message: "User tidak ditemukan."});
    }

    // ==========================================
    // BAGIAN 2: AKSI ADMIN
    // ==========================================
    
    // --- 2A. TAMBAH ASET ---
    else if (payload.action === "tambah_aset") {
      var sheetAset = ss.getSheetByName("Aset");
      var data = payload.data;
      var lastRow = sheetAset.getLastRow();
      var newId = 1;
      if (lastRow > 1) { newId = Number(sheetAset.getRange(lastRow, 1).getValue()) + 1; }
      // Kolom: id_aset | kode | nama_barang | kategori | tarif | status | foto | deskripsi
      sheetAset.appendRow([newId, data.kode, data.nama, data.kat, Number(data.tarif), data.status, data.foto, data.desc]);
      return memberikanResponse({ status: "success", message: "Aset berhasil ditambahkan!" });
    }
    
    // --- 2B. EDIT ASET ---
    else if (payload.action === "edit_aset") {
      var sheetAset = ss.getSheetByName("Aset");
      var data = payload.data;
      var dataAset = sheetAset.getDataRange().getValues();
      for (var i = 1; i < dataAset.length; i++) {
        if (Number(dataAset[i][0]) === Number(payload.id)) {
          sheetAset.getRange(i + 1, 2, 1, 7).setValues([[data.kode, data.nama, data.kat, Number(data.tarif), data.status, data.foto, data.desc]]);
          return memberikanResponse({ status: "success", message: "Data aset berhasil diperbarui!" });
        }
      }
      return memberikanResponse({ status: "error", message: "ID Aset tidak ditemukan." });
    }
    
    // --- 2C. HAPUS ASET ---
    else if (payload.action === "hapus_aset") {
      var sheetAset = ss.getSheetByName("Aset");
      var dataAset = sheetAset.getDataRange().getValues();
      for (var i = 1; i < dataAset.length; i++) {
        if (Number(dataAset[i][0]) === Number(payload.id)) {
          sheetAset.deleteRow(i + 1);
          return memberikanResponse({ status: "success", message: "Aset berhasil dihapus!" });
        }
      }
      return memberikanResponse({ status: "error", message: "ID Aset tidak ditemukan." });
    }
    
    // --- 2D. TAMBAH PEMINJAMAN (Manual dari Admin) ---
    else if (payload.action === "tambah_peminjaman") {
      var sheetTransaksi = ss.getSheetByName("Transaksi");
      var sheetAset = ss.getSheetByName("Aset");
      var data = payload.data;
      var lastRow = sheetTransaksi.getLastRow();
      var newTxId = lastRow > 1 ? Number(sheetTransaksi.getRange(lastRow, 1).getValue()) + 1 : 1;
      
      // Kolom Transaksi: id | nama_peminjam | no_hp | id_aset | tgl_pinjam | batas_kembali | tgl_aktual | biaya | denda | kondisi | status_transaksi | catatan | status_pembayaran
      sheetTransaksi.appendRow([
        newTxId, data.nama, data.hp, Number(data.asetId), data.tglPinjam, data.tglKembali,
        "", Number(data.biaya), 0, "", "Dipinjam", data.catatan || "", "Belum Lunas"
      ]);
      
      // Update status aset jadi "Dipinjam"
      var dataAset = sheetAset.getDataRange().getValues();
      for (var i = 1; i < dataAset.length; i++) {
        if (Number(dataAset[i][0]) === Number(data.asetId)) {
          sheetAset.getRange(i + 1, 6).setValue("Dipinjam");
          break;
        }
      }
      return memberikanResponse({ status: "success", message: "Peminjaman berhasil dicatat!" });
    }
    
    // --- 2E. PROSES PENGEMBALIAN ---
    else if (payload.action === "proses_pengembalian") {
      var sheetTransaksi = ss.getSheetByName("Transaksi");
      var sheetAset = ss.getSheetByName("Aset");
      var data = payload.data;
      var dataTx = sheetTransaksi.getDataRange().getValues();
      
      for (var i = 1; i < dataTx.length; i++) {
        if (String(dataTx[i][0]) === String(data.idTransaksi)) {
          // Update kolom 7-11: tgl_aktual | biaya(tetap) | denda | kondisi | status
          var biayaAsli = Number(dataTx[i][7]); // Ambil biaya yang sudah ada di row
          sheetTransaksi.getRange(i + 1, 7, 1, 5).setValues([[
            data.tglAktual, biayaAsli, Number(data.denda), data.kondisi, data.status
          ]]);
          
          // Update status aset
          var dataAset = sheetAset.getDataRange().getValues();
          for (var j = 1; j < dataAset.length; j++) {
            if (String(dataAset[j][0]) === String(data.idAset)) {
              var statusAsetBaru = (data.kondisi === "Rusak") ? "Rusak" : "Tersedia";
              sheetAset.getRange(j + 1, 6).setValue(statusAsetBaru);
              break;
            }
          }
          
          // SYNC: Update status pesanan online jika semua item sudah dikembalikan
          // Cek catatan transaksi untuk menemukan ID pesanan terkait
          var catatanTx = String(dataTx[i][11] || ''); // kolom catatan (index 11)
          if (catatanTx.indexOf('Pesanan Online:') !== -1) {
            var orderId = catatanTx.replace('Pesanan Online:', '').trim();
            if (orderId) {
              syncOrderStatusAfterReturn(ss, orderId);
            }
          }
          
          return memberikanResponse({ status: "success", message: "Pengembalian berhasil diproses!" });
        }
      }
      return memberikanResponse({ status: "error", message: "Transaksi tidak ditemukan." });
    }

    // --- 2F. BAYAR TRANSAKSI (QR) ---
    else if (payload.action === "bayar_transaksi") {
      var sheetTransaksi = ss.getSheetByName("Transaksi");
      var dataTx = sheetTransaksi.getDataRange().getValues();
      
      for (var i = 1; i < dataTx.length; i++) {
        if (String(dataTx[i][0]) === String(payload.id)) {
          sheetTransaksi.getRange(i + 1, 13).setValue("Lunas");
          return memberikanResponse({ status: "success", message: "Status pembayaran berhasil diperbarui menjadi LUNAS!" });
        }
      }
      return memberikanResponse({ status: "error", message: "ID Transaksi tidak ditemukan." });
    }

    // ==========================================
    // BAGIAN 3: ADMIN KELOLA PESANAN ONLINE
    // ==========================================

    // --- 3A. TERIMA/KONFIRMASI PESANAN ---
    else if (payload.action === "terima_pesanan") {
      var sheetPesanan = ss.getSheetByName("Pesanan");
      var sheetTransaksi = ss.getSheetByName("Transaksi");
      var sheetAset = ss.getSheetByName("Aset");
      var dataPesanan = sheetPesanan.getDataRange().getValues();
      var headers = dataPesanan[0];
      
      // Cari pesanan berdasarkan ID
      var targetRow = -1;
      var orderData = null;
      for (var i = 1; i < dataPesanan.length; i++) {
        if (String(dataPesanan[i][0]) === String(payload.idPesanan)) {
          targetRow = i + 1;
          orderData = {};
          for (var j = 0; j < headers.length; j++) {
            var key = String(headers[j]).toLowerCase().replace(/\s+/g, '_');
            orderData[key] = dataPesanan[i][j];
          }
          break;
        }
      }
      
      if (targetRow === -1) {
        return memberikanResponse({status: "error", message: "Pesanan tidak ditemukan."});
      }
      
      // Update status pesanan menjadi "Dikonfirmasi" (JANGAN hapus row!)
      // Kolom I = status_pesanan (kolom ke-9)
      sheetPesanan.getRange(targetRow, 9).setValue("Dikonfirmasi");
      // Kolom J = status_bayar (kolom ke-10)  
      sheetPesanan.getRange(targetRow, 10).setValue("Lunas");
      
      // Parse detail items dan buat transaksi untuk setiap item
      var rawItems = orderData.detail_items || '';
      var items = [];
      try { items = JSON.parse(rawItems); } catch(e) { items = []; }
      
      var namaPemesan = orderData.nama_pemesan || 'Pelanggan';
      var noHp = orderData.no_hp || '-';
      
      // Buat transaksi per item di sheet Transaksi
      var lastTxRow = sheetTransaksi.getLastRow();
      var lastTxId = lastTxRow > 1 ? Number(sheetTransaksi.getRange(lastTxRow, 1).getValue()) : 0;
      
      for (var k = 0; k < items.length; k++) {
        var item = items[k];
        lastTxId++;
        
        // Kolom: id | nama_peminjam | no_hp | id_aset | tgl_pinjam | batas_kembali | tgl_aktual | biaya | denda | kondisi | status | catatan | status_bayar
        sheetTransaksi.appendRow([
          lastTxId,
          namaPemesan,
          noHp,
          Number(item.asetId) || 0,
          item.tglMulai || '',
          item.tglSelesai || '',
          '',                              // tgl_aktual (belum dikembalikan)
          Number(item.subtotal) || 0,
          0,                               // denda
          '',                              // kondisi
          'Dipinjam',                      // status_transaksi
          'Pesanan Online: ' + (orderData.id_pesanan || ''),  // catatan
          'Lunas'                          // status_pembayaran
        ]);
        
        // Update status aset menjadi "Dipinjam"
        if (item.asetId) {
          var dataAset = sheetAset.getDataRange().getValues();
          for (var m = 1; m < dataAset.length; m++) {
            if (String(dataAset[m][0]) === String(item.asetId)) {
              sheetAset.getRange(m + 1, 6).setValue("Dipinjam");
              break;
            }
          }
        }
      }
      
      return memberikanResponse({status: "success", message: "Pesanan " + payload.idPesanan + " dikonfirmasi! " + items.length + " barang dicatat sebagai dipinjam."});
    }

    // --- 3B. TOLAK PESANAN ---
    else if (payload.action === "tolak_pesanan") {
      var sheetPesanan = ss.getSheetByName("Pesanan");
      var dataPesanan = sheetPesanan.getDataRange().getValues();
      
      for (var i = 1; i < dataPesanan.length; i++) {
        if (String(dataPesanan[i][0]) === String(payload.idPesanan)) {
          sheetPesanan.getRange(i + 1, 9).setValue("Dibatalkan");
          return memberikanResponse({status: "success", message: "Pesanan " + payload.idPesanan + " ditolak."});
        }
      }
      return memberikanResponse({status: "error", message: "Pesanan tidak ditemukan."});
    }

    // --- 3C. TANDAI PESANAN DIAMBIL ---
    else if (payload.action === "ambil_pesanan") {
      var sheetPesanan = ss.getSheetByName("Pesanan");
      var dataPesanan = sheetPesanan.getDataRange().getValues();
      
      for (var i = 1; i < dataPesanan.length; i++) {
        if (String(dataPesanan[i][0]) === String(payload.idPesanan)) {
          // Update status_pesanan ke "Diambil" (kolom 9)
          sheetPesanan.getRange(i + 1, 9).setValue("Diambil");
          return memberikanResponse({status: "success", message: "Pesanan " + payload.idPesanan + " ditandai sebagai diambil."});
        }
      }
      return memberikanResponse({status: "error", message: "Pesanan tidak ditemukan."});
    }
    
    // ==========================================
    // FALLBACK
    // ==========================================
    return memberikanResponse({ status: "error", message: "Aksi '" + (payload.action || 'undefined') + "' tidak dikenali oleh server." });
    
  } catch (error) {
    return memberikanResponse({ status: "error", message: error.toString() });
  }
}



// ==========================================
// HELPER: Sinkronisasi Status Pesanan Setelah Pengembalian
// Cek apakah SEMUA item dari pesanan sudah dikembalikan
// Jika ya → update status pesanan ke "Dikembalikan"
// ==========================================
function syncOrderStatusAfterReturn(ss, orderId) {
  try {
    var sheetTransaksi = ss.getSheetByName("Transaksi");
    var sheetPesanan = ss.getSheetByName("Pesanan");
    var dataTx = sheetTransaksi.getDataRange().getValues();
    
    // Cari semua transaksi yang berasal dari pesanan ini
    var relatedTx = [];
    for (var i = 1; i < dataTx.length; i++) {
      var catatan = String(dataTx[i][11] || '');
      if (catatan.indexOf(orderId) !== -1) {
        relatedTx.push({
          status: String(dataTx[i][10] || '') // kolom status_transaksi (index 10)
        });
      }
    }
    
    // Jika tidak ada transaksi terkait, skip
    if (relatedTx.length === 0) return;
    
    // Cek apakah SEMUA transaksi sudah berstatus "Dikembalikan" atau "Terlambat"
    var allReturned = relatedTx.every(function(tx) {
      return tx.status === 'Dikembalikan' || tx.status === 'Terlambat';
    });
    
    if (allReturned) {
      // Update status pesanan ke "Dikembalikan"
      var dataPesanan = sheetPesanan.getDataRange().getValues();
      for (var j = 1; j < dataPesanan.length; j++) {
        if (String(dataPesanan[j][0]) === String(orderId)) {
          sheetPesanan.getRange(j + 1, 9).setValue("Dikembalikan");
          break;
        }
      }
    }
  } catch(e) {
    // Silent fail - jangan sampai mengganggu proses pengembalian utama
    Logger.log("syncOrderStatus error: " + e.toString());
  }
}
