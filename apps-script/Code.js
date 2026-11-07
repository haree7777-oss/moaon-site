// 두두 고객장부 규칙 일꾼 (Google Apps Script, V8)
// 설계 정본: 80_브랜드마케팅/주문고객_설계.md 3·4·5·6·7·9·11장. 문자틀·연락 규칙은 홈페이지_문안.md 부록 1~5.
// 키·비밀번호는 여기 적지 않는다. 발송 서비스 키는 프로젝트 설정 > 스크립트 속성에만 (6단계).

// ───────── 장부 구조 (시트 이름과 칸 순서) ─────────
var SCHEMA = {
  '접수': ['접수번호', '시각', '경로', '원문', '이름', '연락처', '처리상태', '연결 고객', '연결 주문', '메모'],
  '고객': ['고객번호', '이름', '연락처', '지역', '유형', '식구 수', '처음 온 날', '처음 경로', '입금자명들', '단골 회차', '두두 호',
          '단계', '첫 주문일', '마지막 주문일', '예상 소진일', '문자 판', '수신 거부', '메모'],
  '동의': ['동의번호', '고객', '종류', '문구 판', '동의 시각', '철회 시각', '경로', '보관 끝나는 날'],
  '관심': ['관심번호', '고객', '곡식', '양', '시기', '용도', '출처', '기록일'],
  '취향': ['취향번호', '고객', '제품', '도정', '찹쌀', '콩 비율', '양(kg)', '소포장', '주기(일)', '판', '확정일'],
  '주문': ['주문번호', '접수번호', '고객', '곡식', '조합', '양(kg)', '곡식 금액', '소포장', '할인율', '할인 사유', '할인액', '배송비', '청구액',
          '상태', '작업일', '받을 날', '입금 기한', '입금 안내 횟수', '입금일', '송장', '피드백', '받는 분', '상태 바뀐 시각', '메모'],
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
  ['order', '끔', '', '주문 받기', 'Y'], ['survey', '끔', '', '취향 설문(보류)', 'Y'], ['notify', '끔', '', '소식 받기', 'Y'],
  ['kakao_bot', '끔', '', '카톡 챗봇', 'Y'], ['sms_send', '끔', '', '문자 실제 발송(끄면 연락 시트에 「보류」만)', 'Y'],
  ['bank_match', '끔', '', '입금 대조', 'Y'], ['loyalty', '끔', '', '소식 동의자 3번째 주문 할인', 'Y'],
  ['refill_alert', '끔', '', '떨어질 때쯤 알림', 'Y'], ['live_stock', '끔', '', '남은 양 실시간 표시', 'Y'],
  ['countdown', '끔', '', '오픈 예고', 'Y'], ['doodoo_rice', '끔', '', '두두쌀', 'Y'], ['doodoo_misu', '끔', '', '두두미숫가루(보류)', 'Y'],
  ['pay_days', '', 3, '입금 기한(일). 지나면 안내 1회, 다시 지나면 자동 취소', ''],
  ['lead_days', '', 1, '확정 뒤 가장 빠른 작업일까지(일)', ''],
  ['ship_days', '', 2, '작업일 뒤 받을 날까지(일)', ''],
  ['feedback_days', '', 3, '받은 뒤 밥맛 묻기까지(일)', ''],
  ['loyalty_every', '', 3, '소식 동의자 할인 회차 간격(3이면 3·6·9번째)', ''],
  ['loyalty_rate', '', 10, '회차 할인율(%) — 임시값', ''],
  ['ho_seats', '', 100, '두두 ○호 번호를 주는 첫 고객 수', ''],
  ['ho_rate', '', 10, '○호 고객 모든 주문 할인율(%) — 회차 할인과 겹치지 않음', ''],
  ['subpack_fee', '', '10:1000,20:2000', '소포장 추가 금액(포장 kg:원)', ''],
  ['shipping_fee', '', '', '배송비(원) 【대표】 — 0이면 무료 배송', ''],
  ['account', '', '', '입금 계좌 【대표】', ''],
  ['refill_lead_days', '', 5, '예상 소진일 며칠 전에 알림', ''],
  ['default_cycle_days', '', 30, '취향에 주기가 없을 때 예상 소진 날수', ''],
  ['rest_days', '', 60, '예상 소진일 뒤 이만큼 주문 없으면 쉬는 고객', ''],
  ['dup_minutes', '', 10, '같은 연락처·같은 내용이 이 안에 또 오면 중복', ''],
  ['notice_hours', '', '8~21', '안내 문자 시간대(시~시)', ''],
  ['ad_hours', '', '9~20', '광고 보내는 시간대(시~시)', ''],
  ['ad_monthly_max', '', 2, '사람마다 한 달 광고 상한', ''],
  ['recall_per_hour', '', 5, '지난 주문 불러오기 — 번호 하나당 한 시간 횟수', ''],
  ['last_run', '', '', '규칙 일꾼이 마지막으로 돈 시각(자동)', '']
];

// 문자틀 — 문안 부록 1~3 그대로. {이름} 등은 장부 값으로 채운다. 「같음」은 일반 판과 같다는 뜻.
var CONFIRM_BODY = '{곡식} {조합} {양} / {금액}원{할인 줄}. {기한}까지 {계좌}로 입금해 주세요(입금자명이 달라도 됩니다). 받으실 날: {받을 날} 무렵. 입금 확인 안내가 1시간 안에 오지 않으면 답장 주세요.';
var DEFAULT_TEMPLATES = [
  ['접수', '확정', '{이름}님, 예약 신청을 받았습니다. 재고 확인 후 확정 안내를 드리겠습니다.', '{이름}님, 예약 받았습니다. 확정되면 문자 드리겠습니다.', '안내'],
  ['상담접수', '확정', '{이름}님, 상담 신청을 받았습니다. 확인 후 연락드리겠습니다.', '같음', '안내'],
  ['확정', '확정', '{이름}님, 예약이 확정됐습니다. ' + CONFIRM_BODY, '같음', '안내'],
  ['확정·환불확인', '확정', '주문 후 찧는 쌀입니다. 찧기 전 취소는 전액 환불, 찧은 뒤 단순 변심 반품은 어렵습니다. 상품에 문제가 있으면 교환·환불해 드립니다. 입금하시면 이 내용에 동의하신 것으로 봅니다.', '같음', '안내'],
  ['첫고객', '확정', '{이름}님은 두두 {○호} 고객입니다. 앞으로 모든 주문이 10% 할인됩니다.', '같음', '안내'],
  ['대기', '확정', '{이름}님, 재고가 부족해 바로 확정하지 못했습니다. 준비되는 대로 순서대로 연락드리겠습니다.', '같음', '안내'],
  ['대기확정', '확정', '{이름}님, 기다려 주셔서 감사합니다. 예약이 확정됐습니다. ' + CONFIRM_BODY, '같음', '안내'],
  ['입금확인', '확정', '{이름}님, {금액}원 입금 확인했습니다. {받을 날} 무렵 보내 드립니다.', '같음', '안내'],
  ['입금독촉', '확정', '{이름}님, {곡식} 예약 입금이 아직 확인되지 않았습니다. {새 기한}까지 입금해 주세요. 이미 보내셨다면 답장 주세요.', '같음', '안내'],
  ['자동취소', '확정', '{이름}님, 입금 기한이 지나 {곡식} 예약을 취소했습니다. 다시 필요하시면 답장 주세요.', '같음', '안내'],
  ['취소확인', '확정', '{이름}님, {곡식} 예약을 취소했습니다. 입금하신 {금액}원은 {환불일}까지 전액 환불해 드립니다.', '같음', '안내'],
  ['찧은날', '확정', '{이름}님, 오늘 {이름}님 쌀을 찧었습니다. {조합}.', '같음', '안내'],
  ['발송', '확정', '{이름}님, {택배사} {송장번호}로 보냈습니다. {받을 날} 무렵 도착합니다.', '같음', '안내'],
  ['늦어짐', '확정', '{이름}님, 죄송합니다. 작업 일정이 밀려 {받을 날}에 보내 드리기 어렵습니다. {새 날짜}에 보내 드려도 될까요? 취소를 원하시면 답장 주세요.', '같음', '안내'],
  ['도착다음날', '확정', '{이름}님, 잘 받으셨나요? {밥 짓기 한 줄} 문제가 있으면 답장 주세요.', '같음', '안내'],
  ['밥맛', '확정', '{이름}님, 밥맛은 어떠셨나요? 하나만 골라 주세요. [더 차지게] [그대로] [덜 차지게] [별로였어요]', '{이름}님, 밥맛은 어떠셨나요? 숫자로 답장 주세요. 1 더 차지게 2 그대로 3 덜 차지게 4 별로였어요', '안내'],
  ['다음조합', '확정', '다음 주문은 찹쌀 {새 비율}로 바꿀까요? [바꾸기] [그대로]', '다음 주문은 찹쌀 {새 비율}로 바꿀까요? 바꾸시려면 「네」라고 답장 주세요.', '안내'],
  ['수신거부', '확정', '(두두농장) {날짜} 소식 받기를 멈췄습니다. 주문 안내 문자는 그대로 갑니다.', '같음', '안내'],
  ['동의확인', '확정', '(두두농장) {이름}님은 {동의한 날} 두두 소식 받기에 동의하셨습니다. 계속 받으시려면 그대로 두시고, 그만 받으시려면 「그만」이라고 답장 주세요.', '같음', '안내'],
  ['떨어질때', '확정', '{이름}님, 지난번 {양} 쌀이 떨어질 때가 되어 연락드립니다. {조합} 그대로 준비할까요? [같은 조합으로 주문]', '{이름}님, 지난번 {양} 쌀이 떨어질 때가 되어 연락드립니다. 같은 조합으로 준비할까요? 「네」라고 답장 주세요.', '광고'],
  ['단골축하', '확정', '{이름}님, 다시 찾아 주셔서 감사합니다. 다음({n+1}번째) 주문 시 10% 할인이 적용됩니다.', '같음', '광고'],
  ['우선예약', '확정', '{이름}님(두두 {○호}), 올해 햅쌀 우선 예약을 엽니다. {날짜}까지 {이름}님 몫을 확보해 둡니다. [같은 조합으로 예약]', '{이름}님(두두 {○호}), 올해 햅쌀 우선 예약을 엽니다. {날짜}까지 {이름}님 몫을 확보해 둡니다. 같은 조합이면 「네」라고 답장 주세요.', '광고'],
  ['오픈예고', '확정', '두두 첫 예약을 {날짜} {시각}에 시작합니다. 올해 준비한 양은 {수량}입니다. 소식 받기 동의하신 분은 {n}시간 먼저 예약하실 수 있습니다.', '같음', '광고'],
  ['미숫가루', '보류', '{이름}님, 두두미숫가루를 시작했습니다. 콩과 보리 비율을 직접 고르실 수 있습니다. [보기]', '{이름}님, 두두미숫가루를 시작했습니다. 콩과 보리 비율을 직접 고르실 수 있습니다. 문의는 답장 주세요.', '광고'],
  ['1년', '확정', '{이름}님, 1년 전 오늘 첫 주문을 보내 드렸습니다. 같은 논둑에서 찍은 1년 영상입니다. [영상 보기]', '', '광고'],
  ['안부', '확정', '{이름}님, 정읍 두두농장 최현철입니다. 들녘은 {계절 한 줄}. 필요하실 때 답장 주세요.', '같음', '광고']
];

// 연락 규칙 — 문안 부록 5. 대표는 켬/끔만.
var DEFAULT_RULES = [
  ['접수', '접수(문자·전화·기록방)', '모두', '접수', '안내', '08~21시', '', '켬'],
  ['확정', '자동 확정', '모두(첫 주문이면 첫고객 한 줄)', '확정 · 첫고객', '안내', '08~21시', '', '켬'],
  ['대기', '재고 모자람 / 재고 들어옴', '해당 주문', '대기 / 대기확정', '안내', '08~21시', '', '켬'],
  ['입금 확인', '입금 맞춤', '해당 주문', '입금확인', '안내', '08~21시', '', '켬'],
  ['입금 기한', '입금 기한 1차 / 2차', '해당 주문', '입금독촉 / 자동취소', '안내', '09~20시', '', '켬'],
  ['고객 취소', '고객 취소', '해당 주문', '취소확인', '안내', '08~21시', '', '켬'],
  ['작업 완료', '작업 완료', '해당 주문', '찧은날', '안내', '08~21시', '', '켬'],
  ['송장', '송장 입력', '해당 주문', '발송', '안내', '08~21시', '', '켬'],
  ['늦어짐', '받을 날 위험', '해당 주문', '늦어짐', '안내', '08~21시', '', '켬'],
  ['도착 다음 날', '도착 다음 날', '해당 주문', '도착다음날', '안내', '09~20시', '', '켬'],
  ['밥맛', '도착 {피드백 날수}일 뒤', '해당 주문', '밥맛 → 다음조합', '안내', '09~20시', '', '켬'],
  ['떨어질 때쯤', '예상 소진일 무렵', '첫 고객·단골(소식 동의)', '떨어질때', '광고', '09~20시', '광고 합쳐 2회', '켬'],
  ['단골 축하', '할인 직전 회차(2·5·8번째) 도착 뒤', '단골 · 소식 동의', '단골축하', '광고', '09~20시', '광고 합쳐 2회', '켬'],
  ['수신 거부', '「그만」 답장', '모두', '수신거부', '안내', '바로', '', '켬'],
  ['동의 확인', '소식 동의 2년', '소식 동의', '동의확인', '안내', '09~20시', '2년에 1회', '켬'],
  ['우선 예약', '햅쌀 예약 전', '○호 고객 · 소식 동의', '우선예약', '광고(문자)', '09~20시', '광고 합쳐 2회', '끔'],
  ['오픈 예고', '첫 예약 D-30·7·1', '소식 동의', '오픈예고', '광고(카톡 먼저, 카톡 없는 짧은 판만 문자)', '09~20시', '광고 합쳐 2회', '끔'],
  ['미숫가루', '미숫가루 출시 뒤', '쌀 2회 이상 단골 · 소식 동의', '미숫가루', '광고', '09~20시', '광고 합쳐 2회', '끔'],
  ['1년', '첫 주문 1년', '단골 · 소식 동의', '1년', '광고', '09~20시', '광고 합쳐 2회', '끔'],
  ['안부', '예상 소진일 + 60일', '쉬는 고객 · 소식 동의', '안부', '광고', '09~20시', '1회만(평생)', '켬']
];

var LIVE = ['확정', '입금', '작업', '발송', '도착'];   // 취소·대기·확인필요가 아닌 주문
var GRAIN_NAME = { rice: '두두쌀', soy: '선풍 콩' };
var TAIL = '두두농장 최현철 010-4689-8106';

// ───────── 시계(시험 때 바꿔 끼움) ─────────
var Clock = { now: function () { return new Date(); } };
function now_() { return Clock.now(); }
function day_(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays_(d, n) { var x = new Date(d); x.setDate(x.getDate() + Number(n)); return x; }
function ymd_(d) { return Utilities.formatDate(new Date(d), 'Asia/Seoul', 'yyyy-MM-dd'); }
function md_(d) { var x = new Date(d); return (x.getMonth() + 1) + '월 ' + x.getDate() + '일'; }
function toDate_(v) { return v instanceof Date ? v : (v ? new Date(v) : null); }
function phone_(s) { return String(s || '').replace(/\D/g, ''); }
function pairs_(s) { var o = {}; String(s || '').split(',').forEach(function (p) { var a = p.split(':'); if (a.length === 2) o[Number(a[0])] = Number(a[1]); }); return o; }
function hours_(s, a, b) { var m = String(s || '').match(/\d+/g); return m && m.length >= 2 ? [Number(m[0]), Number(m[1])] : [a, b]; }

// ───────── 표 읽고 쓰기 ─────────
// 장부에 붙인(bound) 프로젝트면 getActive(), 따로 만든 프로젝트면 아래 장부 ID로 연다(ID만으로는 열람 권한이 생기지 않는다).
var BOOK_ID = '1yfEsV8uxlwXRmSt9dTuEMhBDeF09eCtbKlGj3T01xTM';
function book_() { return SpreadsheetApp.getActive() || SpreadsheetApp.openById(BOOK_ID); }
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
// 시트는 「010…」 같은 글자를 숫자로 바꿔 앞의 0을 지운다 — 0으로 시작하는 숫자 글자는 앞에 '를 붙여 글자로 둔다.
function cell_(v) { return v === undefined ? '' : (typeof v === 'string' && /^0\d+$/.test(v) ? "'" + v : v); }
function append_(name, obj) {
  var sh = sheet_(name);
  sh.appendRow(SCHEMA[name].map(function (h) { return cell_(obj[h]); }));
  obj._row = sh.getLastRow();
  return obj;
}
function save_(name, obj) {
  sheet_(name).getRange(obj._row, 1, 1, SCHEMA[name].length)
    .setValues([SCHEMA[name].map(function (h) { return cell_(obj[h]); })]);
}
function nextId_(name, prefix, width) {
  var n = rows_(name).length + 1, s = String(n);
  while (s.length < width) s = '0' + s;
  return prefix + s;
}
function one_(name, key, v) { return rows_(name).filter(function (r) { return r[key] === v; })[0] || null; }

// ───────── 설정·처리 기록 ─────────
function setting_(key) { return one_('설정', '이름', key); }
function on_(key) { var r = setting_(key); return !!r && r['켬/끔'] === '켬'; }
function val_(key, fallback) { var r = setting_(key); return r && r['값'] !== '' && r['값'] !== null ? r['값'] : fallback; }
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
// 홈페이지 장바구니: { kind:'order', mode:'order'|'inquiry', 경로, 이름, 연락처, 주소, 받는 분:{이름,연락처,주소}|null,
//                     받고 싶은 때, 요청사항, items:[{grain:'rice'|'soy', glutinous, size, subpack, repeat, text}], 동의:['소식','환불확인'] }
// 대량 상담:          { kind:'bulk', 경로:'상담', 이름, 연락처, 상호, 지역, 유형, 곡식, 찹쌀, 양, 방식, 시작, 포장, 요청사항, 동의 }
// 문자·전화·기록방:   { 경로:'문자'|'전화'|'카톡', 원문, 이름, 연락처, mode:'order', items:[…] } — 클로드가 정리해 넣는다
function intake(p) {
  return withLock_(function () {
    var t = now_();
    var tel = phone_(p['연락처']);
    var route = p['경로'] || '홈페이지';
    var raw = p['원문'] || JSON.stringify(p);
    var rec = append_('접수', { '접수번호': nextId_('접수', 'R', 5), '시각': t, '경로': route, '원문': raw,
                                '이름': p['이름'] || '', '연락처': tel, '처리상태': '새로' });
    if (!tel) { rec['처리상태'] = '확인필요'; rec['메모'] = '연락처 없음'; save_('접수', rec); log_('접수', rec['접수번호'], '확인필요', '연락처 없음'); return { ok: false, 접수번호: rec['접수번호'] }; }

    var dupMin = Number(val_('dup_minutes', 10));
    var dup = rows_('접수').filter(function (r) {
      return r._row !== rec._row && phone_(r['연락처']) === tel && r['원문'] === raw && (t - toDate_(r['시각'])) <= dupMin * 60000;
    })[0];
    if (dup) { rec['처리상태'] = '중복'; rec['메모'] = dup['접수번호'] + '와 같음 — 확인필요'; save_('접수', rec); log_('접수', rec['접수번호'], '중복', dup['접수번호']); return { ok: true, 중복: true, 접수번호: rec['접수번호'] }; }

    var c = customer_(p, tel, t, route);
    rec['연결 고객'] = c['고객번호'];
    (p['동의'] || []).forEach(function (kind) {
      if (kind === '소식' && newsOn_(c['고객번호'])) return;   // 이미 동의한 번호는 다시 쌓지 않는다
      append_('동의', { '동의번호': nextId_('동의', 'A', 5), '고객': c['고객번호'], '종류': kind, '문구 판': p['문구판'] || '법검토 2026-11-04',
                        '동의 시각': t, '경로': route });
    });

    var res = { ok: true, 접수번호: rec['접수번호'], 고객번호: c['고객번호'] };
    var items = (p.items || []).filter(function (it) { return GRAIN_NAME[it.grain] && Number(it.size) > 0; });
    if (p.kind === 'bulk') {
      append_('관심', { '관심번호': nextId_('관심', 'I', 5), '고객': c['고객번호'], '곡식': p['곡식'] || '', '양': p['양 직접'] ? p['양 직접'] + 'kg' : (p['양'] || ''),
                        '시기': p['시작'] || '', '용도': [p['유형'], p['방식'], p['포장'], p['찹쌀']].filter(String).join(' · '), '출처': '상담', '기록일': t });
      rec['메모'] = '상담 요청 — 대표 직접 연락';
      res['상태'] = '상담';
      send_('상담접수', c, null);
    } else if (items.length) {
      items.forEach(function (it) { saveTaste_(c['고객번호'], it, t); });
      if (p.mode === 'order') {
        var o = append_('주문', { '주문번호': orderNo_(t), '접수번호': rec['접수번호'], '고객': c['고객번호'], '곡식': grainsText_(items),
                                 '조합': JSON.stringify(items), '양(kg)': totalKg_(items), '상태': '접수', '입금 안내 횟수': 0,
                                 '받는 분': p['받는 분'] ? JSON.stringify(p['받는 분']) : '', '상태 바뀐 시각': t,
                                 '메모': [p['받고 싶은 때'], p['요청사항']].filter(String).join(' / ') });
        rec['연결 주문'] = o['주문번호'];
        res['주문번호'] = o['주문번호'];
        if (['문자', '전화', '카톡'].indexOf(route) >= 0) send_('접수', c, o);
        res['상태'] = confirm_(o, c);
      } else {
        items.forEach(function (it) {
          append_('관심', { '관심번호': nextId_('관심', 'I', 5), '고객': c['고객번호'], '곡식': GRAIN_NAME[it.grain], '양': it.size + 'kg',
                            '시기': p['받고 싶은 때'] || '', '용도': it.text || '', '출처': route, '기록일': t });
        });
        res['상태'] = '관심';
      }
    } else {
      append_('관심', { '관심번호': nextId_('관심', 'I', 5), '고객': c['고객번호'], '곡식': p['곡식'] || '', '양': p['양'] || '',
                        '시기': p['시기'] || '', '용도': p['용도'] || '', '출처': route, '기록일': t });
      res['상태'] = '관심';
    }
    rec['처리상태'] = '처리됨';
    save_('접수', rec);
    updateStage_(c);
    log_('접수', rec['접수번호'], res['상태']);
    return res;
  });
}

var BULK_TYPE = { '식당·가게': '식당·가게', '단체·급식': '단체', '가정(많은 양)': '가정', '기타': '가정' };
function customer_(p, tel, t, route) {
  var type = p.kind === 'bulk' ? (BULK_TYPE[p['유형']] || '가정') : (p['유형'] || '가정');
  var c = rows_('고객').filter(function (r) { return phone_(r['연락처']) === tel; })[0];
  if (c) {
    if (!c['이름'] && p['이름']) c['이름'] = p['이름'];
    if (!c['지역'] && p['지역']) c['지역'] = p['지역'];
    if (p.kind === 'bulk' && type !== '가정') c['유형'] = type;
    if (p['상호'] && String(c['메모']).indexOf(p['상호']) < 0) c['메모'] = [c['메모'], '상호 ' + p['상호']].filter(String).join(' / ');
    save_('고객', c);
    return c;
  }
  return append_('고객', { '고객번호': nextId_('고객', 'C', 4), '이름': p['이름'] || '', '연락처': tel, '지역': p['지역'] || '',
                           '유형': type, '처음 온 날': t, '처음 경로': route, '단골 회차': 0, '단계': '관심',
                           '문자 판': route === '문자' || route === '전화' ? '짧은 판' : '일반', '수신 거부': '',
                           '메모': p['상호'] ? '상호 ' + p['상호'] : '' });
}

function saveTaste_(cid, it, t) {
  var prev = rows_('취향').filter(function (r) { return r['고객'] === cid && r['제품'] === it.grain; });
  append_('취향', { '취향번호': nextId_('취향', 'T', 5), '고객': cid, '제품': it.grain, '도정': it.grain === 'rice' ? '백미' : '',
                    '찹쌀': it.grain === 'rice' ? Number(it.glutinous || 0) : '', '양(kg)': Number(it.size), '소포장': it.subpack ? 'Y' : '',
                    '주기(일)': it.repeat && it.repeat !== 'once' ? Number(it.repeat) : '', '판': prev.length + 1, '확정일': t });
}

function orderNo_(t) {
  var pre = 'D' + Utilities.formatDate(t, 'Asia/Seoul', 'yyMMdd') + '-';
  var n = rows_('주문').filter(function (r) { return String(r['주문번호']).indexOf(pre) === 0; }).length + 1;
  return pre + ('00' + n).slice(-3);
}

// ───────── 주문 품목 ─────────
function items_(o) { try { var a = JSON.parse(o['조합']); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function totalKg_(items) { return items.reduce(function (s, it) { return s + Number(it.size); }, 0); }
function millKg_(items) { return items.filter(function (it) { return it.grain === 'rice'; }).reduce(function (s, it) { return s + Number(it.size); }, 0); }
function itemText_(it) {
  var parts = [GRAIN_NAME[it.grain]];
  if (it.grain === 'rice') parts.push(Number(it.glutinous) ? '찹쌀 ' + it.glutinous + '%' : '멥쌀만');
  parts.push(it.size + 'kg');
  if (it.subpack) parts.push('소포장');
  return parts.join(' ');
}
function grainsText_(items) { return items.map(itemText_).join(', '); }
function byGrain_(items) { var m = {}; items.forEach(function (it) { m[it.grain] = (m[it.grain] || 0) + Number(it.size); }); return m; }

// ───────── 할인 (설계 4·9장) ─────────
// ○호 고객(전체 첫 ho_seats명)은 모든 주문 ho_rate%. 아니면 소식 받기에 동의한 적이 있으면 loyalty_every번째마다 loyalty_rate%.
// 소식 받기를 그만둬도 그때까지 센 횟수와 할인은 그대로(문안 03-1 · 법검토 1-8). 기준은 곡식+소포장 합계, 둘은 겹치지 않는다.
// 회차는 같은 연락처의 모든 주문(취소·대기 제외)으로 센다.
function discount_(c, n) {
  if (c['두두 호'] && Number(c['두두 호']) <= Number(val_('ho_seats', 100))) return { rate: Number(val_('ho_rate', 10)), why: '두두 ' + c['두두 호'] + '호 고객' };
  var every = Number(val_('loyalty_every', 3));
  if (on_('loyalty') && newsEver_(c['고객번호']) && n % every === 0) return { rate: Number(val_('loyalty_rate', 10)), why: n + '번째 주문' };
  return { rate: 0, why: '' };
}
function newsOn_(cid) {
  return rows_('동의').some(function (a) { return a['고객'] === cid && a['종류'] === '소식' && !a['철회 시각']; });
}
function newsEver_(cid) {
  return rows_('동의').some(function (a) { return a['고객'] === cid && a['종류'] === '소식'; });
}
function seatsLeft_() {
  var used = rows_('고객').filter(function (r) { return Number(r['두두 호'] || 0) > 0; }).length;
  return Math.max(0, Number(val_('ho_seats', 100)) - used);
}

// ───────── 확정·대기 ─────────
function confirm_(o, c) {
  var t = now_();
  var items = items_(o);
  var need = byGrain_(items);
  var stocks = rows_('재고');
  var grains = rows_('곡식');
  var why = '';
  Object.keys(need).forEach(function (g) {
    if (why) return;
    var gr = grains.filter(function (r) { return r['코드'] === g; })[0];
    var s = stocks.filter(function (r) { return r['곡식'] === g; })[0];
    if (!gr) why = '곡식 표에 없음(' + g + ')';
    else if (!s) why = '재고 줄 없음(' + g + ')';
    else if (Number(s['남은 양(kg)'] || 0) - Number(s['예약된 양(kg)'] || 0) < need[g]) why = '남은 양 부족(' + g + ')';
  });
  var mill = millKg_(items);
  var day = why ? null : mill > 0 ? workDay_(mill, t) : { 날짜: day_(addDays_(t, val_('lead_days', 1))), _none: true };
  if (!why && !day) why = '작업일 없음(하루 최대량·도정 가능일 확인)';
  if (why) {
    var first = o['상태'] !== '대기';
    if (first) { o['상태'] = '대기'; o['상태 바뀐 시각'] = t; }
    if (first || o['메모'] !== why) { o['메모'] = why; save_('주문', o); }
    if (first) send_('대기', c, o);
    log_('확정', o['주문번호'], '대기', why);
    return '대기';
  }
  var fromWait = o['상태'] === '대기';
  stocks.forEach(function (s) { if (need[s['곡식']]) { s['예약된 양(kg)'] = Number(s['예약된 양(kg)'] || 0) + need[s['곡식']]; save_('재고', s); } });
  if (!day._none) { day['배정된 양(kg)'] = Number(day['배정된 양(kg)'] || 0) + mill; save_('작업 달력', day); }

  var firstEver = !c['두두 호'] && liveCount_(c['고객번호']) === 0;
  if (firstEver && seatsLeft_() > 0) c['두두 호'] = nextHo_();
  var fee = pairs_(val_('subpack_fee', ''));
  var price = {};
  grains.forEach(function (g) { price[g['코드']] = Number(g['가격(원/kg)'] || 0); });
  var grainSum = items.reduce(function (s, it) { return s + price[it.grain] * Number(it.size); }, 0);
  var subSum = items.reduce(function (s, it) { return s + (it.subpack ? Number(fee[Number(it.size)] || 0) : 0); }, 0);
  var n = liveCount_(c['고객번호']) + 1;
  var d = discount_(c, n);
  o['곡식 금액'] = grainSum; o['소포장'] = subSum; o['할인율'] = d.rate; o['할인 사유'] = d.why;
  o['할인액'] = Math.round((grainSum + subSum) * d.rate / 100);
  o['배송비'] = Number(val_('shipping_fee', 0)) || 0;
  o['청구액'] = grainSum + subSum - o['할인액'] + o['배송비'];
  o['작업일'] = day_(day['날짜']); o['받을 날'] = addDays_(o['작업일'], val_('ship_days', 2));
  o['입금 기한'] = addDays_(t, val_('pay_days', 3)); o['입금 안내 횟수'] = 0;
  o['상태'] = '확정'; o['상태 바뀐 시각'] = t; o['메모'] = '';
  save_('주문', o);

  if (firstEver) c['첫 주문일'] = t;
  c['마지막 주문일'] = t;
  c['단골 회차'] = n;
  save_('고객', c);
  var route = (one_('접수', '접수번호', o['접수번호']) || {})['경로'];
  send_(fromWait ? '대기확정' : '확정', c, o, {
    append: [firstEver && c['두두 호'] ? '첫고객' : '', ['문자', '전화', '카톡'].indexOf(route) >= 0 ? '확정·환불확인' : ''] });
  log_('확정', o['주문번호'], '확정', d.why);
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
function nextHo_() {
  var max = 0;
  rows_('고객').forEach(function (r) { max = Math.max(max, Number(r['두두 호'] || 0)); });
  return max + 1;
}

// 재고를 넣었거나 취소가 생기면 대기 주문을 들어온 순서대로 다시 본다.
function processWaitlist() {
  rows_('주문').filter(function (o) { return o['상태'] === '대기'; })
    .sort(function (a, b) { return toDate_(a['상태 바뀐 시각']) - toDate_(b['상태 바뀐 시각']); })
    .forEach(function (o) {
      var fresh = rows_('주문').filter(function (r) { return r._row === o._row; })[0];
      var c = one_('고객', '고객번호', o['고객']);
      if (fresh && c && fresh['상태'] === '대기') confirm_(fresh, c);
    });
}

// ───────── 입금 기한·자동 취소 ─────────
function checkDeadlines() {
  var t = now_();
  rows_('주문').filter(function (o) { return o['상태'] === '확정' && o['입금 기한'] && toDate_(o['입금 기한']) < t; })
    .forEach(function (o) {
      var c = one_('고객', '고객번호', o['고객']);
      if (Number(o['입금 안내 횟수'] || 0) < 1) {
        o['입금 안내 횟수'] = 1; o['입금 기한'] = addDays_(t, val_('pay_days', 3)); save_('주문', o);
        send_('입금독촉', c, o);
        log_('입금 기한', o['주문번호'], '안내 1회');
      } else {
        cancel_(o, '입금 기한 두 번 지남');
        send_('자동취소', c, o);
      }
    });
}

function cancel_(o, why) {
  if (['확정', '입금'].indexOf(o['상태']) >= 0) {
    var need = byGrain_(items_(o));
    rows_('재고').forEach(function (s) {
      if (need[s['곡식']]) { s['예약된 양(kg)'] = Math.max(0, Number(s['예약된 양(kg)'] || 0) - need[s['곡식']]); save_('재고', s); }
    });
    var mill = millKg_(items_(o));
    var d = rows_('작업 달력').filter(function (r) { return mill > 0 && o['작업일'] && ymd_(r['날짜']) === ymd_(o['작업일']); })[0];
    if (d) { d['배정된 양(kg)'] = Math.max(0, Number(d['배정된 양(kg)'] || 0) - mill); save_('작업 달력', d); }
  }
  o['상태'] = '취소'; o['상태 바뀐 시각'] = now_(); o['메모'] = why; save_('주문', o);
  log_('취소', o['주문번호'], '취소', why);
}

// ───────── 상태 옮기기 (입금 대조·현황판 입력이 부른다) ─────────
// extra: 입금 {입금자명} · 발송 {택배사, 송장} · 취소 {이유}
function setStatus(orderNo, status, extra) {
  return withLock_(function () {
    extra = extra || {};
    var o = one_('주문', '주문번호', orderNo);
    if (!o) { log_('상태', orderNo, '실패', '주문 없음'); return false; }
    var c = one_('고객', '고객번호', o['고객']);
    var t = now_();
    if (status === '취소') {
      if (['작업', '발송', '도착'].indexOf(o['상태']) >= 0) { o['메모'] = '작업 뒤 취소 요청 — 확인필요'; o['상태'] = '확인필요'; save_('주문', o); log_('상태', orderNo, '확인필요', '작업 뒤 취소'); return false; }
      var paid = o['상태'] === '입금';
      cancel_(o, extra['이유'] || '고객 요청');
      if (paid) send_('취소확인', c, o);
      processWaitlist(); return true;
    }
    if (status === '입금') {
      o['입금일'] = t;
      if (extra['입금자명'] && String(c['입금자명들']).indexOf(extra['입금자명']) < 0) {
        c['입금자명들'] = [c['입금자명들'], extra['입금자명']].filter(String).join(', '); save_('고객', c);
      }
    }
    if (status === '발송') {
      o['송장'] = [extra['택배사'], extra['송장']].filter(String).join(' ') || o['송장'];
      var need = byGrain_(items_(o));
      rows_('재고').forEach(function (s) {
        var q = need[s['곡식']]; if (!q) return;
        s['남은 양(kg)'] = Number(s['남은 양(kg)']) - q; s['예약된 양(kg)'] = Math.max(0, Number(s['예약된 양(kg)']) - q); save_('재고', s);
      });
    }
    o['상태'] = status; o['상태 바뀐 시각'] = t; save_('주문', o);
    var tpl = { '입금': '입금확인', '작업': millKg_(items_(o)) > 0 ? '찧은날' : '', '발송': '발송' }[status];
    if (tpl) send_(tpl, c, o, extra);
    if (status === '도착') { c['예상 소진일'] = addDays_(t, cycleDays_(c['고객번호'])); save_('고객', c); }
    log_('상태', orderNo, status);
    return true;
  });
}

// 밥맛 답(1 더 차지게 · 2 그대로 · 3 덜 차지게 · 4 별로) — 6단계 수신 처리가 부른다.
function handleFeedback(orderNo, answer) {
  var o = one_('주문', '주문번호', orderNo); if (!o) return false;
  var c = one_('고객', '고객번호', o['고객']);
  o['피드백'] = String(answer); save_('주문', o);
  if (String(answer) === '4') { o['메모'] = '밥맛 별로 — 대표 직접 전화'; o['상태'] = '확인필요'; save_('주문', o); log_('밥맛', orderNo, '대표 직접 전화'); return true; }
  var rice = items_(o).filter(function (it) { return it.grain === 'rice'; })[0];
  if (rice && (String(answer) === '1' || String(answer) === '3')) {
    var steps = [0, 10, 20, 30], i = steps.indexOf(Number(rice.glutinous || 0));
    var j = Math.max(0, Math.min(steps.length - 1, i + (String(answer) === '1' ? 1 : -1)));
    if (j !== i) send_('다음조합', c, o, { '새 비율': steps[j] + '%' });
  }
  log_('밥맛', orderNo, String(answer));
  return true;
}

// 「그만」 답장 — 소식 동의를 거두고 결과를 한 번 알린다(정보통신망법 50조⑦).
function optOut(tel) {
  var c = rows_('고객').filter(function (r) { return phone_(r['연락처']) === phone_(tel); })[0];
  if (!c) return false;
  var t = now_();
  rows_('동의').forEach(function (a) { if (a['고객'] === c['고객번호'] && a['종류'] === '소식' && !a['철회 시각']) { a['철회 시각'] = t; save_('동의', a); } });
  c['수신 거부'] = 'Y'; save_('고객', c);
  send_('수신거부', c, null, { '날짜': md_(t) });
  log_('수신 거부', c['고객번호'], '처리');
  return true;
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
    if (stage === '쉬는 고객' && !sentEver_(c['고객번호'], '안부')) send_('안부', c, null);
  }
}
function updateStages() { rows_('고객').forEach(updateStage_); }

// ───────── 날짜 따라 보내는 것들 ─────────
function sentEver_(cid, code, orderNo, since) {
  return rows_('연락').some(function (s) {
    return s['고객'] === cid && s['문자틀'] === code && (!orderNo || s['주문'] === orderNo) && (!since || toDate_(s['시각']) >= since);
  });
}
function afterArrival() {
  var today = day_(now_()), fb = Number(val_('feedback_days', 3)), every = Number(val_('loyalty_every', 3));
  rows_('주문').filter(function (o) { return o['상태'] === '도착'; }).forEach(function (o) {
    var c = one_('고객', '고객번호', o['고객']), arrived = day_(o['상태 바뀐 시각']);
    if (today >= addDays_(arrived, 1) && !sentEver_(c['고객번호'], '도착다음날', o['주문번호'])) send_('도착다음날', c, o);
    if (today >= addDays_(arrived, fb) && millKg_(items_(o)) > 0 && !sentEver_(c['고객번호'], '밥맛', o['주문번호'])) send_('밥맛', c, o);
    var n = rows_('주문').filter(function (r) { return r['고객'] === o['고객'] && LIVE.indexOf(r['상태']) >= 0 && r._row <= o._row; }).length;   // 이 주문이 몇 번째였나
    if (!c['두두 호'] && n % every === every - 1 && today >= addDays_(arrived, 1) && !sentEver_(c['고객번호'], '단골축하', o['주문번호'])) send_('단골축하', c, o, { 'n+1': n + 1 });
  });
}
function detectLate() {
  var today = day_(now_());
  rows_('주문').filter(function (o) { return ['확정', '입금'].indexOf(o['상태']) >= 0 && o['작업일'] && day_(o['작업일']) < today; })
    .forEach(function (o) {
      var c = one_('고객', '고객번호', o['고객']);
      if (sentEver_(c['고객번호'], '늦어짐', o['주문번호'])) return;
      var d = workDay_(millKg_(items_(o)), now_());
      send_('늦어짐', c, o, { '새 날짜': d ? md_(addDays_(d['날짜'], val_('ship_days', 2))) : '' });
      o['메모'] = '받을 날 위험 — 늦어짐 안내'; save_('주문', o);
    });
}
function refillAlert() {
  if (!on_('refill_alert')) return;
  var t = day_(now_()), lead = Number(val_('refill_lead_days', 5));
  rows_('고객').forEach(function (c) {
    if (!c['예상 소진일'] || c['수신 거부'] === 'Y') return;
    var due = day_(addDays_(c['예상 소진일'], -lead));
    if (t < due || sentEver_(c['고객번호'], '떨어질때', null, due)) return;
    var last = rows_('주문').filter(function (o) { return o['고객'] === c['고객번호'] && o['상태'] === '도착'; }).pop();
    send_('떨어질때', c, last || null);
  });
}
function consentCheck() {
  var t = now_();
  rows_('동의').filter(function (a) { return a['종류'] === '소식' && !a['철회 시각'] && toDate_(a['동의 시각']); }).forEach(function (a) {
    var due = new Date(toDate_(a['동의 시각'])); due.setFullYear(due.getFullYear() + 2);
    if (t < due) return;
    var c = one_('고객', '고객번호', a['고객']);
    if (c && !sentEver_(c['고객번호'], '동의확인', null, due)) send_('동의확인', c, null, { '동의한 날': ymd_(a['동의 시각']) });
  });
}

// ───────── 연락(발송) ─────────
// 실제 발송은 6단계. 지금은 연락 시트에 남기기만 한다(sms_send 끔이면 「보류」). 시간대 밖이면 「대기: 시간대」로 두었다가 다음 예약 작업 때 보낸다.
// extra.append: 같은 문자 끝에 붙일 문자틀 코드들(첫고객·확정·환불확인).
function send_(code, c, o, extra) {
  if (!c) return;
  extra = extra || {};
  var tpl = one_('문자틀', '코드', code);
  var rule = rows_('연락 규칙').filter(function (r) { return String(r['문자틀']).split(/\s*[\/·→]\s*/).indexOf(code) >= 0; })[0];
  var rec = { '시각': now_(), '고객': c['고객번호'], '주문': o ? o['주문번호'] : '', '경로': '문자', '문자틀': code,
              '종류': tpl ? tpl['종류'] : '', '결과': '' };
  var ad = tpl && tpl['종류'] === '광고';
  var gift = o && o['받는 분'];
  if (!tpl) rec['결과'] = '건너뜀: 문자틀 없음';
  else if (tpl['상태'] === '보류') rec['결과'] = '건너뜀: 문자틀 보류';
  else if (rule && rule['켬/끔'] !== '켬') rec['결과'] = '건너뜀: 규칙 끔';
  else if (ad && c['수신 거부'] === 'Y') rec['결과'] = '건너뜀: 수신 거부';
  else if (ad && gift) rec['결과'] = '건너뜀: 선물 받는 분';
  else if (ad && !adOk_(c)) rec['결과'] = '건너뜀: 광고 조건(소식 동의·시간대·월 상한)';
  else if (c['문자 판'] === '짧은 판' && tpl['짧은 판'] === '') rec['결과'] = '건너뜀: 짧은 판 없음';
  else {
    var text = compose_(tpl, c, o, extra);
    var blank = text.match(/\{[^}]+\}/g);
    var span = hours_(val_(ad ? 'ad_hours' : 'notice_hours', ad ? '9~20' : '8~21'), ad ? 9 : 8, ad ? 20 : 21);
    var h = now_().getHours();
    if (blank) rec['결과'] = '확인필요: 빈 값 ' + blank.join(' ') + ' — ' + text;
    else if (code !== '수신거부' && (h < span[0] || h >= span[1])) rec['결과'] = '대기: 시간대 — ' + text;
    else rec['결과'] = (on_('sms_send') ? '보낼 차례(6단계 연결 전)' : '보류(sms_send 끔)') + ' — ' + text;
  }
  append_('연락', rec);
}

function compose_(tpl, c, o, extra) {
  var short = c['문자 판'] === '짧은 판';
  var body = function (t) { return short && t['짧은 판'] && t['짧은 판'] !== '같음' ? t['짧은 판'] : t['문구']; };
  var parts = [body(tpl)];
  (extra.append || []).filter(String).forEach(function (code) { var t = one_('문자틀', '코드', code); if (t) parts.push(body(t)); });
  var text = fill_(parts.join(' '), c, o, extra);
  if (/^\(두두농장\)/.test(text)) return text;
  return tpl['종류'] === '광고' ? '(광고) 두두농장(모아온)\n' + text + '\n무료 수신거부: 「그만」 답장' : '[두두농장] ' + text + '\n' + TAIL;
}

function fill_(text, c, o, extra) {
  var map = { '이름': c['이름'], '○호': c['두두 호'] ? c['두두 호'] + '호' : '', '계좌': val_('account', ''), '피드백 날수': val_('feedback_days', 3),
              '밥 짓기 한 줄': '' };
  if (o) {
    var items = items_(o), rice = items.filter(function (it) { return it.grain === 'rice'; })[0];
    map['곡식'] = o['곡식']; map['금액'] = o['청구액'] === '' ? '' : Number(o['청구액']).toLocaleString('ko-KR');
    map['조합'] = rice ? (Number(rice.glutinous) ? '찹쌀 ' + rice.glutinous + '%' : '멥쌀만') : '';
    map['양'] = rice ? rice.size + 'kg' : o['양(kg)'] + 'kg';
    map['할인 줄'] = Number(o['할인액']) > 0 ? ' (' + o['할인 사유'] + ' ' + o['할인율'] + '% 할인 ' + Number(o['할인액']).toLocaleString('ko-KR') + '원 적용)' : '';
    map['기한'] = o['입금 기한'] ? md_(o['입금 기한']) : ''; map['새 기한'] = map['기한'];
    map['받을 날'] = o['받을 날'] ? md_(o['받을 날']) : '';
    map['환불일'] = md_(addDays_(now_(), 3));
    var inv = String(o['송장'] || '').split(' ');
    map['택배사'] = inv.length > 1 ? inv[0] : ''; map['송장번호'] = inv.length > 1 ? inv.slice(1).join(' ') : inv[0];
  }
  Object.keys(extra || {}).forEach(function (k) { if (k !== 'append') map[k] = extra[k]; });
  // 장바구니 주문은 품목이 여럿이라 「{곡식} {조합} {양}」 자리에 품목 전체를 한 번에 쓴다
  if (o) text = String(text || '').split('{곡식} {조합} {양}').join(o['곡식']);
  var must = ['이름', '계좌', '금액', '기한', '새 기한', '받을 날', '○호', '송장번호', '새 비율', '날짜', '동의한 날'];   // 비면 보내지 않고 확인필요
  return String(text || '').replace(/\{([^}]+)\}/g, function (m, k) {
    var v = map[k];
    return v === undefined || v === null || (v === '' && must.indexOf(k) >= 0) ? m : v;
  })
    .replace(/\s+\./g, '.').replace(/ {2,}/g, ' ').trim();
}

function adOk_(c) {
  if (!newsOn_(c['고객번호'])) return false;
  var h = now_().getHours(), span = hours_(val_('ad_hours', '9~20'), 9, 20);
  if (h < span[0] || h >= span[1]) return false;
  var monthStart = new Date(now_().getFullYear(), now_().getMonth(), 1);
  var used = rows_('연락').filter(function (s) {
    return s['고객'] === c['고객번호'] && s['종류'] === '광고' && toDate_(s['시각']) >= monthStart && String(s['결과']).indexOf('건너뜀') !== 0;
  }).length;
  return used < Number(val_('ad_monthly_max', 2));
}

// 시간대 밖이라 미뤄 둔 안내를 시간이 되면 보낸다.
function flushWaiting() {
  var h = now_().getHours(), span = hours_(val_('notice_hours', '8~21'), 8, 21);
  if (h < span[0] || h >= span[1]) return;
  rows_('연락').filter(function (s) { return String(s['결과']).indexOf('대기: 시간대 — ') === 0; }).forEach(function (s) {
    s['결과'] = (on_('sms_send') ? '보낼 차례(6단계 연결 전)' : '보류(sms_send 끔)') + ' — ' + String(s['결과']).slice('대기: 시간대 — '.length);
    save_('연락', s);
  });
}

// ───────── 홈페이지에 내보내기 ─────────
function exportSwitches() {
  var sw = {};
  SWITCHES.forEach(function (k) { sw[k] = false; });
  rows_('설정').forEach(function (r) { if (r['공개'] === 'Y' && SWITCHES.indexOf(r['이름']) >= 0) sw[r['이름']] = r['켬/끔'] === '켬'; });
  var grains = rows_('곡식').filter(function (g) { return g['공개'] === 'Y' && g['상태'] !== '숨김'; }).map(function (g) {
    var out = {};
    ['코드', '제품', '상태', '부르는 이름', '한 줄', '맛', '요리', '보관', '수확', '단위(kg)', '가격(원/kg)', '사진'].forEach(function (k) { out[k] = g[k]; });
    if (sw.live_stock) {
      var s = one_('재고', '곡식', g['코드']);
      out['남은 양(kg)'] = s ? Math.max(0, Number(s['남은 양(kg)']) - Number(s['예약된 양(kg)'] || 0)) : 0;
    }
    return out;
  });
  return { switches: sw, grains: grains, seatsLeft: seatsLeft_(), at: now_().toISOString() };
}

// 지난 주문 불러오기 — 조합·회차·동의 여부·○호만(이름·주소·주문 내역은 주지 않는다). 번호마다 한 시간에 몇 번만.
function recall(tel) {
  tel = phone_(tel);
  if (tel.length < 10) return { found: false };
  var cache = CacheService.getScriptCache(), key = 'recall_' + tel, n = Number(cache.get(key) || 0);
  if (n >= Number(val_('recall_per_hour', 5))) return { limited: true };
  cache.put(key, String(n + 1), 3600);
  var c = rows_('고객').filter(function (r) { return phone_(r['연락처']) === tel; })[0];
  if (!c) return { found: false, count: 0, consent: false, ho: null, seatsLeft: seatsLeft_() };
  var combos = {};
  rows_('취향').filter(function (k) { return k['고객'] === c['고객번호']; }).forEach(function (k) {
    combos[k['제품']] = { glutinous: k['찹쌀'] === '' ? null : Number(k['찹쌀']), size: Number(k['양(kg)']), subpack: k['소포장'] === 'Y',
                          repeat: k['주기(일)'] ? Number(k['주기(일)']) : 'once' };
  });
  return { found: true, combos: combos, count: liveCount_(c['고객번호']), consent: newsOn_(c['고객번호']), newsEver: newsEver_(c['고객번호']),
           ho: c['두두 호'] || null, seatsLeft: seatsLeft_() };
}

// ───────── 웹 입구 (배포: 웹 앱, 실행 = 나, 액세스 = 모든 사용자) ─────────
function doGet(e) {
  var q = (e && e.parameter) || {};
  var body;
  try {
    body = q.action === 'switches' ? exportSwitches() : q.action === 'recall' ? recall(q.tel) : { ok: false, error: 'unknown action' };
  } catch (err) { log_('doGet', q.action || '', '실패', String(err)); body = { ok: false }; }
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
    [checkDeadlines, processWaitlist, detectLate, afterArrival, updateStages, refillAlert, consentCheck, flushWaiting].forEach(function (fn) {
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
