// 두두쌀·선풍 콩 고르기, 장바구니·주문서, 대량 상담 양식. 글자는 홈페이지_문안.md 03-1~03-3.
// 장바구니는 이 브라우저에만 남는다(localStorage). 개인정보는 보내기 전까지 어디에도 저장하지 않는다.
(function () {
  var C = window.DOODOO_CONFIG;
  if (!C) return;
  var KEY = 'doodoo-cart';
  var state = { order: C.order, seatsLeft: null, info: null };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function won(n) { return Number(n).toLocaleString('ko-KR') + '원'; }
  function tel(s) { return String(s || '').replace(/\D/g, ''); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function store(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ───── 고른 것을 글로 ─────
  function glutinousLabel(p) { return p === 0 ? '멥쌀만' : '찹쌀 ' + p + '%'; }
  function repeatLabel(r) {
    if (!r || r === 'once') return '한 번만';
    var w = Math.round(Number(r) / 7);
    return w + '주마다';
  }
  function describe(it) {
    var g = C[it.grain], parts = [g.name];
    if (it.grain === 'rice') parts.push(glutinousLabel(it.glutinous));
    parts.push(it.size + 'kg');
    if (it.subpack) parts.push(C.rice.subpack.unit + 'kg씩 나눠 담기');
    parts.push(repeatLabel(it.repeat));
    return parts.join(' · ');
  }
  function itemPrice(it) {
    var p = C[it.grain].price[it.size];
    if (p === null || p === undefined) return null;
    return Number(p);
  }
  function itemSubpack(it) { return it.grain === 'rice' && it.subpack ? Number(C.rice.subpack.fee[it.size] || 0) : 0; }

  // ───── 고르기 단추 만들기 ─────
  function radios(box, name, items, checked) {
    box.innerHTML = items.map(function (o) {
      return '<label class="opt"><input type="radio" name="' + name + '" value="' + esc(o.value) + '"' +
        (String(o.value) === String(checked) ? ' checked' : '') + '><span>' + o.label +
        (o.tag ? ' <em>' + o.tag + '</em>' : '') + '</span></label>';
    }).join('');
  }
  function val(form, name) { var x = form.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : null; }

  function initPick(form) {
    var grain = form.dataset.grain, g = C[grain];
    var edit = new URLSearchParams(location.search).get('edit');
    var cur = load().filter(function (x) { return x.id === edit; })[0] || null;

    if (!g.sizes.length) { form.hidden = true; var rb = $('#recall'); if (rb) rb.hidden = true; return; }
    var gl = $('[data-opts="glutinous"]', form);
    if (gl) radios(gl, 'glutinous', g.glutinous.map(function (p) { return { value: p, label: glutinousLabel(p), tag: p === g.recommend ? '추천' : '' }; }), cur ? cur.glutinous : g.recommend);
    radios($('[data-opts="size"]', form), 'size', g.sizes.map(function (s) {
      var p = g.price[s]; return { value: s, label: s + 'kg' + (p ? ' · ' + won(p) : '') };
    }), cur ? cur.size : g.sizes[0]);
    var sp = $('[data-opts="subpack"]', form);
    if (sp) {
      var fees = g.sizes.map(function (s) { return s + 'kg +' + Number(g.subpack.fee[s]).toLocaleString('ko-KR') + '원'; }).join(' · ');
      radios(sp, 'subpack', [{ value: 'no', label: '한 봉으로' }, { value: 'yes', label: g.subpack.unit + 'kg씩 나눠 담기 (' + fees + ')' }], cur && cur.subpack ? 'yes' : 'no');
    }
    radios($('[data-opts="repeat"]', form), 'repeat', [{ value: 'once', label: '한 번만' }, { value: 'regular', label: '정기적으로' }], cur && cur.repeat !== 'once' ? 'regular' : 'once');
    var cyc = $('[data-opts="cycle"]', form);
    var cycItems = g.cycles.map(function (d) { return { value: d, label: Math.round(d / 7) + '주마다' }; }).concat([{ value: 'custom', label: '직접 입력' }]);
    var curCycle = cur && cur.repeat !== 'once' ? (g.cycles.indexOf(Number(cur.repeat)) >= 0 ? cur.repeat : 'custom') : g.cycles[g.cycles.length - 1];
    radios(cyc, 'cycle', cycItems, curCycle);
    if (cur && curCycle === 'custom') $('[name="cycleWeeks"]', form).value = Math.round(cur.repeat / 7);

    function sync() {
      var regular = val(form, 'repeat') === 'regular';
      $('.cycle-box', form).hidden = !regular;
      $('.cycle-custom', form).hidden = !(regular && val(form, 'cycle') === 'custom');
    }
    form.addEventListener('change', sync); sync();

    function picked() {
      var repeat = 'once';
      if (val(form, 'repeat') === 'regular') {
        var c = val(form, 'cycle');
        repeat = c === 'custom' ? Math.max(1, Number($('[name="cycleWeeks"]', form).value || 0)) * 7 : Number(c);
      }
      return { id: cur ? cur.id : String(Date.now()), grain: grain, glutinous: gl ? Number(val(form, 'glutinous')) : null,
               size: Number(val(form, 'size')), subpack: sp ? val(form, 'subpack') === 'yes' : false, repeat: repeat };
    }
    function put() {
      var list = load(), it = picked(), i = list.map(function (x) { return x.id; }).indexOf(it.id);
      if (i >= 0) list[i] = it; else list.push(it);
      store(list); return it;
    }
    $('[data-act="add"]', form).addEventListener('click', function () {
      put(); var m = $('.added', form); m.hidden = false;
    });
    $('[data-act="buy"]', form).addEventListener('click', function () { put(); location.href = '../cart/'; });
    if (cur) $('[data-act="add"]', form).textContent = '바꾼 내용 담기';

    initCalc();
    initRecall(form, grain);
  }

  // 한 달 양 보기
  function initCalc() {
    var box = $('#calc'); if (!box) return;
    function run() {
      var n = Number($('[name="people"]', box).value), f = C.rice.mealFactor[$('[name="meals"]', box).value];
      var month = n * C.rice.perCapitaDailyG * 30 * f / 1000;
      var weeks = 10 / (month / 30 * 7);
      $('.calc-out', box).textContent = '한 달 약 ' + month.toFixed(1) + 'kg · 「10kg이 약 ' + Math.round(weeks) + '주 분량입니다」';
    }
    box.addEventListener('change', run); run();
  }

  // 지난 주문 불러오기 (전화번호 → 조합만)
  function initRecall(form, grain) {
    var box = $('#recall'); if (!box) return;
    var btn = $('button', box), msg = $('.recall-msg', box);
    if (!C.endpoint) { btn.disabled = true; $('input', box).disabled = true; return; }
    btn.addEventListener('click', function () {
      var t = tel($('input', box).value); if (t.length < 10) return;
      fetch(C.endpoint + '?action=recall&tel=' + t).then(function (r) { return r.json(); }).then(function (d) {
        if (d.limited) { msg.textContent = '잠시 후 다시 시도해 주세요.'; return; }
        var k = d.found && d.combos && d.combos[grain];
        if (!k) { msg.textContent = '지난 주문이 없습니다.'; return; }
        ['glutinous', 'size'].forEach(function (n) { var x = form.querySelector('input[name="' + n + '"][value="' + k[n] + '"]'); if (x) x.checked = true; });
        var s = form.querySelector('input[name="subpack"][value="' + (k.subpack ? 'yes' : 'no') + '"]'); if (s) s.checked = true;
        msg.textContent = ''; form.dispatchEvent(new Event('change'));
      }).catch(function () { msg.textContent = '잠시 후 다시 시도해 주세요.'; });
    });
  }

  // ───── 장바구니·주문서 ─────
  function initCart(root) {
    var list = load();
    var box = $('#cart-items');
    if (!list.length) { $('#cart-empty').hidden = false; $('#cart-form').hidden = true; return; }
    box.innerHTML = list.map(function (it) {
      var p = itemPrice(it), sp = itemSubpack(it);
      return '<li data-id="' + it.id + '"><div><b>' + esc(describe(it)) + '</b>' +
        (state.order && p !== null ? '<span class="amt">' + won(p + sp) + '</span>' : '') + '</div>' +
        '<p><a href="../' + it.grain + '/?edit=' + it.id + '">바꾸기</a> <button type="button" class="link" data-del="' + it.id + '">빼기</button></p></li>';
    }).join('');
    $$('[data-del]', box).forEach(function (b) {
      b.addEventListener('click', function () { store(load().filter(function (x) { return x.id !== b.dataset.del; })); location.reload(); });
    });
    var form = $('#cart-form');
    form.addEventListener('change', function () { $('.gift-box', form).hidden = val(form, 'to') !== 'gift'; money(form, list); });
    $('[name="phone"]', form).addEventListener('change', function () { lookup(form, list); });
    var all = $('[name="all"]', form);
    if (all) all.addEventListener('change', function () { $$('.agree input', form).forEach(function (x) { x.checked = all.checked; }); });
    money(form, list);
    submit(form, function () { return orderPayload(form, list); }, function () { store([]); });
  }

  function lookup(form, list) {
    if (!C.endpoint) return;
    var t = tel($('[name="phone"]', form).value); if (t.length < 10) return;
    fetch(C.endpoint + '?action=recall&tel=' + t).then(function (r) { return r.json(); }).then(function (d) {
      state.info = d.limited ? null : d;
      var news = $('.agree-news', form); if (news && d.consent) news.hidden = true;   // 이미 동의한 번호면 안 보임
      money(form, list);
    }).catch(function () {});
  }

  function money(form, list) {
    var box = $('#money'); if (!box) return;
    var prices = list.map(itemPrice);
    if (!state.order || prices.some(function (p) { return p === null; })) { box.hidden = true; return; }
    var grain = prices.reduce(function (a, b) { return a + b; }, 0);
    var sub = list.map(itemSubpack).reduce(function (a, b) { return a + b; }, 0);
    var d = C.discount, info = state.info || {}, n = (info.count || 0) + 1, cut = 0, why = '';
    var news = info.consent || ($('[name="news"]', form) && $('[name="news"]', form).checked);
    if (info.ho) { cut = Math.round((grain + sub) * d.hoRate / 100); why = '두두 ' + info.ho + '호 고객 ' + d.hoRate + '% 할인'; }
    else if (news && n % d.every === 0) { cut = Math.round((grain + sub) * d.rate / 100); why = n + '번째 주문 ' + d.rate + '% 할인'; }
    var ship = C.shipping === null ? null : Number(C.shipping);
    var rows = [['곡식 금액', won(grain)]];
    if (sub) rows.push(['소포장', won(sub)]);
    if (cut) rows.push([why, '−' + won(cut)]);
    if (ship !== null) rows.push(['배송비', ship === 0 ? '무료 배송' : won(ship)]);
    rows.push(['합계', won(grain + sub - cut + (ship || 0))]);
    var head = state.info ? '<p class="count">이번이 ' + n + '번째 주문 · 다음 할인까지 ' + ((d.every - n % d.every) % d.every || d.every) + '번</p>' : '';
    box.innerHTML = head + '<dl>' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
    box.hidden = false;
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

  function orderPayload(form, list) {
    var f = fields(form);
    var consent = [];
    if (f.refund) consent.push('환불확인');
    if (f.news) consent.push('소식');
    return { kind: 'order', mode: state.order ? 'order' : 'inquiry', '경로': '홈페이지',
             '이름': f.name, '연락처': tel(f.phone), '주소': f.address,
             '받는 분': f.to === 'gift' ? { '이름': f.giftName, '연락처': tel(f.giftPhone), '주소': f.giftAddress } : null,
             '받고 싶은 때': f.when || '가장 빠른 날', '요청사항': f.memo || '',
             items: list.map(function (it) { return { grain: it.grain, glutinous: it.glutinous, size: it.size, subpack: it.subpack, repeat: it.repeat, text: describe(it) }; }),
             '동의': consent };
  }

  function initBulk(form) {
    form.addEventListener('change', function () {
      var rice = $$('input[name="grains"]:checked', form).some(function (x) { return x.value === '쌀'; });
      $('.bulk-gl', form).hidden = !rice;
      $('.bulk-cycle', form).hidden = val(form, 'how') !== '주기적으로';
    });
    form.dispatchEvent(new Event('change'));
    submit(form, function () {
      var f = fields(form);
      return { kind: 'bulk', mode: 'inquiry', '경로': '상담', '이름': f.name, '연락처': tel(f.phone), '상호': f.shop || '', '지역': f.region || '',
               '유형': f.use, '곡식': (f.grains || []).join(', '), '찹쌀': f.gl || '', '양': f.qty || '', '양 직접': f.qtyKg || '',
               '방식': f.how === '주기적으로' ? '주기적으로 ' + (f.cycle || '') : (f.how || ''), '시작': f.start || '', '포장': f.pack || '',
               '요청사항': f.memo || '', '동의': f.news ? ['소식'] : [] };
    });
  }

  // 보내기 — 규칙 일꾼 주소가 없으면 막아 둔다(가짜 전송 금지)
  function submit(form, build, after) {
    var btn = $('button[type="submit"]', form), done = $('.sent', form);
    if (btn.dataset.order) btn.textContent = state.order ? btn.dataset.order : btn.dataset.inquiry;
    if (!C.endpoint) { btn.disabled = true; return; }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      btn.disabled = true;
      fetch(C.endpoint, { method: 'POST', body: JSON.stringify(build()) }).then(function (r) { return r.json(); }).then(function (d) {
        if (!d.ok) throw new Error('fail');
        form.querySelectorAll('fieldset, .money, button[type="submit"]').forEach(function (x) { x.hidden = true; });
        done.hidden = false; done.textContent = state.order && done.dataset.order ? done.dataset.order : done.dataset.inquiry;
        if (after) after();
      }).catch(function () { btn.disabled = false; alert('보내지 못했습니다. 010-4689-8106으로 문자 주세요.'); });
    });
  }

  function start() {
    var p = $('form[data-grain]'); if (p) initPick(p);
    var c = $('#cart-form'); if (c) initCart(c);
    var b = $('#bulk-form'); if (b) initBulk(b);
    $$('[data-show="order"]').forEach(function (x) { x.hidden = !state.order; });
    $$('[data-show="inquiry"]').forEach(function (x) { x.hidden = state.order; });
    var refund = $('[name="refund"]'); if (refund) refund.required = state.order;
    $$('[data-need="account"]').forEach(function (x) {
      x.hidden = !(state.order && C.account);
      if (!x.hidden) { $('.pay-days', x).textContent = C.payDays; $('.account', x).textContent = '계좌 ' + C.account; }
    });
    if (state.seatsLeft !== null) $$('.seats').forEach(function (x) { x.hidden = false; x.querySelector('b').textContent = state.seatsLeft; });
  }

  // 스위치는 규칙 일꾼에게 묻고, 답이 없으면 설정 파일 값(전부 끔)
  if (C.endpoint) {
    fetch(C.endpoint + '?action=switches').then(function (r) { return r.json(); }).then(function (d) {
      state.order = !!(d.switches && d.switches.order); state.seatsLeft = d.seatsLeft === undefined ? null : d.seatsLeft;
    }).catch(function () {}).then(start);
  } else start();
})();
