/* Màn hình KÍCH HOẠT của bản phát hành đã mã hoá (tools/ma-hoa.mjs chèn vào cuối file HTML). */
(function () {
  'use strict';
  var MUOI = __MUOI__;
  var VONG = __VONG__;
  var DB = 'sodoluoidien-kich-hoat';
  var KHO = 'khoa';
  var LS_MA_MAY = 'sodoluoidien.maMay';
  var enc = new TextEncoder();
  var app = document.getElementById('app');

  function maMay() {
    var m = '';
    try {
      m = localStorage.getItem(LS_MA_MAY) || '';
    } catch (e) {}
    if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(m)) {
      var a = crypto.getRandomValues(new Uint8Array(6));
      var h = Array.prototype.map.call(a, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('').toUpperCase();
      m = h.slice(0, 4) + '-' + h.slice(4, 8) + '-' + h.slice(8, 12);
      try {
        localStorage.setItem(LS_MA_MAY, m);
      } catch (e) {}
    }
    return m;
  }

  function moDb() {
    return new Promise(function (ok, loi) {
      if (!window.indexedDB) return loi(new Error('no idb'));
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(KHO); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { loi(r.error); };
    });
  }
  function docKhoa() {
    return moDb().then(function (db) {
      return new Promise(function (ok) {
        var r = db.transaction(KHO, 'readonly').objectStore(KHO).get('may');
        r.onsuccess = function () { ok(r.result || null); };
        r.onerror = function () { ok(null); };
      });
    }).catch(function () { return null; });
  }
  function ghiKhoa(v) {
    return moDb().then(function (db) {
      return new Promise(function (ok, loi) {
        var t = db.transaction(KHO, 'readwrite');
        if (v) t.objectStore(KHO).put(v, 'may');
        else t.objectStore(KHO).delete('may');
        t.oncomplete = function () { ok(true); };
        t.onerror = function () { loi(t.error); };
      });
    });
  }

  function goi() {
    var s = atob(document.getElementById('goi-ma-hoa').textContent.trim());
    var b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  function giaiMa(khoa) {
    var b = goi();
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, khoa, b.subarray(12)).then(function (nen) {
      return new Response(new Blob([nen]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
    });
  }

  function taoKhoa(mk) {
    return crypto.subtle.importKey('raw', enc.encode(mk), 'PBKDF2', false, ['deriveKey']).then(function (g) {
      return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: enc.encode(MUOI), iterations: VONG, hash: 'SHA-256' },
        g,
        { name: 'AES-GCM', length: 256 },
        false, // khoá KHÔNG xuất ra được khỏi trình duyệt
        ['decrypt'],
      );
    });
  }

  function chay(ma, tt) {
    window.sodoKichHoat = {
      maMay: maMay(),
      ngay: tt && tt.ngay,
      nguoi: tt && tt.nguoi,
      luuDuoc: !tt || tt.luuDuoc !== false,
      huy: function () { return ghiKhoa(null); },
    };
    app.textContent = '';
    // nạp mã qua blob URL (không để lại mã đã giải trong DOM của trang)
    var url = URL.createObjectURL(new Blob([ma], { type: 'text/javascript' }));
    return import(url).finally(function () { URL.revokeObjectURL(url); });
  }

  function manHinh(thongBao) {
    var m = maMay();
    app.innerHTML =
      '<div class="kh-nen"><div class="kh-hop">' +
      '<div class="kh-dau">TÀI LIỆU NỘI BỘ - PHÒNG ĐIỀU ĐỘ<br>CÔNG TY ĐIỆN LỰC THÁI NGUYÊN</div>' +
      '<h2>Sơ đồ lưới điện Thái Nguyên</h2>' +
      '<p>Máy này <b>chưa được cấp quyền</b> mở phần mềm. Liên hệ quản trị (Phòng Điều độ) để kích hoạt.</p>' +
      '<p>Mã máy: <b class="kh-ma">' + m + '</b></p>' +
      '<label>Mật khẩu kích hoạt (quản trị nhập)<input id="kh-mk" type="password" autocomplete="off"></label>' +
      '<label>Ghi chú kích hoạt (tên người / máy)<input id="kh-nguoi" type="text" placeholder="vd: Trực ca A - máy 2"></label>' +
      '<p id="kh-tb" class="kh-tb"></p>' +
      '<button id="kh-nut" type="button">Kích hoạt máy này</button>' +
      '<p class="kh-chu">Dữ liệu trong file đã được mã hoá; file mang sang máy chưa kích hoạt sẽ không đọc được.</p>' +
      '</div></div>';
    var tb = document.getElementById('kh-tb');
    var mk = document.getElementById('kh-mk');
    var nut = document.getElementById('kh-nut');
    if (thongBao) tb.textContent = thongBao;
    function thu() {
      if (!mk.value) return;
      nut.disabled = true;
      tb.textContent = 'Đang kiểm tra…';
      var khoa;
      taoKhoa(mk.value)
        .then(function (k) {
          khoa = k;
          return giaiMa(k);
        })
        .then(
          function (ma) {
            var tt = { khoa: khoa, maMay: m, ngay: new Date().toISOString(), nguoi: document.getElementById('kh-nguoi').value.trim() };
            return ghiKhoa(tt).then(
              function () { return chay(ma, tt); },
              function () {
                tt.luuDuoc = false;
                return chay(ma, tt);
              },
            );
          },
          function () {
            nut.disabled = false;
            mk.value = '';
            mk.focus();
            tb.textContent = 'Mật khẩu kích hoạt không đúng.';
          },
        );
    }
    nut.addEventListener('click', thu);
    mk.addEventListener('keydown', function (e) { if (e.key === 'Enter') thu(); });
    mk.focus();
  }

  var st = document.createElement('style');
  st.textContent =
    '.kh-nen{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#141820;font:14px system-ui,Segoe UI,Arial,sans-serif;color:#e5e9f0}' +
    '.kh-hop{width:min(440px,92vw);background:#1e2430;border:1px solid #39414f;border-radius:10px;padding:22px 26px}' +
    '.kh-dau{font-size:11.5px;letter-spacing:.04em;color:#ffd400;margin-bottom:6px}' +
    '.kh-hop h2{margin:4px 0 12px;font-size:19px}.kh-hop p{margin:8px 0;line-height:1.45}' +
    '.kh-ma{font-family:Consolas,monospace;font-size:16px;color:#7fd1ff;letter-spacing:.06em}' +
    '.kh-hop label{display:block;margin:10px 0 0;font-size:12.5px;color:#aab3c2}' +
    '.kh-hop input{display:block;width:100%;box-sizing:border-box;margin-top:4px;padding:7px 9px;background:#141820;border:1px solid #39414f;border-radius:6px;color:#e5e9f0;font:inherit}' +
    '.kh-hop button{margin-top:14px;width:100%;padding:9px;border:0;border-radius:6px;background:#3fa9f5;color:#06121e;font-weight:600;font:inherit;cursor:pointer}' +
    '.kh-hop button:disabled{opacity:.6;cursor:wait}.kh-tb{color:#ff8a80;min-height:1.2em}.kh-chu{font-size:11.5px;color:#8a93a3}';
  document.head.appendChild(st);

  if (!window.crypto || !crypto.subtle || typeof DecompressionStream === 'undefined') {
    app.innerHTML = '<div class="kh-nen"><div class="kh-hop"><h2>Trình duyệt không hỗ trợ</h2><p>Vui lòng mở bằng Microsoft Edge hoặc Google Chrome phiên bản mới.</p></div></div>';
    return;
  }
  app.innerHTML = '<div class="kh-nen"><div class="kh-hop"><p>Đang mở phần mềm…</p></div></div>';
  docKhoa().then(function (tt) {
    if (!tt || !tt.khoa) return manHinh('');
    return giaiMa(tt.khoa).then(
      function (ma) { return chay(ma, tt); },
      function () { return manHinh('Phần mềm đã đổi mật khẩu kích hoạt - cần kích hoạt lại máy này.'); },
    );
  });
})();
