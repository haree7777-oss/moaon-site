// 두두 상품 상세(8구역)·장바구니 세 단계·대량 주문·협력업체 문의. 글자는 홈페이지_문안.md 03-1~03-3, 틀은 기획 3-1·3-2.
// 곡식이 늘면 order-config.js 에 칸을 더하고 같은 틀의 HTML을 하나 더 둔다 — 이 파일은 고치지 않는다.
// 장바구니는 이 브라우저에만 남는다(localStorage). 개인정보는 보내기 전까지 어디에도 저장하지 않는다.
(function () {
  var C = window.DOODOO_CONFIG;
  if (!C) return;
  var KEY = 'doodoo-cart', NOW = 'doodoo-now';
  var state = { order: C.order, seatsLeft: null, info: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function tel(s) { return String(s || '').replace(/\D/g, ''); }
  function read(store, k) { try { return JSON.parse(store.getItem(k)) || []; } catch (e) { return []; } }
  function write(store, k, v) { try { if (v) store.setItem(k, JSON.stringify(v)); else store.removeItem(k); } catch (e) {} }
  function load() { return read(localStorage, KEY); }
  function save(list) { write(localStorage, KEY, list); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function has(v) { return v !== null && v !== undefined && v !== ''; }

  // ───── 고른 것을 글로 ─────
  function glLabel(p) { return Number(p) === 0 ? '멥쌀만' : '찹쌀 ' + p + '%'; }
  function repeatLabel(r) { return !r || r === 'once' ? '한 번만' : Math.round(Number(r) / 7) + '주마다'; }
  function parts(it) {
    var g = C[it.grain], out = [];
    if (it.grain === 'rice') out.push(glLabel(it.glutinous));
    out.push(it.size + 'kg');
    if (g.subpack) out.push(it.subpack ? g.subpack.unit + 'kg씩 나눠 담기' : '한 봉으로');
    out.push(repeatLabel(it.repeat));
    return out;
  }
  function describe(it) { return C[it.grain].name + ' · ' + parts(it).join(' · '); }
  function price(it) { var p = C[it.grain].price[it.size]; return has(p) ? Number(p) : null; }
  function subFee(it) { var g = C[it.grain]; return g.subpack && it.subpack ? Number(g.subpack.fee[it.size] || 0) : 0; }
  function priced(list) { return list.length && list.every(function (it) { return price(it) !== null; }); }
  function totals(list) {
    var goods = 0, sub = 0;
    list.forEach(function (it) { goods += price(it) || 0; sub += subFee(it); });
    return { goods: goods, sub: sub, ship: has(C.shipping) ? Number(C.shipping) : null };
  }
  function shipText(n) { return n === 0 ? '무료 배송' : won(n); }

  // ───── 고르기 단추 ─────
  function radios(box, name, items, checked) {
    box.innerHTML = items.map(function (o) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(o.value) + '"' +
        (String(o.value) === String(checked) ? ' checked' : '') + '><span>' + o.label +
        (o.tag ? ' <em>' + o.tag + '</em>' : '') + '</span></label>';
    }).join('');
  }
  function val(form, name) { var x = form.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : null; }
  function setVal(form, name, v) { var x = form.querySelector('input[name="' + name + '"][value="' + v + '"]'); if (x) { x.checked = true; form.dispatchEvent(new Event('change')); } }

  // ───── 상품 상세 (기획 3-1) ─────
  function initProduct(form) {
    var grain = form.dataset.grain, g = C[grain];
    var edit = new URLSearchParams(location.search).get('edit');
    var cur = load().filter(function (x) { return x.id === edit; })[0] || null;

    // 가격 줄 — 비었을 때 문구
    var ps = g.sizes.map(function (s) { return has(g.price[s]) ? s + 'kg ' + won(g.price[s]) : null; });
    var pr = $('[data-price]');
    if (pr) pr.textContent = ps.length && ps.every(Boolean) ? ps.join(' · ') : '가격은 예약을 시작할 때 알려 드립니다.';
    $$('[data-ship]').forEach(function (x) { x.textContent = has(C.shipping) ? ' · ' + shipText(Number(C.shipping)) : ''; });
    $$('[data-need="shipping"]').forEach(function (x) { x.hidden = !has(C.shipping); if (has(C.shipping)) $('dd', x).textContent = shipText(Number(C.shipping)); });
    $$('[data-need="year"]').forEach(function (x) { x.hidden = !g.year; if (g.year) $('dd', x).textContent = g.year; });
    $$('[data-pay-days]').forEach(function (x) { x.textContent = C.payDays; });
    $$('[data-sizes]').forEach(function (x) { x.textContent = g.sizes.map(function (s) { return s + 'kg'; }).join(' · '); });

    // 양 단위가 비면 고르기·금액·단추·요약·고정 바를 모두 숨긴다(가짜 값 금지)
    if (!g.sizes.length) { $$('[data-need="sizes"]').forEach(function (x) { x.hidden = true; }); return; }

    var gl = $('[data-opts="glutinous"]', form);
    if (gl) radios(gl, 'glutinous', g.glutinous.map(function (p) { return { value: p, label: glLabel(p), tag: p === g.recommend ? '추천' : '' }; }), cur ? cur.glutinous : g.recommend);
    radios($('[data-opts="size"]', form), 'size', g.sizes.map(function (s) { return { value: s, label: s + 'kg' }; }), cur ? cur.size : g.sizes[0]);
    var sp = $('[data-opts="subpack"]', form);
    radios($('[data-opts="repeat"]', form), 'repeat', [{ value: 'once', label: '한 번만' }, { value: 'regular', label: '정기적으로' }], cur && cur.repeat !== 'once' ? 'regular' : 'once');
    var cycItems = g.cycles.map(function (d) { return { value: d, label: Math.round(d / 7) + '주마다' }; }).concat([{ value: 'custom', label: '직접 입력' }]);
    var curCycle = cur && cur.repeat !== 'once' ? (g.cycles.indexOf(Number(cur.repeat)) >= 0 ? cur.repeat : 'custom') : g.cycles[0];
    radios($('[data-opts="cycle"]', form), 'cycle', cycItems, curCycle);
    if (cur && curCycle === 'custom') $('[name="cycleWeeks"]', form).value = Math.round(cur.repeat / 7);

    function subpackOpts() {   // 나눠 담기 값은 양에 따라 바뀐다
      if (!sp) return;
      var size = Number(val(form, 'size')), was = val(form, 'subpack') || (cur && cur.subpack ? 'yes' : 'no');
      radios(sp, 'subpack', [{ value: 'no', label: '한 봉으로' },
        { value: 'yes', label: g.subpack.unit + 'kg씩 나눠 담기 +' + Number(g.subpack.fee[size]).toLocaleString('ko-KR') + '원' }], was);
    }
    function picked() {
      var repeat = 'once';
      if (val(form, 'repeat') === 'regular') {
        var c = val(form, 'cycle');
        repeat = c === 'custom' ? Math.max(1, Number($('[name="cycleWeeks"]', form).value || 0)) * 7 : Number(c);
      }
      return { id: cur ? cur.id : String(Date.now()), grain: grain, glutinous: gl ? Number(val(form, 'glutinous')) : null,
               size: Number(val(form, 'size')), subpack: sp ? val(form, 'subpack') === 'yes' : false, repeat: repeat };
    }
    function sync(e) {
      if (!e || (e.target && e.target.name === 'size')) subpackOpts();
      var regular = val(form, 'repeat') === 'regular';
      $('.cycle-box', form).hidden = !regular;
      $('.cycle-custom', form).hidden = !(regular && val(form, 'cycle') === 'custom');
      var it = picked(), p = price(it), amt = p === null ? null : p + subFee(it);
      var fl = $('[data-feel]', form);   // 고른 단추 아래 느낌 한 줄(★대표 확인 뒤 설정에 채움)
      if (fl) { var t = g.feel && g.feel[it.glutinous]; fl.textContent = t || ''; fl.hidden = !t; }
      $$('[data-amount]').forEach(function (x) { x.hidden = amt === null; if (amt !== null) $('b', x).textContent = won(amt); });
      var line = parts(it).join(' · ') + (amt === null ? '' : ' · ' + won(amt));
      $$('[data-summary]').forEach(function (x) { x.textContent = line; });
      var short = [it.size + 'kg'].concat(it.grain === 'rice' ? [glLabel(it.glutinous)] : []).concat(amt === null ? [] : [won(amt)]).join(' · ');
      $$('[data-summary-short]').forEach(function (x) { x.textContent = short; });
    }
    form.addEventListener('change', sync); form.addEventListener('input', sync); sync();

    function put() {
      var list = load(), it = picked(), i = list.map(function (x) { return x.id; }).indexOf(it.id);
      if (i >= 0) list[i] = it; else list.push(it);
      save(list); return it;
    }
    var buyText = state.order ? '바로 주문하기' : '예약 문의하기';
    $$('[data-act="buy"]').forEach(function (b) {
      b.textContent = b.dataset.short && state.order ? '주문하기' : buyText;
      b.addEventListener('click', function () {   // 그 곡식만 담고 주문서로(장바구니 건너뜀)
        write(sessionStorage, NOW, [picked()]); location.href = '../cart/#order';
      });
    });
    $$('[data-act="add"]').forEach(function (b) {
      if (cur) b.textContent = '바꾼 내용 담기';
      b.addEventListener('click', function () { put(); var m = b.closest('[data-acts]').nextElementSibling; if (m && m.classList.contains('added')) m.hidden = false; });
    });

    // 05 카드 — 비율 추천(★대표 확인)이 설정에 들어오면 누를 수 있게 된다
    $$('[data-use]').forEach(function (card) {
      var u = g.uses && g.uses[card.dataset.use];
      if (!u) return;
      var cap = $('figcaption', card); cap.insertAdjacentHTML('beforeend', '<span>' + esc(u.text) + '</span>');
      card.classList.add('pickable'); card.tabIndex = 0; card.setAttribute('role', 'button');
      function go() { setVal(form, 'glutinous', u.glutinous); $('#buy').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      card.addEventListener('click', go);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });

    // 폰 고정 바 — 구매 상자나 08의 단추가 보이면 숨긴다(같은 단추 두 번 안 보이게)
    var bar = $('.fixbar');
    if (bar && 'IntersectionObserver' in window) {
      var seen = new Set();
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        bar.classList.toggle('show', seen.size === 0);
      });
      $$('[data-acts]').forEach(function (x) { io.observe(x); });
    }

    initCalc();
    initRecall(form, grain);
  }

  // 얼마나 필요할까요?
  function initCalc() {
    var box = $('#calc'); if (!box) return;
    function run() {
      var n = Number($('[name="people"]', box).value), f = C.rice.mealFactor[$('[name="meals"]', box).value];
      var month = n * C.rice.perCapitaDailyG * 30 * f / 1000;
      var weeks = 10 / (month / 30 * 7);
      $('.calc-out', box).textContent = '한 달 약 ' + month.toFixed(1) + 'kg · 10kg이 약 ' + Math.round(weeks) + '주 분량입니다.';
    }
    box.addEventListener('change', run); run();
  }

  // 지난번과 같게 → (전화번호 → 조합만). 규칙 일꾼이 연결되기 전엔 링크를 숨긴다
  function initRecall(form, grain) {
    var open = $('[data-recall-open]'), box = $('#recall'); if (!open || !box) return;
    if (!C.endpoint) { open.hidden = true; return; }
    open.hidden = false;
    $('button', open).addEventListener('click', function () { box.hidden = !box.hidden; if (!box.hidden) $('input', box).focus(); });
    var msg = $('.recall-msg', box);
    $('button', box).addEventListener('click', function () {
      var t = tel($('input', box).value); if (t.length < 10) { msg.textContent = '휴대폰 번호를 다시 확인해 주세요.'; return; }
      fetch(C.endpoint + '?action=recall&tel=' + t).then(function (r) { return r.json(); }).then(function (d) {
        if (d.limited) { msg.textContent = '잠시 후 다시 시도해 주세요.'; return; }
        var k = d.found && d.combos && d.combos[grain];
        if (!k) { msg.textContent = '지난 주문이 없습니다.'; return; }
        ['glutinous', 'size'].forEach(function (n) { var x = form.querySelector('input[name="' + n + '"][value="' + k[n] + '"]'); if (x) x.checked = true; });
        form.dispatchEvent(new Event('change'));
        var s = form.querySelector('input[name="subpack"][value="' + (k.subpack ? 'yes' : 'no') + '"]'); if (s) s.checked = true;
        msg.textContent = ''; box.hidden = true; form.dispatchEvent(new Event('change'));
      }).catch(function () { msg.textContent = '잠시 후 다시 시도해 주세요.'; });
    });
  }

  // ───── 장바구니 · 주문서 · 완료 (기획 3-2) ─────
  function initCart() {
    var now = read(sessionStorage, NOW);
    var mode = location.hash === '#order' && now.length ? 'now' : 'cart';
    function list() { return mode === 'now' ? now : load(); }
    var form = $('#order-form');

    function show(n) {
      $$('[data-step]').forEach(function (x) { x.hidden = Number(x.dataset.step) !== n; });
      $$('.steps-bar li').forEach(function (li, i) { if (i + 1 === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
      if (n === 2) money2();
      window.scrollTo(0, 0);
    }

    // 1단계
    function renderCart() {
      var l = load(), box = $('#cart-items');
      $('#cart-empty').hidden = l.length > 0;
      $$('[data-has-items]').forEach(function (x) { x.hidden = !l.length; });
      box.innerHTML = l.map(function (it) {
        var p = price(it);
        return '<li><div><b>' + esc(C[it.grain].name) + '</b><span>' + esc(parts(it).join(' · ')) + '</span></div>' +
          (p !== null ? '<span class="amt">' + won(p + subFee(it)) + '</span>' : '') +
          '<p><a href="../' + it.grain + '/?edit=' + it.id + '">바꾸기</a><button type="button" class="link" data-del="' + it.id + '">빼기</button></p></li>';
      }).join('');
      $$('[data-del]', box).forEach(function (b) {
        b.addEventListener('click', function () { save(load().filter(function (x) { return x.id !== b.dataset.del; })); renderCart(); });
      });
      var m = $('#money1'), ok = priced(l);
      m.hidden = !ok; $('#money1-note').hidden = !ok;
      if (ok) {
        var t = totals(l), rows = [['상품 금액', won(t.goods)]];
        if (t.sub) rows.push(['나눠 담기', won(t.sub)]);
        if (t.ship !== null) rows.push(['배송비', shipText(t.ship)]);
        rows.push(['합계', won(t.goods + t.sub + (t.ship || 0))]);
        m.innerHTML = dl(rows);
      }
    }
    function dl(rows) { return '<dl>' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>'; }
    renderCart();
    $('#to-order').addEventListener('click', function () { mode = 'cart'; write(sessionStorage, NOW, null); show(2); });
    $('#back-cart').addEventListener('click', function (e) {   // 쓴 내용은 그대로 둔다
      e.preventDefault();
      if (mode === 'now') { var l = load(); now.forEach(function (it) { if (!l.some(function (x) { return x.id === it.id; })) l.push(it); }); save(l); write(sessionStorage, NOW, null); mode = 'cart'; }
      history.replaceState(null, '', location.pathname); renderCart(); show(1);
    });

    // 2단계
    function perks() {
      var d = C.discount, info = state.info;
      var ho = $('[data-perk="ho"]');
      ho.hidden = state.seatsLeft === 0;
      var seats = $('.seats', ho); seats.hidden = state.seatsLeft === null || state.seatsLeft === undefined;
      if (!seats.hidden) $('b', seats).textContent = state.seatsLeft;
      var line = $('[data-perk="line"]');
      if (!info) { line.hidden = true; return; }
      var n = (info.count || 0) + 1;
      if (info.ho) line.textContent = '두두 ' + info.ho + '호 고객 ' + d.hoRate + '% 할인';
      else if (newsOn() && n % d.every === 0) line.textContent = '이번 주문 ' + d.rate + '% 할인';
      else line.textContent = '이번이 ' + n + '번째 주문 · 다음 할인까지 ' + (d.every - n % d.every) + '번';
      line.hidden = false;
    }
    function newsOn() { var i = state.info || {}; return !!(i.newsEver || i.consent || $('[name="news"]', form).checked); }
    function cut(t) {   // ○호 할인과 3번째 주문 할인은 겹치지 않는다 · 기준은 곡식+나눠 담기
      var d = C.discount, i = state.info || {}, n = (i.count || 0) + 1;
      if (i.ho) return { v: Math.round((t.goods + t.sub) * d.hoRate / 100), why: '두두 ' + i.ho + '호 고객 ' + d.hoRate + '% 할인' };
      if (newsOn() && n % d.every === 0) return { v: Math.round((t.goods + t.sub) * d.rate / 100), why: n + '번째 주문 ' + d.rate + '% 할인' };
      return null;
    }
    function money2() {
      perks();
      var l = list(), m = $('#money2');
      $('#order-items').innerHTML = l.map(function (it) { return '<li>' + esc(describe(it)) + '</li>'; }).join('');
      if (!priced(l)) { m.hidden = true; return null; }
      var t = totals(l), c = cut(t), rows = [['상품 금액', won(t.goods)]];
      if (t.sub) rows.push(['나눠 담기', won(t.sub)]);
      if (t.ship !== null) rows.push(['배송비', shipText(t.ship)]);
      if (c) rows.push([c.why, '−' + won(c.v)]);
      var total = t.goods + t.sub + (t.ship || 0) - (c ? c.v : 0);
      rows.push(['최종 금액', won(total)]);
      m.innerHTML = '<h3>최종 금액</h3>' + dl(rows); m.hidden = false;
      return total;
    }
    form.addEventListener('change', function (e) {
      $('.gift-box', form).hidden = val(form, 'to') !== 'gift';
      var all = $('[name="all"]', form), boxes = $$('.agree-item input', form).filter(function (x) { return !x.closest('[hidden]'); });
      if (e && e.target === all) boxes.forEach(function (x) { x.checked = all.checked; });
      else all.checked = boxes.length > 0 && boxes.every(function (x) { return x.checked; });
      if (e && e.target && e.target.name) { var er = $('[data-err="' + e.target.name + '"]', form); if (er) er.hidden = true; }
      money2();
    });
    $('[name="phone"]', form).addEventListener('change', function () {
      if (!C.endpoint) return;
      var t = tel(this.value); if (t.length < 10) return;
      fetch(C.endpoint + '?action=recall&tel=' + t).then(function (r) { return r.json(); }).then(function (d) {
        state.info = d.limited ? null : d;
        $('.agree-news', form).hidden = !!(d.consent);   // 이미 동의한 번호면 안 보임
        money2();
      }).catch(function () {});
    });

    function check() {
      var bad = [];
      function need(name, ok) { var e = $('[data-err="' + name + '"]', form); if (e) e.hidden = ok; if (!ok) bad.push(name); }
      var f = fields(form);
      need('name', !!f.name);
      need('phone', /^01\d{8,9}$/.test(tel(f.phone)));
      if (f.to === 'gift') { need('giftName', !!f.giftName); need('giftPhone', /^01\d{8,9}$/.test(tel(f.giftPhone))); }
      need('address', !!f.address);
      need('refund', !state.order || !!f.refund);
      if (bad.length) { var x = form.querySelector('[name="' + bad[0] + '"]'); if (x) x.focus(); }
      return !bad.length;
    }
    var btn = $('button[type="submit"]', form);
    btn.textContent = state.order ? '주문하기' : '예약 문의 남기기';
    if (!C.endpoint) btn.disabled = true;   // 규칙 일꾼 주소가 없으면 막아 둔다(가짜 전송 금지)
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!C.endpoint || !check()) return;
      btn.disabled = true;
      var total = money2(), f = fields(form), l = list();
      fetch(C.endpoint, { method: 'POST', body: JSON.stringify(orderPayload(f, l)) }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) throw new Error('fail');
        done(f, l, total);
        if (mode === 'now') write(sessionStorage, NOW, null); else save([]);
      }).catch(function () { btn.disabled = false; alert('보내지 못했습니다. 잠시 후 다시 시도해 주세요.'); });
    });

    // 3단계
    function done(f, l, total) {
      var s3 = $('[data-step="3"]');
      $('[data-done="title"]', s3).textContent = state.order ? '주문을 받았습니다.' : '접수했습니다.';
      $('[data-done="text"]', s3).textContent = state.order ? '재고를 확인하고 확정 안내를 카카오톡(또는 문자)으로 보내 드립니다.' : '예약을 시작하면 카카오톡 또는 문자로 먼저 알려 드립니다.';
      var rows = [['곡식', l.map(function (it) { return esc(describe(it)); }).join('<br>')],
                  ['받는 분', esc(f.to === 'gift' ? f.giftName : f.name)],
                  ['받고 싶은 때', esc(f.when || '가장 빠른 날')]];
      if (total !== null && total !== undefined) rows.push(['최종 금액', won(total)]);
      $('[data-done="items"]', s3).innerHTML = dl(rows);
      $('[data-done="next"]', s3).hidden = !state.order;
      show(3);
    }

    show(mode === 'now' ? 2 : 1);
  }

  function fields(form) {
    var o = {};
    $$('input, select, textarea', form).forEach(function (x) {
      if (!x.name || x.type === 'button') return;
      if (x.type === 'radio') { if (x.checked) o[x.name] = x.value; }
      else if (x.type === 'checkbox') { if (x.checked) (o[x.name] = o[x.name] || []).push(x.value); }
      else o[x.name] = x.value.trim();
    });
    return o;
  }

  function orderPayload(f, list) {
    var consent = [];
    if (f.refund) consent.push('환불확인');
    if (f.news) consent.push('소식');
    return { kind: 'order', mode: state.order ? 'order' : 'inquiry', '경로': '홈페이지',
             '이름': f.name, '연락처': tel(f.phone), '주소': f.address,
             '받는 분': f.to === 'gift' ? { '이름': f.giftName, '연락처': tel(f.giftPhone), '주소': f.address } : null,
             '받고 싶은 때': f.when || '가장 빠른 날', '요청사항': f.memo || '',
             items: list.map(function (it) { return { grain: it.grain, glutinous: it.glutinous, size: it.size, subpack: it.subpack, repeat: it.repeat, text: describe(it) }; }),
             '동의': consent };
  }

  // ───── 대량 주문·협력업체 문의 (/contact/#bulk) ─────
  function initBulk(form) {
    form.addEventListener('change', function () {
      var rice = $$('input[name="grains"]:checked', form).some(function (x) { return x.value === '쌀'; });
      $('.bulk-gl', form).hidden = !rice;
      $('.bulk-cycle', form).hidden = val(form, 'how') !== '주기적으로';
    });
    form.dispatchEvent(new Event('change'));
    var btn = $('button[type="submit"]', form), sent = $('.sent', form);
    if (!C.endpoint) { btn.disabled = true; return; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      btn.disabled = true;
      var f = fields(form);
      var body = { kind: 'bulk', mode: 'inquiry', '경로': '상담', '이름': f.name, '연락처': tel(f.phone), '상호': f.shop || '', '지역': f.region || '',
                   '유형': f.use, '곡식': (f.grains || []).join(', '), '찹쌀': f.gl || '', '양': f.qty || '', '양 직접': f.qtyKg || '',
                   '방식': f.how === '주기적으로' ? '주기적으로 ' + (f.cycle || '') : (f.how || ''), '시작': f.start || '', '포장': f.pack || '',
                   '요청사항': f.memo || '', '동의': f.news ? ['소식'] : [] };
      fetch(C.endpoint, { method: 'POST', body: JSON.stringify(body) }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) throw new Error('fail');
        $$('fieldset, .notice-line, button[type="submit"]', form).forEach(function (x) { x.hidden = true; });
        sent.hidden = false;
      }).catch(function () { btn.disabled = false; alert('보내지 못했습니다. 잠시 후 다시 시도해 주세요.'); });
    });
  }

  // ───── 두두 카드 가격 줄·딱지 ─────
  function initCards() {
    $$('[data-card]').forEach(function (card) {
      var g = C[card.dataset.card]; if (!g) return;
      var tag = $('.tag', card); if (tag) tag.textContent = state.order ? '주문 받는 중' : '곧 예약';
      var line = $('[data-card-price]', card); if (!line) return;
      var s = g.sizes[0], p = s !== undefined ? g.price[s] : null;
      line.hidden = !has(p);
      if (has(p)) line.textContent = card.dataset.card === 'rice' ? s + 'kg ' + won(p) + '부터' : s + 'kg ' + won(p);
    });
  }

  function start() {
    $$('[data-pay-days]').forEach(function (x) { x.textContent = C.payDays; });
    $$('[data-need="kakao"]').forEach(function (x) { x.hidden = !C.kakao; });   // 채널 개설 전엔 숨김
    $$('a[data-kakao]').forEach(function (x) { if (C.kakao) x.href = C.kakao; });
    $$('[data-state]').forEach(function (x) { x.textContent = state.order ? '주문 받는 중' : '곧 예약'; });
    var p = $('form[data-grain]'); if (p) initProduct(p);
    if ($('#order-form')) initCart();
    var b = $('#bulk-form'); if (b) initBulk(b);
    initCards();
  }

  // 스위치는 규칙 일꾼에게 묻고, 답이 없으면 설정 파일 값(전부 끔)
  if (C.endpoint) {
    fetch(C.endpoint + '?action=switches').then(function (r) { return r.json(); }).then(function (d) {
      state.order = !!(d.switches && d.switches.order); state.seatsLeft = d.seatsLeft === undefined ? null : d.seatsLeft;
    }).catch(function () {}).then(start);
  } else start();
})();
