// 브라우저에서 Code.js 를 돌리기 위한 가짜 Apps Script. 시험 전용 — 구글에 올리지 않는다.
function FakeSheet(name) { this.name = name; this.data = []; this.frozen = 0; }
FakeSheet.prototype.width_ = function () { return this.data.reduce(function (m, r) { return Math.max(m, r.length); }, 0); };
FakeSheet.prototype.getLastRow = function () { return this.data.length; };
// 진짜 시트처럼: 숫자 모양 글자는 숫자로 바꾸고(앞의 0이 사라짐), 앞에 '가 붙은 글자는 그대로 글자로 둔다.
function sheetValue_(v) {
  if (typeof v !== 'string') return v;
  if (v.charAt(0) === "'") return v.slice(1);
  return /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
}
FakeSheet.prototype.appendRow = function (row) { this.data.push(row.map(sheetValue_)); };
FakeSheet.prototype.setFrozenRows = function (n) { this.frozen = n; };
FakeSheet.prototype.deleteRow = function (r) { this.data.splice(r - 1, 1); };
FakeSheet.prototype.getDataRange = function () {
  var self = this;
  return { getValues: function () {
    var w = Math.max(1, self.width_());
    if (!self.data.length) return [new Array(w).fill('')];
    return self.data.map(function (r) { var x = r.slice(); while (x.length < w) x.push(''); return x; });
  } };
};
FakeSheet.prototype.getRange = function (r, c, nr, nc) {
  var self = this;
  return {
    getValues: function () {
      var out = [];
      for (var i = 0; i < nr; i++) { var row = self.data[r - 1 + i] || []; var x = []; for (var j = 0; j < nc; j++) x.push(row[c - 1 + j] === undefined ? '' : row[c - 1 + j]); out.push(x); }
      return out;
    },
    setValues: function (vals) {
      for (var i = 0; i < nr; i++) {
        while (self.data.length < r + i) self.data.push([]);
        var row = self.data[r - 1 + i];
        for (var j = 0; j < nc; j++) row[c - 1 + j] = sheetValue_(vals[i][j]);
      }
    }
  };
};
function FakeBook() { this.sheets = [new FakeSheet('시트1')]; }
FakeBook.prototype.getSheetByName = function (n) { return this.sheets.filter(function (s) { return s.name === n; })[0] || null; };
FakeBook.prototype.insertSheet = function (n) { var s = new FakeSheet(n); this.sheets.push(s); return s; };
FakeBook.prototype.getSheets = function () { return this.sheets.slice(); };
FakeBook.prototype.deleteSheet = function (s) { this.sheets = this.sheets.filter(function (x) { return x !== s; }); };

var __book = new FakeBook();
__book.getUrl = function () { return "https://docs.google.com/spreadsheets/d/test"; };
var SpreadsheetApp = { getActive: function () { return __book; } };
var __cache = {};
var CacheService = { getScriptCache: function () { return { get: function (k) { return __cache[k] || null; }, put: function (k, v) { __cache[k] = v; } }; } };
var LockService ={ getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
var ScriptApp = { getProjectTriggers: function () { return []; }, deleteTrigger: function () {},
  newTrigger: function () { var b = { timeBased: function () { return b; }, everyMinutes: function () { return b; }, forSpreadsheet: function () { return b; }, onEdit: function () { return b; }, create: function () {} }; return b; } };
var ContentService = { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { text: s, setMimeType: function () { return this; } }; } };
var Utilities = { formatDate: function (d, tz, fmt) {
  var p = function (n) { return ('0' + n).slice(-2); };
  return fmt.replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(-2))
    .replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate())).replace(/'/g, '');
} };
// 해시·속성·UUID — 회원 비밀번호·토큰 시험용
function sha256Bytes_(str) {
  var bytes = Array.from(new TextEncoder().encode(str));
  var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  var l = bytes.length * 8; bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (var i = 7; i >= 0; i--) bytes.push(i > 3 ? 0 : (l >>> (i * 8)) & 255);
  var w = new Array(64), r = function (x, n) { return (x >>> n) | (x << (32 - n)); };
  for (var j = 0; j < bytes.length; j += 64) {
    for (var t = 0; t < 16; t++) w[t] = (bytes[j + t * 4] << 24) | (bytes[j + t * 4 + 1] << 16) | (bytes[j + t * 4 + 2] << 8) | bytes[j + t * 4 + 3];
    for (t = 16; t < 64; t++) { var s0 = r(w[t - 15], 7) ^ r(w[t - 15], 18) ^ (w[t - 15] >>> 3), s1 = r(w[t - 2], 17) ^ r(w[t - 2], 19) ^ (w[t - 2] >>> 10); w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0; }
    var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (t = 0; t < 64; t++) {
      var t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + w[t]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H = [H[0] + a, H[1] + b, H[2] + c, H[3] + d, H[4] + e, H[5] + f, H[6] + g, H[7] + h].map(function (x) { return x | 0; });
  }
  var out = []; H.forEach(function (x) { for (var k = 3; k >= 0; k--) { var v = (x >>> (k * 8)) & 255; out.push(v > 127 ? v - 256 : v); } });
  return out;
}
Utilities.DigestAlgorithm = { SHA_256: 'SHA_256' };
Utilities.Charset = { UTF_8: 'UTF_8' };
Utilities.computeDigest = function (alg, s) { return sha256Bytes_(String(s)); };
Utilities.base64Encode = function (s) { return btoa(unescape(encodeURIComponent(s))); };
Utilities.getUuid = function () { return crypto.randomUUID(); };
var __props = { TEST_MODE: 'on' };
var PropertiesService = { getScriptProperties: function () { return { getProperty: function (k) { return __props[k] || null; } }; } };
var UrlFetchApp = { fetch: function () { throw new Error('시험에서는 토스를 부르지 않습니다'); } };
// 주문 관리 화면(대표 전용) — 로그인한 사람·화면 흉내
var __user = 'owner@test';
var Session = { getActiveUser: function () { return { getEmail: function () { return __user; } }; }, getEffectiveUser: function () { return { getEmail: function () { return 'owner@test'; } }; } };
var HtmlService = {
  createHtmlOutput: function (h) { return { html: h, setTitle: function () { return this; }, addMetaTag: function () { return this; } }; },
  createHtmlOutputFromFile: function (f) { return { file: f, setTitle: function (t) { this.title = t; return this; }, addMetaTag: function () { return this; } }; }
};
