// 두두 쇼핑 — 머리(로그인·장바구니)·장바구니 서랍·상품 상세·장바구니·주문서·결제·완료·비회원 주문조회·회원.
// 글자는 홈페이지_문안.md(03~03-6), 틀은 기획 10·11장. 곡식이 늘면 order-config.js 에 칸을 더하고 같은 틀의 HTML을 하나 더 둔다.
// 장바구니는 이 브라우저에만(localStorage). 개인정보는 보내기 전까지 어디에도 저장하지 않고, 주소(URL)에 싣지 않는다.
(function () {
  var C = window.DOODOO_CONFIG; if (!C) return;
  var CART = 'doodoo-cart', BUY = 'doodoo-buy', FORM = 'doodoo-form', TOKEN = 'doodoo-token', LAST = 'doodoo-last', SW = 'doodoo-sw';
  var S = { open: false, member: false, millDate: '', seatsLeft: null, info: null, me: null };

  // ───── 작은 도구 ─────
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function tel(s) { return String(s || '').replace(/\D/g, ''); }
  function has(v) { return v !== null && v !== undefined && v !== ''; }
  function esc(s) { return String(has(s) ? s : '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(ymd) { var m = String(ymd || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? Number(m[2]) + '월 ' + Number(m[3]) + '일' : ''; }
  function mdShort(ymd) { var m = String(ymd || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? Number(m[2]) + '/' + Number(m[3]) : ''; }
  function get(store, k, d) { try { var v = JSON.parse(store.getItem(k)); return v === null ? d : v; } catch (e) { return d; } }
  function put(store, k, v) { try { if (v === null || v === undefined) store.removeItem(k); else store.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function token() { return get(localStorage, TOKEN, null) || get(sessionStorage, TOKEN, null); }
  function setToken(t, keep) { put(localStorage, TOKEN, keep ? t : null); put(sessionStorage, TOKEN, keep ? null : t); }
  function post(body) {
    if (C.test) body.test = true;
    return fetch(C.endpoint, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); });
  }
  function toast(msg) {
    var t = $('.toast') || document.body.appendChild(Object.assign(document.createElement('div'), { className: 'toast', role: 'status' }));
    t.textContent = msg; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2200);
  }
  function photo(grain, cls) {   // 대표 사진(지은 밥) — 파일이 아직 없으면 임시 사진
    var p = C[grain].photo;
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="/assets/photos/' + p[0] + '.webp" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'/assets/photos/' + p[1] + '.webp\'">';
  }

  // ───── 고른 것 · 금액 ─────
  function glLabel(p) { return Number(p) === 0 ? '멥쌀만' : '찹쌀 ' + p + '%'; }
  function repeatLabel(r) { return !r || r === 'once' ? '한 번 구매' : '정기 배송 · ' + Math.round(Number(r) / 7) + '주마다'; }
  function opts(it) {
    var out = [];
    if (it.grain === 'rice') out.push(glLabel(it.glutinous));
    out.push(it.size + 'kg');
    if (it.subpack) out.push(C[it.grain].subpack.unit + 'kg 소포장');
    out.push(repeatLabel(it.repeat));
    return out.join(' · ');
  }
  function qty(it) { return Math.max(1, Number(it.qty) || 1); }
  function unitPrice(grain, size) { var p = C[grain].price[size]; return has(p) ? Number(p) : null; }
  function lineSub(it) { var g = C[it.grain]; return g.subpack && it.subpack ? Number(g.subpack.fee[it.size] || 0) * qty(it) : 0; }
  function lineAmt(it) { var p = unitPrice(it.grain, it.size); return p === null ? null : p * qty(it) + lineSub(it); }
  function per100(grain, size) { var p = unitPrice(grain, size); return p === null ? '' : '100g당 ' + won(Math.round(p / (size * 10))); }
  function priced(list) { return list.length > 0 && list.every(function (it) { return unitPrice(it.grain, it.size) !== null; }); }
  function totals(list) {
    var goods = 0, sub = 0;
    list.forEach(function (it) { goods += unitPrice(it.grain, it.size) * qty(it); sub += lineSub(it); });
    return { goods: goods, sub: sub, ship: has(C.shipping) ? Number(C.shipping) : null };
  }
  function shipText(n) { return n === 0 ? '무료 배송' : won(n); }
  function moneyRows(t, cut) {
    var rows = [['상품 금액', won(t.goods)]];
    if (t.sub) rows.push(['소포장', won(t.sub)]);
    if (t.ship !== null) rows.push(['배송비', shipText(t.ship)]);
    if (cut) rows.push([cut.why, '−' + won(cut.v), 'disc']);
    rows.push(['결제 예정 금액', won(t.goods + t.sub + (t.ship || 0) - (cut ? cut.v : 0)), 'total']);
    return '<dl>' + rows.map(function (r) { return '<div' + (r[2] ? ' class="' + r[2] + '"' : '') + '><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }

  // ───── 장바구니(이 브라우저) ─────
  function cart() { return get(localStorage, CART, []); }
  function saveCart(l) { put(localStorage, CART, l); paintDot(); renderDrawer(); }
  function same(a, b) { return a.grain === b.grain && String(a.glutinous) === String(b.glutinous) && a.size === b.size && !!a.subpack === !!b.subpack && String(a.repeat) === String(b.repeat); }
  function addToCart(it, editId) {
    var l = cart();
    if (editId) l = l.filter(function (x) { return x.id !== editId; });   // 옵션 변경 — 그 줄을 바꾼다
    var hit = l.filter(function (x) { return same(x, it); })[0];
    if (hit) hit.qty = qty(hit) + qty(it); else l.push(Object.assign({}, it, { id: editId || String(Date.now()) }));
    saveCart(l);
  }
  function paintDot() { var n = cart().length; $$('.dot').forEach(function (d) { d.textContent = n; d.hidden = !n; }); $$('[data-cart-open]').forEach(function (a) { a.setAttribute('aria-label', n ? '장바구니, ' + n + '개' : '장바구니'); }); }

  // ───── 서랍·옵션 창 ─────
  var scrim;
  function openPanel(el) { closePanels(); scrim.classList.add('on'); el.classList.add('on'); el.setAttribute('aria-hidden', 'false'); var f = $('button, a, input', el); if (f) f.focus(); }
  function closePanels() { $$('.drawer.on, .sheet.on').forEach(function (x) { x.classList.remove('on'); x.setAttribute('aria-hidden', 'true'); }); if (scrim) scrim.classList.remove('on'); }
  function lineHTML(it, mode) {   // mode: 'drawer' | 'cart' | 'ro'
    var a = lineAmt(it), img = photo(it.grain), m = it.grain === 'rice' && S.millDate ? '<span class="op">' + md(S.millDate) + ' 도정</span>' : '';
    var q = '<div class="qty" role="group" aria-label="수량"><button type="button" data-q="-1" aria-label="수량 줄이기">−</button><output>' + qty(it) + '</output><button type="button" data-q="1" aria-label="수량 늘리기">+</button></div>';
    if (mode === 'ro') return '<li class="cline ro">' + img + '<div><p class="nm">' + esc(C[it.grain].name) + '</p><p class="op">' + esc(opts(it)) + ' · ' + qty(it) + '개</p>' + m + '</div><p class="amt">' + (a === null ? '' : won(a)) + '</p></li>';
    return '<li class="cline" data-id="' + it.id + '">' + (mode === 'cart' ? '<input type="checkbox" checked aria-label="선택">' : '<span></span>') + img +
      '<div><p class="nm">' + esc(C[it.grain].name) + '</p><p class="op">' + esc(opts(it)) + '</p>' + m +
      '<div class="row">' + q + '<span class="amt">' + (a === null ? '' : won(a)) + '</span></div>' +
      '<div class="tools"><a class="link sub" href="/doodoo/' + it.grain + '/?edit=' + it.id + '">옵션 변경</a><button type="button" class="link sub" data-del>삭제</button></div></div></li>';
  }
  function bindLines(box, after) {
    $$('.cline[data-id]', box).forEach(function (li) {
      var id = li.dataset.id;
      $$('[data-q]', li).forEach(function (b) { b.addEventListener('click', function () { var l = cart(); l.forEach(function (x) { if (x.id === id) x.qty = Math.max(1, qty(x) + Number(b.dataset.q)); }); saveCart(l); if (after) after(); }); });
      $('[data-del]', li).addEventListener('click', function () { saveCart(cart().filter(function (x) { return x.id !== id; })); if (after) after(); });
    });
  }
  function renderDrawer() {
    var d = $('#cart-drawer'); if (!d) return;
    var l = cart(), body = $('.pan-b', d);
    if (!l.length) { body.innerHTML = '<div class="empty"><p>장바구니에 담긴 상품이 없습니다.</p><a class="btn line" href="/doodoo/">상품 보러 가기</a></div>'; $('.pan-f', d).hidden = true; return; }
    body.innerHTML = '<ul class="lines">' + l.map(function (it) { return lineHTML(it, 'drawer'); }).join('') + '</ul>';
    bindLines(body);
    var f = $('.pan-f', d); f.hidden = false;
    $('.money', f).innerHTML = priced(l) ? moneyRows(totals(l)) : '';
    $('.money', f).hidden = !priced(l);
  }
  function goBuy(list) {   // 구매하기 — 회원이면(스위치 켬) 로그인 갈림길, 아니면 바로 주문서
    put(sessionStorage, BUY, list);
    if (S.member && !token()) { closePanels(); openPanel($('#buy-choice')); return; }
    location.href = '/doodoo/order/';
  }

  // ───── 머리 ─────
  function header() {
    scrim = $('.scrim');
    if (scrim) scrim.addEventListener('click', closePanels);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanels(); });
    $$('[data-close]').forEach(function (b) { b.addEventListener('click', closePanels); });
    var menu = $('#menu-drawer');
    $$('.menu-btn').forEach(function (b) { b.addEventListener('click', function () { openPanel(menu); }); });
    $$('[data-cart-open]').forEach(function (a) { a.addEventListener('click', function (e) { if (!$('#cart-drawer')) return; e.preventDefault(); renderDrawer(); openPanel($('#cart-drawer')); }); });
    var d = $('#cart-drawer');
    if (d) $('[data-buy]', d).addEventListener('click', function () { goBuy(cart()); });
    var bc = $('#buy-choice');
    if (bc) {
      $('[data-login-order]', bc).addEventListener('click', function () { location.href = '/member/login/?next=' + encodeURIComponent('/doodoo/order/'); });
      $('[data-guest-order]', bc).addEventListener('click', function () { location.href = '/doodoo/order/'; });
    }
    paintDot();
  }
  function paintMember() {
    var t = token(), on = S.member;
    $$('[data-person]').forEach(function (a) {
      a.href = on ? (t ? '/member/' : '/member/login/') : '/doodoo/my/';
      a.setAttribute('aria-label', on ? (t ? '마이페이지' : '로그인') : '주문조회');
    });
    $$('[data-m="in"]').forEach(function (x) { x.hidden = !(on && t); });
    $$('[data-m="out"]').forEach(function (x) { x.hidden = !(on && !t); });
    $$('[data-m="on"]').forEach(function (x) { x.hidden = !on; });
    var nb = $('.notice-band');
    if (nb) { var txt = S.open && S.millDate ? md(S.millDate) + ' 도정분 주문 받는 중' : ''; nb.textContent = txt; nb.hidden = !txt; }
    $$('[data-need="kakao"]').forEach(function (x) { x.hidden = !C.kakao; });
    $$('a[data-kakao]').forEach(function (x) { if (C.kakao) x.href = C.kakao; });
    $$('[data-need="terms"]').forEach(function (x) { x.hidden = !C.terms; });
    $$('[data-pay-days]').forEach(function (x) { x.textContent = C.payDays; });
  }

  // ───── 상품 카드(11-6) ─────
  function cards() {
    $$('[data-card]').forEach(function (card) {
      var g = C[card.dataset.card]; if (!g) return;
      var b = $('.badge', card), s = g.sizes[0], p = s !== undefined ? unitPrice(card.dataset.card, s) : null;
      if (b) {
        var live = S.open && p !== null;
        var txt = card.dataset.card === 'rice' ? (live && S.millDate ? mdShort(S.millDate) + ' 도정' : '판매 예정') : (live ? '주문 받는 중' : '판매 예정');
        b.textContent = txt; b.classList.toggle('soon', txt === '판매 예정');
      }
      var pr = $('[data-card-price]', card), un = $('[data-card-unit]', card);
      if (pr) { pr.hidden = p === null; if (p !== null) pr.textContent = s + 'kg ' + won(p) + (card.dataset.card === 'rice' && g.sizes.length > 1 ? '부터' : ''); }
      if (un) { un.hidden = p === null; if (p !== null) un.textContent = per100(card.dataset.card, s); }
    });
  }

  // ───── 상품 상세(10-4) ─────
  function radios(box, name, items, checked) {
    box.innerHTML = items.map(function (o) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(o.value) + '"' + (String(o.value) === String(checked) ? ' checked' : '') +
        '><span>' + o.label + (o.tag ? '<em>' + o.tag + '</em>' : '') + '</span></label>';
    }).join('');
  }
  function val(form, name) { var x = form.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : null; }
  function product(form) {
    var grain = form.dataset.grain, g = C[grain];
    var edit = new URLSearchParams(location.search).get('edit');
    var cur = cart().filter(function (x) { return x.id === edit; })[0] || null;
    var d = md(S.millDate), live = S.open;
    $$('[data-mill-tag]').forEach(function (x) {
      var t = grain === 'rice' ? (live && d ? d + ' 도정' : '판매 예정') : (live && g.sizes.length ? '주문 받는 중' : '판매 예정');
      x.textContent = t; x.classList.toggle('soon', t === '판매 예정');
    });
    $$('[data-mill-ship]').forEach(function (x) { x.textContent = '택배 · ' + (d ? d + ' 도정 후 발송' : '도정 후 발송'); });
    $$('[data-mill-line]').forEach(function (x) { x.textContent = d; x.closest('[data-mill-row]') && (x.closest('[data-mill-row]').hidden = !d); });
    $$('[data-mill-guide]').forEach(function (x) { x.textContent = (d ? d + '에 ' : '') + '도정해 순차 발송합니다. 보내면 송장 번호를 알려 드립니다.'; });
    $$('[data-need="shipping"]').forEach(function (x) { x.hidden = !has(C.shipping); var dd = $('dd, td', x); if (dd && has(C.shipping)) dd.textContent = shipText(Number(C.shipping)); });
    $$('[data-need="year"]').forEach(function (x) { x.hidden = !g.year; var dd = $('dd, td', x); if (dd && g.year) dd.textContent = g.year; });
    var allPriced = g.sizes.length && g.sizes.every(function (s) { return unitPrice(grain, s) !== null; });
    var pw = $('[data-price-wait]'); if (pw) pw.hidden = !!allPriced;
    if (!g.sizes.length || !allPriced) {   // 단위·가격이 비면 고르기·단추를 숨긴다(가짜 값 금지)
      $$('[data-need="sizes"]').forEach(function (x) { x.hidden = true; });
      document.body.classList.remove('has-fixbar');
      return;
    }
    document.body.classList.add('has-fixbar');
    var gl = $('[data-opts="glutinous"]', form);
    if (gl) radios(gl, 'glutinous', g.glutinous.map(function (p) { return { value: p, label: glLabel(p), tag: p === g.recommend ? '추천' : '' }; }), cur ? cur.glutinous : g.recommend);
    radios($('[data-opts="size"]', form), 'size', g.sizes.map(function (s) { return { value: s, label: s + 'kg' }; }), cur ? cur.size : g.sizes[0]);
    var sp = $('[name="subpack"]', form); if (sp && cur) sp.checked = !!cur.subpack;
    radios($('[data-opts="repeat"]', form), 'repeat', [{ value: 'once', label: '한 번 구매' }, { value: 'regular', label: '정기 배송' }], cur && cur.repeat !== 'once' ? 'regular' : 'once');
    var cyc = g.cycles.map(function (x) { return { value: x, label: Math.round(x / 7) + '주마다' }; }).concat([{ value: 'custom', label: '직접 입력' }]);
    var curCycle = cur && cur.repeat !== 'once' ? (g.cycles.indexOf(Number(cur.repeat)) >= 0 ? cur.repeat : 'custom') : g.cycles[0];
    radios($('[data-opts="cycle"]', form), 'cycle', cyc, curCycle);
    if (cur && curCycle === 'custom') $('[name="cycleWeeks"]', form).value = Math.round(cur.repeat / 7);
    var q = cur ? qty(cur) : 1, qo = $('.qty output', form);
    $$('.qty [data-q]', form).forEach(function (b) { b.addEventListener('click', function () { q = Math.max(1, q + Number(b.dataset.q)); sync(); }); });

    function picked() {
      var repeat = 'once';
      if (val(form, 'repeat') === 'regular') { var c = val(form, 'cycle'); repeat = c === 'custom' ? Math.max(1, Number($('[name="cycleWeeks"]', form).value || 0)) * 7 : Number(c); }
      return { grain: grain, glutinous: gl ? Number(val(form, 'glutinous')) : null, size: Number(val(form, 'size')), subpack: !!(sp && sp.checked), repeat: repeat, qty: q };
    }
    function sync() {
      var reg = val(form, 'repeat') === 'regular';
      $('.cycle-box', form).hidden = !reg;
      $('.cycle-custom', form).hidden = !(reg && val(form, 'cycle') === 'custom');
      qo.textContent = q;
      var it = picked(), a = lineAmt(it);
      var so = $('[data-subpack-out]', form);
      if (so) { so.hidden = !it.subpack; so.textContent = it.subpack ? g.subpack.unit + 'kg × ' + Math.round(it.size / g.subpack.unit) + '봉 · +' + won(g.subpack.fee[it.size]) : ''; }
      var fl = $('[data-feel]', form); if (fl) { var t = g.feel && g.feel[it.glutinous]; fl.textContent = t || ''; fl.hidden = !t; }
      $$('[data-price]').forEach(function (x) { x.textContent = won(unitPrice(grain, it.size)); });
      $$('[data-unit]').forEach(function (x) { x.textContent = per100(grain, it.size); });
      $$('[data-total]').forEach(function (x) { x.textContent = won(a); });
    }
    form.addEventListener('change', sync); form.addEventListener('input', sync); sync();

    function add() { addToCart(picked(), cur ? cur.id : null); cur = null; renderDrawer(); openPanel($('#cart-drawer')); }
    function buyNow() { goBuy([Object.assign(picked(), { id: 'now' })]); }
    $$('[data-act="add"]').forEach(function (b) { b.addEventListener('click', function () { if (b.closest('.fixbar') && !sheetOpen()) return openSheet(); add(); }); });
    $$('[data-act="buy"]').forEach(function (b) { b.addEventListener('click', function () { if (b.closest('.fixbar') && !sheetOpen()) return openSheet(); buyNow(); }); });

    // 폰: 옵션은 아래에서 올라오는 옵션 창에서 고른다(상세 페이지를 오르내리지 않게)
    var sheet = $('#opt-sheet'), home = form.parentNode, anchor = form.nextSibling, mq = matchMedia('(max-width:899px)');
    function sheetOpen() { return sheet && sheet.classList.contains('on'); }
    function place() { if (!sheet) return; if (mq.matches) $('.pan-b', sheet).appendChild(form); else home.insertBefore(form, anchor); }
    function openSheet() { place(); openPanel(sheet); }
    if (mq.addEventListener) mq.addEventListener('change', place); place();

    // 필요량 계산하기
    var co = $('[data-calc-open]', form), box = $('#calc', form);
    if (co && box) {
      co.addEventListener('click', function () { box.hidden = !box.hidden; co.setAttribute('aria-expanded', String(!box.hidden)); });
      var run = function () {
        var n = Number($('[name="people"]', box).value), f = C.rice.mealFactor[$('[name="meals"]', box).value];
        var month = n * C.rice.perCapitaDailyG * 30 * f / 1000;
        $('.calc-out', box).textContent = '한 달 약 ' + month.toFixed(1) + 'kg · 10kg이 약 ' + Math.round(10 / (month / 30 * 7)) + '주 분량입니다.';
      };
      box.addEventListener('change', run); run();
    }
    // 지난번과 같게 — 로그인했을 때만
    var rc = $('[data-recall]', form);
    if (rc) {
      rc.hidden = !(S.member && token() && C.endpoint);
      $('button', rc).addEventListener('click', function () {
        var msg = $('.hint', rc);
        post({ kind: 'member', action: 'recall', token: token() }).then(function (r) {
          var k = r.ok && r.combos && r.combos[grain];
          if (!k) { msg.textContent = '지난 주문이 없습니다.'; return; }
          ['glutinous', 'size'].forEach(function (n) { var x = form.querySelector('input[name="' + n + '"][value="' + k[n] + '"]'); if (x) x.checked = true; });
          if (sp) sp.checked = !!k.subpack;
          msg.textContent = ''; sync();
        }).catch(function () { msg.textContent = '잠시 후 다시 시도해 주세요.'; });
      });
    }
    // 사진 칸
    $$('.thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.thumbs button').forEach(function (x) { x.removeAttribute('aria-current'); });
        b.setAttribute('aria-current', 'true');
        var mi = $('.gallery .main img'); mi.onerror = null; mi.src = $('img', b).currentSrc || $('img', b).src; mi.alt = $('img', b).alt;
      });
    });
  }
  // 탭 바 — 지금 보이는 구역을 표시
  function tabs() {
    var links = $$('.tabs a'); if (!links.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) links.forEach(function (a) { if (a.hash === '#' + e.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); });
    }, { rootMargin: '-40% 0px -55% 0px' });
    links.forEach(function (a) { var s = $(a.hash); if (s) io.observe(s); });
  }

  // ───── 장바구니 페이지(서랍을 넓게) ─────
  function cartPage(box) {
    function draw() {
      var l = cart();
      $('#cart-empty').hidden = l.length > 0; $('#cart-full').hidden = !l.length;
      $('#cart-lines').innerHTML = l.map(function (it) { return lineHTML(it, 'cart'); }).join('');
      bindLines($('#cart-lines'), draw);
      $$('#cart-lines input[type=checkbox]').forEach(function (c) { c.addEventListener('change', money); });
      money();
    }
    function chosen() { return $$('#cart-lines .cline').filter(function (li) { return $('input', li).checked; }).map(function (li) { return cart().filter(function (x) { return x.id === li.dataset.id; })[0]; }).filter(Boolean); }
    function money() {
      var l = chosen(), m = $('#cart-money');
      $('[name="all"]', box).checked = l.length === cart().length && l.length > 0;
      $('#cart-buy').disabled = !l.length;
      m.innerHTML = priced(l) ? moneyRows(totals(l)) : '';
      m.hidden = !priced(l);
    }
    $('[name="all"]', box).addEventListener('change', function () { var on = this.checked; $$('#cart-lines input[type=checkbox]').forEach(function (c) { c.checked = on; }); money(); });
    $('#cart-del').addEventListener('click', function () { var ids = chosen().map(function (x) { return x.id; }); saveCart(cart().filter(function (x) { return ids.indexOf(x.id) < 0; })); draw(); });
    $('#cart-buy').addEventListener('click', function () { goBuy(chosen()); });
    draw();
  }

  // ───── 주문서 · 결제 · 완료(10-5·11-7·11-9) ─────
  function orderPage(root) {
    var q = new URLSearchParams(location.search), form = $('#order-form'), list = get(sessionStorage, BUY, []);
    var btn = $('#pay-btn'), err = $('#pay-err'), me = null, widget = null, method = 'VA';
    if (q.get('pay') === 'success') return confirmPay(q);
    if (q.get('pay') === 'fail') {
      post({ kind: 'pay-abort', orderId: q.get('orderId') || (get(sessionStorage, LAST, {}) || {}).no, tel: (get(sessionStorage, FORM, {}) || {}).phone, token: token(), code: q.get('code') }).catch(function () {});
      history.replaceState(null, '', location.pathname);
      showErr('결제가 완료되지 않았습니다. 다시 시도해 주세요.');
      var goMethods = true;   // 위젯이 다 그려진 뒤 결제 수단으로 데려간다
    }
    function toMethods() {   // 결제 수단을 바꾸려면 위젯으로 — 결제창을 닫거나 실패한 뒤 바로 보이게
      var m = $('#h-pay'); if (!m) return;
      window.scrollTo(0, m.getBoundingClientRect().top + window.scrollY - 80);
    }
    if (!list.length) { $('#order-empty').hidden = false; form.hidden = true; $('#order-aside').hidden = true; return; }
    $('#order-lines').innerHTML = list.map(function (it) { return lineHTML(it, 'ro'); }).join('');
    restore();
    function showErr(t) { err.textContent = t; err.hidden = !t; }
    // 회원: 주문자·배송지 채움(접힌 요약 + 변경), 소식 동의 다시 묻지 않음
    var t = token();
    if (S.member && t && C.endpoint) {
      post({ kind: 'member', action: 'me', token: t }).then(function (r) {
        if (!r.ok) return;
        me = r.me; S.info = { count: me['횟수'], ho: me['호'], consent: me['소식'], newsEver: me['소식'] };
        f('name').value = me['이름']; f('phone').value = me['연락처']; f('address').value = me['주소']; f('addr2').value = me['상세주소']; f('zip').value = me['우편번호'];
        $('#buyer-fold').hidden = false; $('#buyer-fold b').textContent = me['이름'] + ' · ' + me['연락처'] + ' · ' + me['주소'] + ' ' + me['상세주소'];
        $('#buyer-fields').hidden = true; $('.agree-news', form).hidden = true;
        money();
      }).catch(function () {});
    }
    $('#buyer-edit').addEventListener('click', function () { $('#buyer-fields').hidden = false; $('#buyer-fold').hidden = true; });
    function f(n) { return form.querySelector('[name="' + n + '"]'); }
    // 남은 양 확인 1 — 주문서 진입
    if (C.endpoint) post({ kind: 'stock', items: list }).then(function (r) { if (r.short) { showErr('남은 양이 부족해 주문할 수 없습니다. 수량을 줄이거나 다음 도정일을 기다려 주세요.'); btn.disabled = true; } if (r['도정일']) S.millDate = r['도정일']; }).catch(function () {});
    f('phone').addEventListener('change', function () {
      if (!C.endpoint || me) return;
      var p = tel(this.value); if (p.length < 10) return;
      post({ kind: 'recall', tel: p }).then(function (d) { S.info = d.limited ? null : d; $('.agree-news', form).hidden = !!d.consent; money(); }).catch(function () {});
    });
    form.addEventListener('change', function (e) {
      $('.gift-box', form).hidden = val(form, 'to') !== 'gift';
      var all = f('all'), boxes = $$('.agree-item input', form).filter(function (x) { return !x.closest('[hidden]'); });
      if (e.target === all) boxes.forEach(function (x) { x.checked = all.checked; });
      else all.checked = boxes.length > 0 && boxes.every(function (x) { return x.checked; });
      if (e.target.name) { var er = $('[data-err="' + e.target.name + '"]', form); if (er) er.hidden = true; }
      money();
    });
    $$('[data-addr-search]', form).forEach(function (b) { b.addEventListener('click', function () { addrSearch(function (a) { f('zip').value = a.zip; f('address').value = a.addr; f('addr2').focus(); }); }); });
    var onlySoy = list.every(function (it) { return it.grain === 'soy'; });
    $$('[data-refund="rice"]', form).forEach(function (x) { x.hidden = onlySoy; });
    $$('[data-refund="soy"]', form).forEach(function (x) { x.hidden = !onlySoy; });

    function newsOn() { var i = S.info || {}; return !!(i.newsEver || i.consent || f('news').checked); }
    function firstHo() { var i = S.info; return !!(i && !i.ho && !(i.count > 0) && S.seatsLeft > 0); }
    function cut(tt) {   // 할인 = 구매금액(주문 상품 금액, 배송비 제외)의 10% · ○호와 3번째 주문은 겹치지 않음
      var d = C.discount, i = S.info || {}, n = (i.count || 0) + 1, base = tt.goods + tt.sub;
      if (i.ho) return { v: Math.round(base * d.hoRate / 100), why: '두두 ' + i.ho + '호 고객 ' + d.hoRate + '% 할인' };
      if (firstHo()) return { v: Math.round(base * d.hoRate / 100), why: '두두 ○호 고객 ' + d.hoRate + '% 할인' };
      if (newsOn() && n % d.every === 0) return { v: Math.round(base * d.rate / 100), why: n + '번째 주문 ' + d.rate + '% 할인' };
      return null;
    }
    function perks() {
      var ho = $('[data-perk="ho"]'), d = C.discount; ho.hidden = S.seatsLeft === 0;
      var seats = $('.seats', ho); seats.hidden = !has(S.seatsLeft); if (!seats.hidden) $('b', seats).textContent = S.seatsLeft;
      var line = $('[data-perk="line"]'), i = S.info;
      if (!i) { line.hidden = true; return; }
      var n = (i.count || 0) + 1;
      line.textContent = i.ho ? '두두 ' + i.ho + '호 고객 ' + d.hoRate + '% 할인' : firstHo() ? '두두 ○호 고객 ' + d.hoRate + '% 할인'
        : newsOn() && n % d.every === 0 ? '이번 주문 ' + d.rate + '% 할인' : '이번이 ' + n + '번째 주문 · 다음 할인까지 ' + (d.every - n % d.every) + '번';
      line.hidden = false;
    }
    var amount = null;
    function money() {
      perks();
      var m = $('#order-money');
      if (!priced(list)) { m.hidden = true; amount = null; btn.textContent = '결제하기'; return; }
      var tt = totals(list), c = cut(tt);
      amount = tt.goods + tt.sub + (tt.ship || 0) - (c ? c.v : 0);
      m.innerHTML = '<h2 class="h3">결제 예정 금액</h2>' + moneyRows(tt, c); m.hidden = false;
      btn.textContent = won(amount) + ' 결제하기';
      if (widget) widget.setAmount(amount);
    }
    money();
    // 결제 수단 — 토스 결제위젯(순서·기본 선택은 토스 결제 어드민: 무통장 입금(가상계좌) · 카드 · 간편결제 · 휴대폰)
    widget = payWidget($('#pay-methods'), $('#pay-agree'), amount || 0, me, function (m) { method = m; $('#va-note').hidden = m !== 'VA'; });
    if (goMethods) ((widget && widget.ready) || Promise.resolve()).then(function () { setTimeout(toMethods, 400); });
    if (!C.endpoint || !S.open || !widget) btn.disabled = true;

    function check() {
      var bad = [], v = function (n) { return (f(n).value || '').trim(); };
      function need(n, ok) { var e = $('[data-err="' + n + '"]', form); if (e) e.hidden = ok; if (!ok) bad.push(n); }
      need('name', !!v('name')); need('phone', /^01\d{8,9}$/.test(tel(v('phone'))));
      if (val(form, 'to') === 'gift') { need('giftName', !!v('giftName')); need('giftPhone', /^01\d{8,9}$/.test(tel(v('giftPhone')))); }
      need('address', !!v('address')); need('refund', f('refund').checked);
      if (bad.length) { if (bad[0] !== 'refund' || true) { $('#buyer-fields').hidden = false; $('#buyer-fold').hidden = true; } var x = f(bad[0]); if (x) x.focus(); }
      return !bad.length;
    }
    function fields() {
      var o = {}; $$('input, textarea', form).forEach(function (x) { if (!x.name) return; if (x.type === 'radio') { if (x.checked) o[x.name] = x.value; } else if (x.type === 'checkbox') o[x.name] = x.checked; else o[x.name] = x.value.trim(); });
      return o;
    }
    function restore() { var o = get(sessionStorage, FORM, null); if (!o) return; Object.keys(o).forEach(function (k) { var x = f(k); if (!x) return; if (x.type === 'checkbox') x.checked = !!o[k]; else if (x.type === 'radio') { var r = form.querySelector('[name="' + k + '"][value="' + o[k] + '"]'); if (r) r.checked = true; } else x.value = o[k]; }); }
    btn.addEventListener('click', function () {
      showErr('');
      if (!check()) return;
      var o = fields(); btn.disabled = true;
      var addr = [o.address, o.addr2].filter(Boolean).join(' ');
      var body = { kind: 'checkout', token: me ? token() : undefined, items: list, '이름': o.name, '연락처': tel(o.phone), '주소': addr,
                   '받는 분': o.to === 'gift' ? { '이름': o.giftName, '연락처': tel(o.giftPhone), '주소': addr } : null, '요청사항': o.memo || '',
                   '동의': ['환불확인'].concat(o.news ? ['소식'] : []) };
      post(body).then(function (r) {   // 남은 양 확인 2 + 자리 잡기 — 금액은 규칙 일꾼이 정한 값
        if (r.short) throw { msg: '남은 양이 부족해 주문할 수 없습니다. 수량을 줄이거나 다음 도정일을 기다려 주세요.' };
        if (!r.ok) throw {};
        put(sessionStorage, FORM, o); put(sessionStorage, LAST, { no: r['주문번호'] });
        widget.setAmount(r['청구액']);
        return widget.request({ orderId: r.tossOrderId || r['주문번호'], orderName: r.orderName, amount: r['청구액'], customerName: o.name, customerMobilePhone: tel(o.phone),
                                successUrl: location.origin + '/doodoo/order/?pay=success', failUrl: location.origin + '/doodoo/order/?pay=fail&orderId=' + encodeURIComponent(r['주문번호']) });
      }).catch(function (e) {   // 결제창을 닫았거나 실패 — 잡아 둔 자리를 바로 푼다
        var last = get(sessionStorage, LAST, null);
        if (last && last.no) post({ kind: 'pay-abort', orderId: last.no, tel: tel(o.phone), token: me ? token() : undefined, code: (e && e.code) || 'CLOSED' }).catch(function () {});
        btn.disabled = false; showErr((e && e.msg) || '결제가 완료되지 않았습니다. 다시 시도해 주세요.');
        if (!(e && e.msg)) toMethods();
      });
    });

    function confirmPay(qp) {
      form.hidden = true; $('#order-aside').hidden = true; $('#order-top').hidden = true; $('#paying').hidden = false;
      var body = { kind: 'pay-confirm', paymentKey: qp.get('paymentKey'), orderId: qp.get('orderId'), amount: Number(qp.get('amount')) };
      post(body).then(function (r) {
        if (!r.ok) throw r;
        var bought = get(sessionStorage, BUY, []);
        saveCart(cart().filter(function (x) { return !bought.some(function (b) { return b.id === x.id; }); }));
        history.replaceState(null, '', location.pathname);
        done(r, bought, get(sessionStorage, FORM, {}) || {});
        put(sessionStorage, BUY, null); put(sessionStorage, FORM, null);
      }).catch(function () {
        history.replaceState(null, '', location.pathname);
        $('#paying').hidden = true; location.replace('/doodoo/order/?pay=fail&orderId=' + encodeURIComponent(qp.get('orderId') || ''));
      });
    }
    function done(r, items, o) {
      $('#paying').hidden = true; var s = $('#order-done'); s.hidden = false;
      var va = r['가상계좌'], mill = md(r['도정일']);
      $('[data-done="card"]', s).hidden = !!va; $('[data-done="va"]', s).hidden = !va;
      if (va) { $('[data-va="bank"]', s).textContent = va['은행'] + ' ' + va['계좌']; $('[data-va="amt"]', s).textContent = won(r['청구액']); $('[data-va="due"]', s).textContent = md(va['기한']) + '까지'; }
      $$('[data-mill]', s).forEach(function (x) { x.textContent = mill; });
      $$('[data-mill-row]', s).forEach(function (x) { x.hidden = !mill; });
      $('[data-done="no"]', s).textContent = r['주문번호'];
      var rows = [['상품', items.map(function (it) { return esc(C[it.grain].name + ' · ' + opts(it) + ' · ' + qty(it) + '개'); }).join('<br>')]];
      if (mill) rows.push(['도정일', mill]);
      rows.push(['받는 분', esc(o.to === 'gift' ? o.giftName : o.name)]);
      rows.push([va ? '결제 예정 금액' : '결제 금액', won(r['청구액'])]);
      $('[data-done="items"]', s).innerHTML = rows.map(function (x) { return '<div><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>'; }).join('');
      $('[data-next="card"]', s).hidden = !!va; $('[data-next="va"]', s).hidden = !va;
      var member = S.member && token();
      $('[data-done-my="member"]', s).hidden = !member; $('[data-done-my="guest"]', s).hidden = !!member;
      $('[data-done-join]', s).hidden = !(S.member && !token());
      window.scrollTo(0, 0);
    }
  }
  // 토스페이먼츠 결제위젯 v2 — 클라이언트 키가 있으면 진짜 위젯, 미리보기 시범 운행(C.pay.mock)이면 흉내 위젯
  function payWidget(methodsBox, agreeBox, amount, me, onMethod) {
    if (C.pay.clientKey) {
      var w = null, ready = loadScript('https://js.tosspayments.com/v2/standard').then(function () {
        var tp = window.TossPayments(C.pay.clientKey);
        w = tp.widgets({ customerKey: me ? custKey() : window.TossPayments.ANONYMOUS });
        return w.setAmount({ currency: 'KRW', value: amount }).then(function () {
          return Promise.all([w.renderPaymentMethods({ selector: '#' + methodsBox.id, variantKey: 'DEFAULT' }), w.renderAgreement({ selector: '#' + agreeBox.id })]);
        }).then(function (r) {
          r[0].on('paymentMethodSelect', function (m) { onMethod(m && m.code === 'VIRTUAL_ACCOUNT' ? 'VA' : 'X'); });
        });
      });
      return {
        ready: ready,
        setAmount: function (v) { ready.then(function () { w.setAmount({ currency: 'KRW', value: v }); }); },
        request: function (p) { return ready.then(function () { return w.requestPayment({ orderId: p.orderId, orderName: p.orderName, successUrl: p.successUrl, failUrl: p.failUrl, customerName: p.customerName, customerMobilePhone: p.customerMobilePhone, windowTarget: 'self' /* PC도 겹친 창 대신 페이지 이동(닫기 X가 두 개 겹치지 않게) */ }); }); }
      };
    }
    if (C.pay.mock) {   // 미리보기 전용 — 실제 결제 아님
      var list = [['VA', '무통장 입금'], ['CARD', '신용·체크카드'], ['EASY', '카카오페이'], ['EASY', '네이버페이'], ['EASY', '토스페이'], ['PHONE', '휴대폰 결제']];
      methodsBox.innerHTML = '<div class="mock-pay opts" role="radiogroup" aria-label="결제 수단">' + list.map(function (m, i) {
        return '<label class="opt"><input type="radio" name="pm" value="' + m[0] + '"' + (i ? '' : ' checked') + '><span>' + m[1] + '</span></label>';
      }).join('') + '</div><label class="check mock-note"><input type="checkbox" name="pmfail"> 미리보기 시험: 결제 실패로 돌려보내기</label><p class="mock-note">미리보기 시범 운행 — 실제 결제가 일어나지 않습니다.</p>';
      $$('input[name="pm"]', methodsBox).forEach(function (r) { r.addEventListener('change', function () { onMethod(r.value); }); });
      onMethod('VA');
      return {
        setAmount: function () {},
        request: function (p) {
          var m = $('input[name="pm"]:checked', methodsBox).value, fail = $('input[name="pmfail"]', methodsBox).checked;
          location.href = fail ? p.failUrl + '&code=PAY_PROCESS_CANCELED&message=' + encodeURIComponent('사용자가 결제를 취소했습니다')
            : p.successUrl + '&paymentType=NORMAL&paymentKey=mock_' + m + '_' + Date.now() + '&orderId=' + encodeURIComponent(p.orderId) + '&amount=' + p.amount;
          return new Promise(function () {});
        }
      };
    }
    methodsBox.innerHTML = '';
    return null;
  }
  function custKey() { var k = get(localStorage, 'doodoo-ck', null); if (!k) { k = 'dd-' + (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2)); put(localStorage, 'doodoo-ck', k); } return k; }
  function loadScript(src) { return new Promise(function (ok, no) { var s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); }); }
  function addrSearch(cb) {   // 카카오(다음) 우편번호 서비스 — 눌렀을 때만 불러오고, 팝업이 막히지 않게 화면 안 창에 넣는다
    var go = function () {
      var sh = $('#addr-sheet');
      if (!sh) {
        sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'addr-sheet'; sh.setAttribute('aria-label', '주소 검색'); sh.setAttribute('aria-hidden', 'true');
        sh.innerHTML = '<div class="grab"></div><div class="pan-h"><b>주소 검색</b><button class="ib" type="button" data-close aria-label="닫기"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div><div class="addr-box"></div>';
        document.body.appendChild(sh);
        $('[data-close]', sh).addEventListener('click', closePanels);
      }
      var box = $('.addr-box', sh); box.innerHTML = '';
      new window.daum.Postcode({ width: '100%', height: '100%', oncomplete: function (d) { closePanels(); cb({ zip: d.zonecode, addr: d.roadAddress || d.jibunAddress }); } }).embed(box);
      openPanel(sh);
    };
    if (window.daum && window.daum.Postcode) go(); else loadScript('https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js').then(go).catch(function () { toast('주소 검색을 열지 못했습니다. 주소를 직접 적어 주세요.'); });
  }

  // ───── 주문 한 건 보기(비회원 주문조회·마이페이지 공통 · 문안 03-2c) ─────
  function orderCard(d, act) {
    var steps = d.steps.map(function (s, i) { var c = d.canceled ? '' : i < d.step ? ' class="past"' : i === d.step ? ' class="now" aria-current="step"' : ''; return '<li' + c + '>' + s + '</li>'; }).join('');
    var rows = [['주문일', esc(d.date)], ['상품', d.items.map(esc).join('<br>')]];
    if (d.total !== null) rows.push(['결제 금액', won(d.total)]);
    if (d.pay) rows.push(['결제 수단', esc(d.pay)]);
    if (d.millDate) rows.push(['도정일', md(d.millDate)]);
    if (d.invoice) rows.push(['송장 번호', esc(d.invoice) + ' <a href="' + esc(d.trackUrl) + '" target="_blank" rel="noopener">배송 조회</a>']);
    rows.push(['받는 분', esc(d.to.name) + (d.to.region ? ' · ' + esc(d.to.region) : '')]);
    var h = '<article class="order-card" data-no="' + esc(d.no) + '"><h2 class="h3">' + (d.canceled ? '취소된 주문 ' : '주문 ') + esc(d.no) + '</h2>' +
      (d.canceled ? '' : '<ol class="steps" aria-label="진행 단계">' + steps + '</ol>') + '<dl class="dl">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
    if (d.va) h += '<div class="va"><p class="small">입금 계좌</p><b>' + esc(d.va['은행'] + ' ' + d.va['계좌']) + '</b><p class="small">' + md(d.va['기한']) + '까지</p></div>';
    if (d.cancelAsked) h += '<p class="hint">취소 요청을 받았습니다. 확인 후 연락드립니다.</p>';
    if (d.regular && d.nextDate) h += '<p>정기 배송 · 다음 배송 <b>' + md(d.nextDate) + '</b> 도정</p>';
    if (d.paused && !d.canceled) h += '<p class="hint">다음 예약부터 멈춥니다.</p>';
    var acts = [];
    if (act.again && d.items_raw) acts.push('<button type="button" class="btn line sm" data-a="again">같은 상품 다시 담기</button>');
    if (d.regular && act.cycle) acts.push('<button type="button" class="btn line sm" data-a="cycle">주기 바꾸기</button>');
    if (d.regular) acts.push('<button type="button" class="btn line sm" data-a="pause">' + (act.cycle ? '정기 배송 멈추기' : '정기 주문 멈추기') + '</button>');
    if (d.canCancel) acts.push('<button type="button" class="btn line sm" data-a="cancel">주문 취소하기</button>');
    if (acts.length) h += '<div class="acts">' + acts.join('') + '</div>';
    h += '<div class="my-confirm box" hidden><p>이 주문을 취소할까요? 입금하셨다면 전액 환불해 드립니다.</p><div class="two"><button type="button" class="btn" data-a="yes">취소하기</button><button type="button" class="btn line" data-a="no">그대로 두기</button></div></div>';
    h += '<div class="my-cycle box" hidden><div class="opts">' + C.rice.cycles.map(function (x) { return '<label class="opt"><input type="radio" name="cy-' + esc(d.no) + '" value="' + x + '"><span>' + Math.round(x / 7) + '주마다</span></label>'; }).join('') + '</div><button type="button" class="btn sm" data-a="cycle-save">주기 바꾸기</button></div>';
    return h + '</article>';
  }
  function bindCard(el, d, run) {
    var cf = $('.my-confirm', el), cy = $('.my-cycle', el);
    $$('[data-a]', el).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.a;
        if (a === 'cancel') { cf.hidden = false; $('[data-a="yes"]', cf).focus(); }
        else if (a === 'no') cf.hidden = true;
        else if (a === 'cycle') cy.hidden = !cy.hidden;
        else if (a === 'again') { d.items_raw.forEach(function (it) { addToCart({ grain: it.grain, glutinous: it.glutinous, size: Number(it.size), subpack: !!it.subpack, repeat: it.repeat || 'once', qty: qty(it) }); }); renderDrawer(); openPanel($('#cart-drawer')); }
        else { b.disabled = true; var x = a === 'cycle-save' ? { action: 'cycle', days: Number(($('input:checked', cy) || {}).value) } : { action: a === 'yes' ? 'cancel' : 'pause' }; run(x).then(function () { b.disabled = false; }); }
      });
    });
  }
  function myPage(form) {   // 비회원 주문조회
    var out = $('#my-result'), msg = $('.my-msg', form), cur = { tel: '', no: '' };
    var last = get(sessionStorage, LAST, null); if (last && last.no) form.no.value = last.no;
    if (!C.endpoint) $('button[type=submit]', form).disabled = true;
    function fail(d) { out.hidden = true; msg.hidden = false; msg.textContent = d && d.limited ? '잠시 후 다시 시도해 주세요.' : '일치하는 주문이 없습니다. 휴대폰 번호와 주문번호를 다시 확인해 주세요.'; }
    function ask(no) { cur.no = no; return post({ kind: 'lookup', tel: cur.tel, no: no }).then(function (d) { if (d.found) render(d); else fail(d); }).catch(function () { fail({ limited: true }); }); }
    function render(d) {
      msg.hidden = true; out.hidden = false;
      out.innerHTML = orderCard(d, {}) + (d.others && d.others.length ? '<h2 class="h3">같은 번호의 다른 주문</h2><ul class="lines">' + d.others.map(function (o) { return '<li><button type="button" class="link" data-other="' + esc(o.no) + '"><b>' + esc(o.no) + '</b>&nbsp;<span class="sub">' + esc(o.date + ' · ' + o.grain + ' · ' + o.step) + '</span></button></li>'; }).join('') + '</ul>' : '');
      bindCard($('.order-card', out), d, function (x) { return post({ kind: x.action === 'cancel' ? 'cancel' : 'pause', tel: cur.tel, no: cur.no }).then(function (r) { if (r.view) render(r.view); else fail(r); }); });
      $$('[data-other]', out).forEach(function (b) { b.addEventListener('click', function () { ask(b.dataset.other); }); });
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); cur.tel = tel(form.tel.value); var no = form.no.value.trim().toUpperCase();
      if (cur.tel.length < 10 || !no) return fail();
      ask(no);
    });
  }

  // ───── 회원(03-6) ─────
  function guard() { if (!S.member) { location.replace('/doodoo/my/'); return false; } return true; }
  function codeBox(root, purpose, onOk) {   // 휴대폰 번호 → 인증번호 받기 → 6자리 확인(3분)
    var telIn = $('[name="tel"]', root), codeIn = $('[name="code"]', root), msg = $('[data-code-msg]', root), timer = $('[data-timer]', root), dev = $('[data-dev]', root);
    var left = 0, h;
    $('[data-send]', root).addEventListener('click', function () {
      var p = tel(telIn.value); if (!/^01\d{8,9}$/.test(p)) { msg.textContent = '휴대폰 번호를 다시 확인해 주세요.'; return; }
      post({ kind: 'code', tel: p, purpose: purpose }).then(function (r) {
        if (r.exists) { msg.innerHTML = '이미 가입된 번호입니다. <a href="/member/login/">로그인</a> · <a href="/member/find/">비밀번호 찾기</a>'; return; }
        if (r.notMember) { msg.textContent = '휴대폰 번호 또는 비밀번호가 맞지 않습니다.'; return; }
        if (r.limited) { msg.textContent = '잠시 후 다시 시도해 주세요.'; return; }
        if (!r.ok) { msg.textContent = '잠시 후 다시 시도해 주세요.'; return; }
        msg.textContent = '인증번호를 보냈습니다.'; $('[data-code-row]', root).hidden = false; codeIn.focus();
        dev.hidden = !r.devCode; if (r.devCode) dev.textContent = '미리보기 시험 — 인증번호 ' + r.devCode;
        left = r.ttl || 180; clearInterval(h);
        h = setInterval(function () { left--; timer.textContent = '남은 시간 ' + Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2); if (left <= 0) { clearInterval(h); timer.textContent = ''; } }, 1000);
      }).catch(function () { msg.textContent = '잠시 후 다시 시도해 주세요.'; });
    });
    $('[data-verify]', root).addEventListener('click', function () {
      if (left <= 0) { msg.textContent = '시간이 지났습니다. 다시 받아 주세요.'; return; }
      post({ kind: 'verify', tel: tel(telIn.value), purpose: purpose, code: codeIn.value }).then(function (r) {
        if (r.expired) msg.textContent = '시간이 지났습니다. 다시 받아 주세요.';
        else if (!r.ok) msg.textContent = '인증번호가 맞지 않습니다.';
        else { clearInterval(h); timer.textContent = ''; msg.innerHTML = '<span class="ok">인증되었습니다.</span>'; telIn.readOnly = true; onOk(r.verifyToken, tel(telIn.value)); }
      }).catch(function () { msg.textContent = '잠시 후 다시 시도해 주세요.'; });
    });
  }
  function joinPage(form) {
    if (!guard()) return;
    var vt = null, p = null;
    codeBox(form, 'join', function (t, ph) { vt = t; p = ph; });
    $('[data-addr-search]', form).addEventListener('click', function () { addrSearch(function (a) { form.zip.value = a.zip; form.address.value = a.addr; form.addr2.focus(); }); });
    var all = form.all, boxes = $$('.agree-item input', form);
    form.addEventListener('change', function (e) { if (e.target === all) boxes.forEach(function (x) { x.checked = all.checked; }); else all.checked = boxes.every(function (x) { return x.checked; }); });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var err = $('[data-join-err]', form), say = function (t) { err.textContent = t; err.hidden = !t; return false; };
      if (!vt) return say('휴대폰 인증을 해 주세요.');
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password.value)) return say('비밀번호는 8자 이상, 영문·숫자를 섞어 주세요.');
      if (form.password.value !== form.password2.value) return say('비밀번호가 서로 다릅니다.');
      if (!form.name.value.trim()) return say('이름을 적어 주세요.');
      if (!form.address.value.trim()) return say('받으실 주소를 적어 주세요.');
      if (!form.terms.checked || !form.privacy.checked || !form.age.checked) return say('필수 약관에 동의해 주세요.');
      post({ kind: 'join', tel: p, verifyToken: vt, password: form.password.value, '이름': form.name.value.trim(), '주소': form.address.value.trim(), '상세 주소': form.addr2.value.trim(), '우편번호': form.zip.value, news: form.news.checked })
        .then(function (r) {
          if (r.exists) return say('이미 가입된 번호입니다.');
          if (!r.ok) return say('잠시 후 다시 시도해 주세요.');
          setToken(r.token, true); paintMember(); form.hidden = true; $('#join-done').hidden = false;
        }).catch(function () { say('잠시 후 다시 시도해 주세요.'); });
    });
  }
  function loginPage(form) {
    if (!guard()) return;
    var next = new URLSearchParams(location.search).get('next');
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var err = $('[data-login-err]', form);
      post({ kind: 'login', tel: tel(form.tel.value), password: form.password.value, keep: form.keep.checked }).then(function (r) {
        if (r.locked) { err.textContent = '10분 뒤 다시 시도해 주세요.'; err.hidden = false; return; }
        if (!r.ok) { err.textContent = '휴대폰 번호 또는 비밀번호가 맞지 않습니다.'; err.hidden = false; return; }
        setToken(r.token, form.keep.checked);
        location.href = next && /^\/[a-z]/.test(next) ? next : '/member/';
      }).catch(function () { err.textContent = '잠시 후 다시 시도해 주세요.'; err.hidden = false; });
    });
  }
  function findPage(form) {
    if (!guard()) return;
    var vt = null, p = null;
    codeBox(form, 'reset', function (t, ph) { vt = t; p = ph; $('[data-new-pw]', form).hidden = false; });
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var err = $('[data-find-err]', form), say = function (t) { err.textContent = t; err.hidden = !t; };
      if (!vt) return say('휴대폰 인증을 해 주세요.');
      if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(form.password.value)) return say('비밀번호는 8자 이상, 영문·숫자를 섞어 주세요.');
      if (form.password.value !== form.password2.value) return say('비밀번호가 서로 다릅니다.');
      post({ kind: 'reset', tel: p, verifyToken: vt, password: form.password.value }).then(function (r) {
        if (!r.ok) return say('잠시 후 다시 시도해 주세요.');
        form.hidden = true; $('#find-done').hidden = false;
      }).catch(function () { say('잠시 후 다시 시도해 주세요.'); });
    });
  }
  function mePage(root) {
    if (!guard()) return;
    if (!token()) { location.replace('/member/login/?next=/member/'); return; }
    function call(x) { return post(Object.assign({ kind: 'member', token: token() }, x)).then(function (r) { if (r.auth) { setToken(null); location.replace('/member/login/?next=/member/'); } return r; }); }
    function draw(me) {
      $('[data-me="name"]', root).textContent = me['이름'] + '님';
      var line = [];
      if (me['호']) line.push('두두 ' + me['호'] + '호 고객');
      var n = me['횟수'] + 1, k = C.discount.every - n % C.discount.every;
      line.push('이번이 ' + n + '번째 주문');
      if (has(me['다음할인까지'])) line.push(k === C.discount.every ? '이번 주문 ' + C.discount.rate + '% 할인' : '다음 할인까지 ' + k + '번');
      $('[data-me="perk"]', root).textContent = line.join(' · ');
      var ol = $('#me-orders'), reg = $('#me-regular');
      ol.innerHTML = me['주문'].length ? me['주문'].map(function (d) { return orderCard(d, { again: true }); }).join('') : '<p class="empty">주문 내역이 없습니다.</p>';
      var regs = me['주문'].filter(function (d) { return d.regular; });
      reg.innerHTML = regs.length ? regs.map(function (d) { return orderCard(d, { cycle: true }); }).join('') : '<p class="empty">정기 배송이 없습니다.</p>';
      [ol, reg].forEach(function (box) {
        $$('.order-card', box).forEach(function (el) {
          var d = me['주문'].filter(function (x) { return x.no === el.dataset.no; })[0];
          bindCard(el, d, function (x) { return call(Object.assign({ no: d.no }, x)).then(function () { return call({ action: 'me' }).then(function (r) { if (r.ok) draw(r.me); }); }); });
        });
      });
      var f = $('#me-form');
      f.name.value = me['이름']; f.address.value = me['주소']; f.addr2.value = me['상세주소']; f.zip.value = me['우편번호']; f.news.checked = !!me['소식'];
    }
    call({ action: 'me' }).then(function (r) { if (r.ok) draw(r.me); });
    $$('.me-tabs button', root).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.me-tabs button', root).forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        $$('[data-pane]', root).forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; });
      });
    });
    var f = $('#me-form');
    $('[data-addr-search]', f).addEventListener('click', function () { addrSearch(function (a) { f.zip.value = a.zip; f.address.value = a.addr; f.addr2.focus(); }); });
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var msg = $('[data-me-msg]', f);
      var x = { action: 'update', '이름': f.name.value, '주소': f.address.value, '상세 주소': f.addr2.value, '우편번호': f.zip.value, news: f.news.checked };
      if (f.newPassword.value) {
        if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(f.newPassword.value)) { msg.textContent = '비밀번호는 8자 이상, 영문·숫자를 섞어 주세요.'; return; }
        x.password = f.password.value; x.newPassword = f.newPassword.value;
      }
      call(x).then(function (r) {
        if (r.wrong) { msg.textContent = '휴대폰 번호 또는 비밀번호가 맞지 않습니다.'; return; }
        if (r.relogin) { setToken(null); location.replace('/member/login/?next=/member/'); return; }
        msg.innerHTML = r.ok ? '<span class="ok">저장했습니다.</span>' : '잠시 후 다시 시도해 주세요.';
        if (r.ok) draw(r.me);
      });
    });
    $('[data-logout]', root).addEventListener('click', function () { call({ action: 'logout' }).then(function () { setToken(null); location.href = '/'; }); });
    $('[data-leave]', root).addEventListener('click', function () { $('#leave-box').hidden = false; });
    $('[data-leave-no]', root).addEventListener('click', function () { $('#leave-box').hidden = true; });
    $('[data-leave-yes]', root).addEventListener('click', function () { call({ action: 'leave' }).then(function (r) { if (r.ok) { setToken(null); location.href = '/'; } }); });
  }

  // ───── 대량 주문·협력업체 문의(/contact/#bulk) ─────
  function bulk(form) {
    form.addEventListener('change', function () {
      $('.bulk-gl', form).hidden = !$$('input[name="grains"]:checked', form).some(function (x) { return x.value === '쌀'; });
      $('.bulk-cycle', form).hidden = val(form, 'how') !== '주기적으로';
    });
    form.dispatchEvent(new Event('change'));
    var btn = $('button[type=submit]', form);
    if (!C.endpoint) { btn.disabled = true; return; }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); if (!form.reportValidity()) return; btn.disabled = true;
      var o = {}; $$('input, textarea', form).forEach(function (x) { if (!x.name) return; if (x.type === 'radio') { if (x.checked) o[x.name] = x.value; } else if (x.type === 'checkbox') { if (x.checked) (o[x.name] = o[x.name] || []).push(x.value); } else o[x.name] = x.value.trim(); });
      post({ kind: 'bulk', mode: 'inquiry', '경로': '상담', '이름': o.name, '연락처': tel(o.phone), '상호': o.shop || '', '지역': o.region || '', '유형': o.use, '곡식': (o.grains || []).join(', '),
             '찹쌀': o.gl || '', '양': o.qty || '', '양 직접': o.qtyKg || '', '방식': o.how === '주기적으로' ? '주기적으로 ' + (o.cycle || '') : (o.how || ''), '시작': o.start || '', '포장': o.pack || '',
             '요청사항': o.memo || '', '동의': o.news ? ['소식'] : [] }).then(function (d) {
        if (!d.ok) throw 0;
        $$('fieldset, .notice-line, .check, button[type=submit]', form).forEach(function (x) { x.hidden = true; }); $('.sent', form).hidden = false;
      }).catch(function () { btn.disabled = false; toast('보내지 못했습니다. 잠시 후 다시 시도해 주세요.'); });
    });
  }

  function start() {
    header(); paintMember(); cards(); renderDrawer();
    var p = $('form[data-grain]'); if (p) product(p);
    tabs();
    var cp = $('#cart-page'); if (cp) cartPage(cp);
    var op = $('#order-page'); if (op) orderPage(op);
    var my = $('#my-form'); if (my) myPage(my);
    var j = $('#join-form'); if (j) joinPage(j);
    var l = $('#login-form'); if (l) loginPage(l);
    var fd = $('#find-form'); if (fd) findPage(fd);
    var me = $('#me-page'); if (me) mePage(me);
    var b = $('#bulk-form'); if (b) bulk(b);
  }
  // 스위치·도정일은 규칙 일꾼에게 묻는다(5분 기억). 답이 없으면 전부 끔.
  function apply(d) { S.open = !!(C.test || (d.switches && d.switches.order && (d.switches.pay_pg || C.pay.mock))); S.member = !!(C.test || (d.switches && d.switches.member)); S.millDate = d.millDate || ''; S.seatsLeft = has(d.seatsLeft) ? d.seatsLeft : null; }
  var cached = get(sessionStorage, SW, null);
  if (!C.endpoint) start();
  else if (cached && Date.now() - cached.at < 300000) { apply(cached.d); start(); }
  else fetch(C.endpoint + '?action=switches').then(function (r) { return r.json(); }).then(function (d) { put(sessionStorage, SW, { at: Date.now(), d: d }); apply(d); }).catch(function () {}).then(start);
})();
