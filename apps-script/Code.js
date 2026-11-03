// 두두 고객장부 규칙 일꾼 (Google Apps Script, V8)
// 설계 정본: 80_브랜드마케팅/주문고객_설계.md 3·4·6·7·11장. 화면 글자는 4-2단계에서 문자틀 시트로 바꾼다.
// 키·비밀번호는 여기 적지 않는다. 발송 서비스 키는 프로젝트 설정 > 스크립트 속성에만 (6단계).

// ───────── 장부 구조 (시트 이름과 칸 순서) ─────────
var SCHEMA = {
  '접수': ['접수번호', '시각', '경로', '원문', '이름', '연락처', '처리상태', '연결 고객', '연결 주문', '메모'],
  '고객': ['고객번호', '이름', '연락처', '지역', '유형', '식구 수', '처음 온 날', '처음 경로', '입금자명들', '단골 회차', '두두 호',
          '단계', '첫 주문일', '마지막 주문일', '예상 소진일', '문자 판', '수신 거부', '메모'],
  '동의': ['동의번호', '고객', '종류', '문구 판', '동의 시각', '철회 시각', '경로', '보관 끝나는 날'],
  '관심': ['관심번호', '고객', '곡식', '양', '시기', '용도', '출처', '기록일'],
  '취향': ['취향번호', '고객', '제품', '도정', '찹쌀', '콩 비율', '양(kg)', '주기(일)', '판', '확정일'],
  '주문': ['주문번호', '접수번호', '고객', '곡식', '조합', '양(kg)', '단가', '금액', '할인율', '할인액', '청구액', '상태',
          '작업일', '받을 날', '입금 기한', '입금 안내 횟수', '입금일', '송장', '피드백', '받는 분', '상태 바뀐 시각', '메모'],
  '연락': ['시각', '고객', '주문', '경로', '문자틀', '종류', '결과'],
  '곡식': ['코드', '제품', '상태', '부르는 이름', '한 줄', '맛', '요리', '보관', '수확', '단위(kg)', '가격(원/kg)', '단백질(g/100g)',
          '사진', '출처', '공개'],
  '재고': ['곡식', '남은 양(kg)', '예약된 양(kg)', '기준일'],
  '작업 달력': ['날짜', '도정 가능', '하루 최대량(kg)', '배정된 양(kg)', '메모'],
  '문자틀': ['코드', '상태', '문구', '짧은 판', '종류'],
  '연락 규칙': ['규칙', '때(조건)', '받는 단계', '문자틀', '종류', '하루 시간대', '월 상한', '켬/끔'],
  '설정': ['이름', '켬/끔', '값', '설명', '공개'],
  '처리 기록': ['시각', '무엇', '대상', '결과', '실패 이유']
};

// 홈페이지가 읽는 스위치(설계 7장). 처음엔 전부 끔.
var SWITCHES = ['order', 'survey', 'notify', 'kakao_bot', 'sms_send', 'bank_match', 'loyalty', 'refill_alert',
                'live_stock', 'countdown', 'doodoo_rice', 'doodoo_misu'];

var DEFAULT_SETTINGS = [
  ['order', '끔', '', '주문 받기', 'Y'], ['survey', '끔', '', '취향 설문', 'Y'], ['notify', '끔', '', '소식 받기', 'Y'],
  ['kakao_bot', '끔', '', '카톡 챗봇', 'Y'], ['sms_send', '끔', '', '문자 실제 발송(끄면 연락 시트에 「보류」만)', 'Y'],
  ['bank_match', '끔', '', '입금 대조', 'Y'], ['loyalty', '끔', '', '단골 자동 할인', 'Y'],
  ['refill_alert', '끔', '', '떨어질 때쯤 알림', 'Y'], ['live_stock', '끔', '', '남은 양 실시간 표시', 'Y'],
  ['countdown', '끔', '', '오픈 예고', 'Y'], ['doodoo_rice', '끔', '', '두두쌀', 'Y'], ['doodoo_misu', '끔', '', '두두미숫가루', 'Y'],
  ['pay_days', '', 3, '입금 기한(일). 지나면 안내 1회, 다시 지나면 자동 취소', ''],
  ['lead_days', '', 1, '확정 뒤 가장 빠른 작업일까지(일)', ''],
  ['ship_days', '', 2, '작업일 뒤 받을 날까지(일)', ''],
  ['feedback_days', '', 3, '받은 뒤 피드백 묻기까지(일)', ''],
  ['loyalty_rates', '', '2:3,3:5,5:7', '회차:할인% (시험값 — 대표 확정 전)', ''],
  ['refill_lead_days', '', 5, '예상 소진일 며칠 전에 알림', ''],
  ['default_cycle_days', '', 30, '취향에 주기가 없을 때 예상 소진 날수', ''],
  ['rest_days', '', 60, '예상 소진일 뒤 이만큼 주문 없으면 쉬는 고객', ''],
  ['dup_minutes', '', 10, '같은 연락처·같은 내용이 이 안에 또 오면 중복', ''],
  ['ad_hours', '', '9~20', '광고 보내는 시간대(시~시)', ''],
  ['ad_monthly_max', '', 2, '사람마다 한 달 광고 상한', ''],
  ['last_run', '', '', '규칙 일꾼이 마지막으로 돈 시각(자동)', '']
];

// 문자틀: 4-2단계에서 문안(3단계)으로 바꾼다. {이름} {주문번호} {양} {곡식} {청구액} {입금기한} {받을날} {호} 를 채운다.
var DEFAULT_TEMPLATES = [
  ['접수안내', '임시', '【임시】{이름}님 접수했습니다.', '【임시】접수했습니다.', '안내'],
  ['확정입금안내', '임시', '【임시】{이름}님 {곡식} {양}kg 확정. {청구액}원, {입금기한}까지 입금.', '【임시】확정. {청구액}원 입금 부탁드립니다.', '안내'],
  ['첫고객호', '임시', '【임시】{이름}님은 두두 {호}호 고객입니다. 받을 날 {받을날}.', '【임시】두두 {호}호 고객입니다.', '안내'],
  ['대기안내', '임시', '【임시】{이름}님 준비되는 대로 연락드립니다.', '【임시】준비되면 연락드립니다.', '안내'],
  ['입금기한안내', '임시', '【임시】{이름}님 입금 기한이 지났습니다. {입금기한}까지 부탁드립니다.', '【임시】입금 부탁드립니다.', '안내'],
  ['자동취소', '임시', '【임시】{이름}님 입금이 없어 주문 {주문번호}을 취소했습니다.', '【임시】주문을 취소했습니다.', '안내'],
  ['입금확인', '임시', '【임시】{이름}님 입금 확인했습니다.', '【임시】입금 확인했습니다.', '안내'],
  ['찧은날', '임시', '【임시】오늘 {이름}님 쌀을 찧었습니다.', '【임시】오늘 찧었습니다.', '안내'],
  ['발송안내', '임시', '【임시】{이름}님 보냈습니다.', '【임시】보냈습니다.', '안내'],
  ['도착확인', '임시', '【임시】{이름}님 잘 받으셨나요?', '【임시】잘 받으셨나요?', '안내'],
  ['피드백', '임시', '【임시】{이름}님 밥맛 어떠셨나요?', '【임시】밥맛 어떠셨나요? 답장 주세요.', '안내'],
  ['떨어질때', '임시', '【임시】{이름}님 지난 조합 그대로 주문하실까요?', '【임시】다시 보내 드릴까요? 답장 주세요.', '안내'],
  ['단골할인', '임시', '【임시】{이름}님 다음 주문부터 저절로 할인됩니다.', '【임시】다음부터 할인됩니다.', '안내'],
  ['늦어짐', '임시', '【임시】{이름}님 받을 날이 늦어집니다. 새 날짜 {받을날}.', '【임시】늦어져 죄송합니다.', '안내'],
  ['쉬는고객안부', '임시', '(광고)【임시】{이름}님 안부 전합니다.', '(광고)【임시】안부 전합니다.', '광고'],
  ['수신거부처리', '임시', '【임시】소식 받지 않기로 처리했습니다.', '【임시】처리했습니다.', '안내']
];

var DEFAULT_RULES = [
  ['접수', '주문서·문의를 받은 직후', '모두', '접수안내', '안내', '', '', '켬'],
  ['확정', '재고·작업일이 있어 확정됐을 때', '모두', '확정입금안내', '안내', '', '', '켬'],
  ['첫 고객 번호', '첫 주문이 확정됐을 때', '첫 고객', '첫고객호', '안내', '', '', '켬'],
  ['대기', '재고나 작업일이 모자랄 때', '모두', '대기안내', '안내', '', '', '켬'],
  ['입금 기한', '입금 기한이 처음 지났을 때', '모두', '입금기한안내', '안내', '', '', '켬'],
  ['자동 취소', '입금 기한이 두 번 지났을 때', '모두', '자동취소', '안내', '', '', '켬'],
  ['입금 확인', '입금이 맞춰졌을 때', '모두', '입금확인', '안내', '', '', '켬'],
  ['발송', '송장이 들어왔을 때', '모두', '발송안내', '안내', '', '', '켬'],
  ['떨어질 때쯤', '예상 소진일 며칠 전', '첫 고객·단골', '떨어질때', '안내', '', '', '켬'],
  ['단골 할인', '할인이 처음 붙는 회차가 됐을 때', '단골', '단골할인', '안내', '', '', '켬'],
  ['쉬는 고객 안부', '쉬는 고객이 됐을 때 한 번', '쉬는 고객', '쉬는고객안부', '광고', '9~20', 2, '끔']
];

var STAGES = ['관심', '첫 고객', '단골', '쉬는 고객', '식당·단체'];
var LIVE = ['확정', '입금', '작업', '발송', '도착'];   // 취소·대기·확인필요가 아닌 주문

// ───────── 시계(시험 때 바꿔 끼움) ─────────
var Clock = { now: function () { return new Date(); } };
function now_() { return Clock.now(); }
function day_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays_(d, n) { var x = new Date(d); x.setDate(x.getDate() + Number(n)); return x; }
function ymd_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd'); }
function toDate_(v) { return v instanceof Date ? v : (v ? new Date(v) : null); }
function phone_(s) { return String(s || '').replace(/\D/g, ''); }

// ───────── 표 읽고 쓰기 ─────────
function book_() { return SpreadsheetApp.getActive(); }
function sheet_(name) {
  var sh = book_().getSheetByName(name);
  if (!sh) throw new Error('시트 없음: ' + name + ' — setup()을 먼저 돌리세요');
  return sh;
}
function rows_(name) {
  var vals = sheet_(name).getDataRange().getValues();
  var head = SCHEMA[name], out = [];
  for (var i = 1; i < vals.length; i++) {
    if (vals[i].join('') === '') continue;
    var o = { _row: i + 1 };
    head.forEach(function (h, j) { o[h] = vals[i][j]; });
    out.push(o);
  }
  return out;
}
function append_(name, obj) {
  var sh = sheet_(name);
  sh.appendRow(SCHEMA[name].map(function (h) { return obj[h] === undefined ? '' : obj[h]; }));
  obj._row = sh.getLastRow();
  return obj;
}
function save_(name, obj) {
  sheet_(name).getRange(obj._row, 1, 1, SCHEMA[name].length)
    .setValues([SCHEMA[name].map(function (h) { return obj[h] === undefined ? '' : obj[h]; })]);
}
function nextId_(name, prefix, width) {
  var n = rows_(name).length + 1, s = String(n);
  while (s.length < width) s = '0' + s;
  return prefix + s;
}

// ───────── 설정·처리 기록 ─────────
function setting_(key) {
  var r = rows_('설정').filter(function (x) { return x['이름'] === key; })[0];
  return r ? r : null;
}
function on_(key) { var r = setting_(key); return !!r && r['켬/끔'] === '켬'; }
function val_(key, fallback) { var r = setting_(key); return r && r['값'] !== '' ? r['값'] : fallback; }
function log_(what, target, result, why) {
  append_('처리 기록', { '시각': now_(), '무엇': what, '대상': target || '', '결과': result, '실패 이유': why || '' });
}

// ───────── 처음 한 번: 시트·머리줄·기본값 ─────────
function setup() {
  var ss = book_();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    var head = SCHEMA[name];
    var cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (cur.join('') === '') sh.getRange(1, 1, 1, head.length).setValues([head]);
    else if (cur.join('|') !== head.join('|')) throw new Error(name + ' 머리줄이 설계와 다릅니다 — 손으로 맞춘 뒤 다시');
    sh.setFrozenRows(1);
  });
  var first = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  seed_('설정', DEFAULT_SETTINGS, '이름');
  seed_('문자틀', DEFAULT_TEMPLATES, '코드');
  seed_('연락 규칙', DEFAULT_RULES, '규칙');
  log_('setup', '', '끝');
}
function seed_(name, list, key) {
  var have = rows_(name).map(function (r) { return r[key]; });
  list.forEach(function (row) {
    if (have.indexOf(row[0]) >= 0) return;
    var o = {}; SCHEMA[name].forEach(function (h, i) { o[h] = row[i]; });
    append_(name, o);
  });
}

// 10분마다 도는 예약 작업을 건다(한 번만).
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'runScheduled') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runScheduled').timeBased().everyMinutes(10).create();
  log_('installTriggers', '', '10분마다');
}

// ───────── 입구: 접수 ─────────
// p = { 경로, 원문, 이름, 연락처, 지역, 유형, 식구 수, mode:'order'|'inquiry',
//       곡식, 양, 조합, 받는 분, 취향:{제품,도정,찹쌀,콩 비율,양(kg),주기(일)}, 동의:['필수','소식',...], 문구판 }
function intake(p) {
  return withLock_(function () {
    var t = now_();
    var tel = phone_(p['연락처']);
    var raw = p['원문'] || JSON.stringify(p);
    var rec = append_('접수', { '접수번호': nextId_('접수', 'R', 5), '시각': t, '경로': p['경로'] || '홈페이지', '원문': raw,
                                '이름': p['이름'] || '', '연락처': tel, '처리상태': '새로' });
    if (!tel) { rec['처리상태'] = '확인필요'; rec['메모'] = '연락처 없음'; save_('접수', rec); log_('접수', rec['접수번호'], '확인필요', '연락처 없음'); return { ok: false, 접수번호: rec['접수번호'] }; }

    var dupMin = Number(val_('dup_minutes', 10));
    var dup = rows_('접수').filter(function (r) {
      return r._row !== rec._row && phone_(r['연락처']) === tel && r['원문'] === raw && (t - toDate_(r['시각'])) <= dupMin * 60000;
    })[0];
    if (dup) { rec['처리상태'] = '중복'; rec['메모'] = dup['접수번호'] + '와 같음 — 확인필요'; save_('접수', rec); log_('접수', rec['접수번호'], '중복', dup['접수번호']); return { ok: true, 중복: true, 접수번호: rec['접수번호'] }; }

    var c = customer_(p, tel, t);
    rec['연결 고객'] = c['고객번호'];
    (p['동의'] || []).forEach(function (kind) {
      append_('동의', { '동의번호': nextId_('동의', 'A', 5), '고객': c['고객번호'], '종류': kind, '문구 판': p['문구판'] || '',
                        '동의 시각': t, '경로': rec['경로'] });
    });
    if (p['취향']) saveTaste_(c['고객번호'], p['취향'], t);

    var res = { ok: true, 접수번호: rec['접수번호'], 고객번호: c['고객번호'] };
    if (p.mode === 'order' && p['곡식'] && Number(p['양']) > 0) {
      var o = append_('주문', { '주문번호': orderNo_(t), '접수번호': rec['접수번호'], '고객': c['고객번호'], '곡식': p['곡식'],
                               '조합': p['조합'] || '', '양(kg)': Number(p['양']), '상태': '접수', '입금 안내 횟수': 0,
                               '받는 분': p['받는 분'] || '', '상태 바뀐 시각': t });
      rec['연결 주문'] = o['주문번호'];
      res['주문번호'] = o['주문번호'];
      send_('접수안내', c, o);
      res['상태'] = confirm_(o, c);
    } else {
      append_('관심', { '관심번호': nextId_('관심', 'I', 5), '고객': c['고객번호'], '곡식': p['곡식'] || '', '양': p['양'] || '',
                        '시기': p['시기'] || '', '용도': p['용도'] || '', '출처': rec['경로'], '기록일': t });
    }
    rec['처리상태'] = '처리됨';
    save_('접수', rec);
    updateStage_(c);
    log_('접수', rec['접수번호'], res['상태'] || '관심');
    return res;
  });
}

function customer_(p, tel, t) {
  var c = rows_('고객').filter(function (r) { return phone_(r['연락처']) === tel; })[0];
  if (c) {
    ['이름', '지역', '유형', '식구 수'].forEach(function (k) { if (!c[k] && p[k]) c[k] = p[k]; });
    save_('고객', c);
    return c;
  }
  return append_('고객', { '고객번호': nextId_('고객', 'C', 4), '이름': p['이름'] || '', '연락처': tel, '지역': p['지역'] || '',
                           '유형': p['유형'] || '가정', '식구 수': p['식구 수'] || '', '처음 온 날': t, '처음 경로': p['경로'] || '홈페이지',
                           '단골 회차': 0, '단계': '관심', '문자 판': p['경로'] === '문자' || p['경로'] === '전화' ? '짧은 판' : '일반', '수신 거부': '' });
}

function saveTaste_(cid, k, t) {
  var prev = rows_('취향').filter(function (r) { return r['고객'] === cid && r['제품'] === k['제품']; });
  append_('취향', { '취향번호': nextId_('취향', 'T', 5), '고객': cid, '제품': k['제품'] || '', '도정': k['도정'] || '', '찹쌀': k['찹쌀'] || '',
                    '콩 비율': k['콩 비율'] || '', '양(kg)': k['양(kg)'] || '', '주기(일)': k['주기(일)'] || '', '판': prev.length + 1, '확정일': t });
}

function orderNo_(t) {
  var pre = 'D' + Utilities.formatDate(t, 'Asia/Seoul', 'yyMMdd') + '-';
  var n = rows_('주문').filter(function (r) { return String(r['주문번호']).indexOf(pre) === 0; }).length + 1;
  return pre + ('00' + n).slice(-3);
}

// ───────── 확정·대기 ─────────
function confirm_(o, c) {
  var t = now_();
  var stock = rows_('재고').filter(function (r) { return r['곡식'] === o['곡식']; })[0];
  var grain = rows_('곡식').filter(function (r) { return r['코드'] === o['곡식']; })[0];
  var qty = Number(o['양(kg)']);
  var free = stock ? Number(stock['남은 양(kg)'] || 0) - Number(stock['예약된 양(kg)'] || 0) : 0;
  var day = free >= qty ? workDay_(qty, t) : null;
  if (!grain || !stock || free < qty || !day) {
    var why = !grain ? '곡식 표에 없음' : !stock ? '재고 줄 없음' : free < qty ? '남은 양 부족' : '작업일 없음(하루 최대량·도정 가능일 확인)';
    var first = o['상태'] !== '대기';
    if (first) { o['상태'] = '대기'; o['상태 바뀐 시각'] = t; }
    if (first || o['메모'] !== why) { o['메모'] = why; save_('주문', o); }
    if (first) send_('대기안내', c, o);
    log_('확정', o['주문번호'], '대기', why);
    return '대기';
  }
  stock['예약된 양(kg)'] = Number(stock['예약된 양(kg)'] || 0) + qty; save_('재고', stock);
  day['배정된 양(kg)'] = Number(day['배정된 양(kg)'] || 0) + qty; save_('작업 달력', day);

  var price = Number(grain['가격(원/kg)'] || 0);
  var rate = on_('loyalty') ? loyaltyRate_(liveCount_(c['고객번호']) + 1) : 0;
  o['단가'] = price; o['금액'] = price * qty; o['할인율'] = rate;
  o['할인액'] = Math.round(o['금액'] * rate / 100); o['청구액'] = o['금액'] - o['할인액'];
  o['작업일'] = day_(day['날짜']); o['받을 날'] = addDays_(o['작업일'], val_('ship_days', 2));
  o['입금 기한'] = addDays_(t, val_('pay_days', 3)); o['입금 안내 횟수'] = 0;
  o['상태'] = '확정'; o['상태 바뀐 시각'] = t; o['메모'] = '';
  save_('주문', o);

  var firstEver = !c['두두 호'];
  if (firstEver) { c['두두 호'] = nextHo_(); c['첫 주문일'] = t; }
  c['마지막 주문일'] = t;
  c['단골 회차'] = liveCount_(c['고객번호']);
  save_('고객', c);
  send_('확정입금안내', c, o);
  if (firstEver) send_('첫고객호', c, o);
  if (rate > 0 && loyaltyRate_(c['단골 회차']) > 0 && loyaltyRate_(c['단골 회차'] - 1) === 0) send_('단골할인', c, o);
  log_('확정', o['주문번호'], '확정', '');
  return '확정';
}

function workDay_(qty, t) {
  var from = day_(addDays_(t, val_('lead_days', 1)));
  return rows_('작업 달력')
    .filter(function (d) {
      return d['도정 가능'] === '가능' && day_(d['날짜']) >= from &&
        Number(d['배정된 양(kg)'] || 0) + qty <= Number(d['하루 최대량(kg)'] || 0);
    })
    .sort(function (a, b) { return toDate_(a['날짜']) - toDate_(b['날짜']); })[0] || null;
}

function liveCount_(cid) {
  return rows_('주문').filter(function (r) { return r['고객'] === cid && LIVE.indexOf(r['상태']) >= 0; }).length;
}
// 회차 n번째 주문에 붙는 할인율(%). loyalty_rates "2:3,3:5,5:7" = 2회째 3%, 3~4회째 5%, 5회째부터 7%
function loyaltyRate_(n) {
  var rate = 0;
  String(val_('loyalty_rates', '')).split(',').forEach(function (pair) {
    var p = pair.split(':');
    if (p.length === 2 && n >= Number(p[0])) rate = Math.max(rate, Number(p[1]));
  });
  return rate;
}
function nextHo_() {
  var max = 0;
  rows_('고객').forEach(function (r) { max = Math.max(max, Number(r['두두 호'] || 0)); });
  return max + 1;
}

// 재고를 넣었거나 취소가 생기면 대기 주문을 들어온 순서대로 다시 본다.
function processWaitlist() {
  var cs = rows_('고객');
  rows_('주문').filter(function (o) { return o['상태'] === '대기'; })
    .sort(function (a, b) { return toDate_(a['상태 바뀐 시각']) - toDate_(b['상태 바뀐 시각']); })
    .forEach(function (o) {
      var fresh = rows_('주문').filter(function (r) { return r._row === o._row; })[0];
      var c = cs.filter(function (x) { return x['고객번호'] === o['고객']; })[0];
      if (fresh && c) confirm_(fresh, rows_('고객').filter(function (x) { return x._row === c._row; })[0]);
    });
}

// ───────── 입금 기한·자동 취소 ─────────
function checkDeadlines() {
  var t = now_();
  rows_('주문').filter(function (o) { return o['상태'] === '확정' && o['입금 기한'] && toDate_(o['입금 기한']) < t; })
    .forEach(function (o) {
      var c = rows_('고객').filter(function (x) { return x['고객번호'] === o['고객']; })[0];
      if (Number(o['입금 안내 횟수'] || 0) < 1) {
        o['입금 안내 횟수'] = 1; o['입금 기한'] = addDays_(t, val_('pay_days', 3)); save_('주문', o);
        send_('입금기한안내', c, o);
        log_('입금 기한', o['주문번호'], '안내 1회');
      } else {
        cancel_(o, '입금 기한 두 번 지남');
        send_('자동취소', c, o);
      }
    });
}

function cancel_(o, why) {
  var qty = Number(o['양(kg)']);
  if (['확정', '입금'].indexOf(o['상태']) >= 0) {
    var s = rows_('재고').filter(function (r) { return r['곡식'] === o['곡식']; })[0];
    if (s) { s['예약된 양(kg)'] = Math.max(0, Number(s['예약된 양(kg)'] || 0) - qty); save_('재고', s); }
    var d = rows_('작업 달력').filter(function (r) { return o['작업일'] && ymd_(r['날짜']) === ymd_(o['작업일']); })[0];
    if (d) { d['배정된 양(kg)'] = Math.max(0, Number(d['배정된 양(kg)'] || 0) - qty); save_('작업 달력', d); }
  }
  o['상태'] = '취소'; o['상태 바뀐 시각'] = now_(); o['메모'] = why; save_('주문', o);
  log_('취소', o['주문번호'], '취소', why);
}

// ───────── 상태 옮기기 (입금 대조·현황판 입력이 부른다) ─────────
// 입금: 6단계 입금 대조가 부른다. 발송: 현황판 송장 입력. 작업 시작 뒤 취소는 확인필요.
function setStatus(orderNo, status, extra) {
  return withLock_(function () {
    var o = rows_('주문').filter(function (r) { return r['주문번호'] === orderNo; })[0];
    if (!o) { log_('상태', orderNo, '실패', '주문 없음'); return false; }
    var c = rows_('고객').filter(function (x) { return x['고객번호'] === o['고객']; })[0];
    var t = now_();
    if (status === '취소') {
      if (['작업', '발송', '도착'].indexOf(o['상태']) >= 0) { o['메모'] = '작업 뒤 취소 요청 — 확인필요'; o['상태'] = '확인필요'; save_('주문', o); log_('상태', orderNo, '확인필요', '작업 뒤 취소'); return false; }
      cancel_(o, (extra && extra['이유']) || '요청'); processWaitlist(); return true;
    }
    if (status === '입금') { o['입금일'] = t; }
    if (status === '발송') {
      o['송장'] = (extra && extra['송장']) || o['송장'];
      var s = rows_('재고').filter(function (r) { return r['곡식'] === o['곡식']; })[0];
      if (s) { var q = Number(o['양(kg)']); s['남은 양(kg)'] = Number(s['남은 양(kg)']) - q; s['예약된 양(kg)'] = Math.max(0, Number(s['예약된 양(kg)']) - q); save_('재고', s); }
    }
    o['상태'] = status; o['상태 바뀐 시각'] = t; save_('주문', o);
    var tpl = { '입금': '입금확인', '작업': '찧은날', '발송': '발송안내', '도착': '도착확인' }[status];
    if (tpl) send_(tpl, c, o);
    if (status === '도착') { c['예상 소진일'] = addDays_(t, cycleDays_(c['고객번호'])); save_('고객', c); }
    log_('상태', orderNo, status);
    return true;
  });
}

function cycleDays_(cid) {
  var k = rows_('취향').filter(function (r) { return r['고객'] === cid && r['주기(일)']; }).pop();
  return Number(k ? k['주기(일)'] : val_('default_cycle_days', 30));
}

// ───────── 고객 단계 (11-1) ─────────
function updateStage_(c) {
  var before = c['단계'];
  var n = liveCount_(c['고객번호']);
  var t = now_();
  var stage = n === 0 ? '관심' : n === 1 ? '첫 고객' : '단골';
  if (c['유형'] === '식당·가게' || c['유형'] === '단체') stage = '식당·단체';
  if (n > 0 && c['예상 소진일'] && addDays_(c['예상 소진일'], val_('rest_days', 60)) < t) {
    var last = toDate_(c['마지막 주문일']);
    if (!last || last < toDate_(c['예상 소진일'])) stage = '쉬는 고객';
  }
  if (stage !== before) {
    c['단계'] = stage; save_('고객', c);
    log_('단계', c['고객번호'], before + ' → ' + stage);
    if (stage === '쉬는 고객') send_('쉬는고객안부', c, null);
  }
}
function updateStages() { rows_('고객').forEach(updateStage_); }

// ───────── 떨어질 때쯤 알림 ─────────
function refillAlert() {
  if (!on_('refill_alert')) return;
  var t = day_(now_()), lead = Number(val_('refill_lead_days', 5));
  var sent = rows_('연락');
  rows_('고객').forEach(function (c) {
    if (!c['예상 소진일'] || c['수신 거부'] === 'Y') return;
    var due = day_(addDays_(c['예상 소진일'], -lead));
    if (t < due) return;
    var already = sent.some(function (s) {
      return s['고객'] === c['고객번호'] && s['문자틀'] === '떨어질때' && toDate_(s['시각']) >= due;
    });
    if (!already) send_('떨어질때', c, null);
  });
}

// ───────── 연락(발송) ─────────
// 실제 발송은 6단계. 지금은 연락 시트에 남기기만 한다(sms_send 끔이면 「보류」).
function send_(code, c, o) {
  if (!c) return;
  var rule = rows_('연락 규칙').filter(function (r) { return r['문자틀'] === code; })[0];
  var tpl = rows_('문자틀').filter(function (r) { return r['코드'] === code; })[0];
  var rec = { '시각': now_(), '고객': c['고객번호'], '주문': o ? o['주문번호'] : '', '경로': '문자', '문자틀': code,
              '종류': tpl ? tpl['종류'] : '', '결과': '' };
  if (!tpl) rec['결과'] = '건너뜀: 문자틀 없음';
  else if (rule && rule['켬/끔'] !== '켬') rec['결과'] = '건너뜀: 규칙 끔';
  else if (c['수신 거부'] === 'Y' && tpl['종류'] === '광고') rec['결과'] = '건너뜀: 수신 거부';
  else if (tpl['종류'] === '광고' && !adOk_(c)) rec['결과'] = '건너뜀: 광고 조건(동의·시간대·월 상한)';
  else if (o && o['받는 분'] && tpl['종류'] === '광고') rec['결과'] = '건너뜀: 선물 받는 분';
  else rec['결과'] = (on_('sms_send') ? '보낼 차례(6단계 연결 전)' : '보류(sms_send 끔)') + ' — ' + fill_(c['문자 판'] === '짧은 판' ? tpl['짧은 판'] : tpl['문구'], c, o);
  append_('연락', rec);
}
function adOk_(c) {
  var agreed = rows_('동의').some(function (a) { return a['고객'] === c['고객번호'] && a['종류'] === '소식' && !a['철회 시각']; });
  if (!agreed) return false;
  var h = now_().getHours(), span = String(val_('ad_hours', '9~20')).match(/\d+/g) || [9, 20];
  if (h < Number(span[0]) || h >= Number(span[1])) return false;
  var monthStart = new Date(now_().getFullYear(), now_().getMonth(), 1);
  var used = rows_('연락').filter(function (s) {
    return s['고객'] === c['고객번호'] && s['종류'] === '광고' && toDate_(s['시각']) >= monthStart && String(s['결과']).indexOf('건너뜀') !== 0;
  }).length;
  return used < Number(val_('ad_monthly_max', 2));
}
function fill_(text, c, o) {
  var map = { '이름': c['이름'], '호': c['두두 호'] };
  if (o) {
    map['주문번호'] = o['주문번호']; map['양'] = o['양(kg)']; map['곡식'] = o['곡식']; map['청구액'] = o['청구액'];
    map['입금기한'] = o['입금 기한'] ? ymd_(o['입금 기한']) : ''; map['받을날'] = o['받을 날'] ? ymd_(o['받을 날']) : '';
  }
  return String(text || '').replace(/\{([^}]+)\}/g, function (m, k) { return map[k] === undefined ? m : map[k]; });
}

// ───────── 스위치 값 내보내기 (홈페이지가 읽음) ─────────
function exportSwitches() {
  var sw = {};
  SWITCHES.forEach(function (k) { sw[k] = false; });
  rows_('설정').forEach(function (r) { if (r['공개'] === 'Y' && SWITCHES.indexOf(r['이름']) >= 0) sw[r['이름']] = r['켬/끔'] === '켬'; });
  var grains = rows_('곡식').filter(function (g) { return g['공개'] === 'Y' && g['상태'] !== '숨김'; }).map(function (g) {
    var out = {};
    ['코드', '제품', '상태', '부르는 이름', '한 줄', '맛', '요리', '보관', '수확', '단위(kg)', '가격(원/kg)', '사진'].forEach(function (k) { out[k] = g[k]; });
    if (sw.live_stock) {
      var s = rows_('재고').filter(function (r) { return r['곡식'] === g['코드']; })[0];
      out['남은 양(kg)'] = s ? Math.max(0, Number(s['남은 양(kg)']) - Number(s['예약된 양(kg)'] || 0)) : 0;
    }
    return out;
  });
  return { switches: sw, grains: grains, at: now_().toISOString() };
}

// ───────── 웹 입구 (배포: 웹 앱, 실행 = 나, 액세스 = 모든 사용자) ─────────
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  var body = action === 'switches' ? exportSwitches() : { ok: false, error: 'unknown action' };
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  var body;
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.mode === 'order' && !on_('order')) p.mode = 'inquiry';   // 주문 스위치가 꺼져 있으면 문의로 받는다
    body = intake(p);
  } catch (err) {
    log_('doPost', '', '실패', String(err));
    body = { ok: false };
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// ───────── 예약 작업 ─────────
function runScheduled() {
  withLock_(function () {
    [checkDeadlines, processWaitlist, updateStages, refillAlert].forEach(function (fn) {
      try { fn(); } catch (err) { log_(fn.name || '예약 작업', '', '실패', String(err)); }
    });
    var r = setting_('last_run');
    if (r) { r['값'] = now_(); save_('설정', r); }
  });
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}
