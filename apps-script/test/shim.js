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
var SpreadsheetApp = { getActive: function () { return __book; } };
var __cache = {};
var CacheService = { getScriptCache: function () { return { get: function (k) { return __cache[k] || null; }, put: function (k, v) { __cache[k] = v; } }; } };
var LockService ={ getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
var ScriptApp = { getProjectTriggers: function () { return []; }, deleteTrigger: function () {},
  newTrigger: function () { var b = { timeBased: function () { return b; }, everyMinutes: function () { return b; }, create: function () {} }; return b; } };
var ContentService = { MimeType: { JSON: 'json' }, createTextOutput: function (s) { return { text: s, setMimeType: function () { return this; } }; } };
var Utilities = { formatDate: function (d, tz, fmt) {
  var p = function (n) { return ('0' + n).slice(-2); };
  return fmt.replace('yyyy', d.getFullYear()).replace('yy', String(d.getFullYear()).slice(-2))
    .replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()));
} };
