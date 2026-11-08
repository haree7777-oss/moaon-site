// 가짜 고객·주문으로 처음부터 끝까지. 실제 개인정보 금지 — 이름·번호·계좌는 모두 지어낸 값.
var results = [];
function ok(name, cond, detail) { results.push({ name: name, pass: !!cond, detail: detail === undefined ? '' : String(detail) }); }
var clock = new Date(2026, 10, 10, 10, 0, 0);   // 2026-11-10 10:00
Clock.now = function () { return new Date(clock); };
function tick(min) { clock = new Date(clock.getTime() + min * 60000); }
function at(y, m, d, h) { clock = new Date(y, m - 1, d, h || 10, 0, 0); }
function setVal(key, onoff, v) { var r = setting_(key); if (onoff !== null) r['켬/끔'] = onoff; if (v !== undefined) r['값'] = v; save_('설정', r); }
function order(no) { return one_('주문', '주문번호', no); }
function stock(code) { return one_('재고', '곡식', code); }
function cust(tel) { return one_('고객', '연락처', tel); }
function last(sheet) { var r = rows_(sheet); return r[r.length - 1]; }
function msgs(cid, code) { return rows_('연락').filter(function (s) { return s['고객'] === cid && (!code || s['문자틀'] === code); }); }
function rice(gl, size, sub, repeat) { return { grain: 'rice', glutinous: gl, size: size, subpack: !!sub, repeat: repeat || 'once' }; }
function soy(size) { return { grain: 'soy', size: size, subpack: false, repeat: 'once' }; }
function web(name, tel, items, consent, mode) { tick(15); return intake({ kind: 'order', mode: mode || 'order', '경로': '홈페이지', '이름': name, '연락처': tel, '주소': '시험시 시험로 1', items: items, '동의': consent || [] }); }

// 1. 장부
setup();
ok('시트 16장', __book.getSheets().length === 16, __book.getSheets().map(function (s) { return s.name; }).join(','));
ok('기본 시트1 지움', !__book.getSheetByName('시트1'));
ok('설정·문자틀·연락 규칙 기본값', rows_('설정').length === DEFAULT_SETTINGS.length && rows_('문자틀').length === DEFAULT_TEMPLATES.length && rows_('연락 규칙').length === DEFAULT_RULES.length);
setup();
ok('setup 두 번 돌려도 그대로', rows_('설정').length === DEFAULT_SETTINGS.length);

append_('곡식', { '코드': 'rice', '제품': '두두쌀', '상태': '곧', '부르는 이름': '신동진', '단위(kg)': '10,20', '가격(원/kg)': 4000, '공개': 'Y' });
append_('곡식', { '코드': 'soy', '제품': '선풍 콩', '상태': '곧', '부르는 이름': '선풍', '단위(kg)': 5, '가격(원/kg)': 6000, '공개': 'Y' });
append_('곡식', { '코드': 'misu', '제품': '두두미숫가루', '상태': '숨김', '공개': 'Y' });
append_('재고', { '곡식': 'rice', '남은 양(kg)': 300, '예약된 양(kg)': 0, '기준일': clock });
append_('재고', { '곡식': 'soy', '남은 양(kg)': 10, '예약된 양(kg)': 0, '기준일': clock });
for (var i = 1; i <= 40; i++) append_('작업 달력', { '날짜': day_(addDays_(clock, i)), '도정 가능': i === 1 ? '불가' : '가능', '하루 최대량(kg)': 30, '배정된 양(kg)': 0 });
setVal('account', null, '시험은행 000-0000-0000');

// 2. 내보내기
var ex = exportSwitches();
ok('스위치 전부 끔', SWITCHES.every(function (k) { return ex.switches[k] === false; }));
ok('숨김 곡식 안 나감', ex.grains.length === 2);
ok('남은 ○호 자리 100', ex.seatsLeft === 100);
setVal('order', '켬'); setVal('loyalty', '켬'); setVal('refill_alert', '켬');

// 3. 예약 문의(주문 꺼짐 화면) — 관심·취향·소식 동의, 주문 없음
var r0 = web('시험영', '01000000010', [rice(20, 10, true, 28)], ['소식'], 'inquiry');
var c0 = cust('01000000010');
ok('문의 → 관심 고객, 주문 없음', r0['상태'] === '관심' && c0['단계'] === '관심' && !rows_('주문').length);
ok('문의도 조합 저장', one_('취향', '고객', c0['고객번호'])['찹쌀'] === 20);
ok('소식 동의 한 줄', rows_('동의').filter(function (a) { return a['고객'] === c0['고객번호']; }).length === 1);

// 4. 첫 주문(홈페이지) — 확정, ○호 1, 모든 주문 10%
tick(5);
var r1 = web('시험일', '01000000001', [rice(10, 10, true)], []);
var o1 = order(r1['주문번호']), c1 = cust('01000000001');
ok('확정', r1['상태'] === '확정', JSON.stringify(r1));
ok('작업일 = 첫 가능일(11-12)', ymd_(o1['작업일']) === '2026-11-12', ymd_(o1['작업일']));
ok('받을 날 = 작업일+2', ymd_(o1['받을 날']) === '2026-11-14');
ok('곡식 40,000 · 소포장 1,000', o1['곡식 금액'] === 40000 && o1['소포장'] === 1000);
ok('○호 1 → 10% 할인 4,100', c1['두두 호'] === 1 && o1['할인율'] === 10 && o1['할인액'] === 4100 && o1['청구액'] === 36900, o1['할인액'] + ' ' + o1['청구액']);
var m1 = msgs(c1['고객번호']);
ok('홈페이지 주문은 접수 문자 없이 확정 한 통', m1.length === 1 && m1[0]['문자틀'] === '확정', m1.map(function (s) { return s['문자틀']; }).join());
ok('확정 문자에 첫고객·할인 줄', /두두 1호 고객입니다/.test(m1[0]['결과']) && /두두 1호 고객 10% 할인 4,100원 적용/.test(m1[0]['결과']), m1[0]['결과']);
ok('거래 안내 머리·꼬리', /^보류\(sms_send 끔\) — \[두두농장\] /.test(m1[0]['결과']) && /두두농장 최현철 010-4689-8106$/.test(m1[0]['결과']));
ok('남은 ○호 자리 99', exportSwitches().seatsLeft === 99);
setVal('ho_seats', null, 1);   // 이후 고객은 ○호 없음 — 3번째 주문 할인 시험

// 5. 문자로 들어온 주문 — 접수 안내, 확정에 환불 확인 덧붙임, 짧은 판
var r2 = intake({ '경로': '문자', '원문': '쌀 20키로 보내주세요 시험이', '이름': '시험이', '연락처': '010-0000-0002', mode: 'order', items: [rice(0, 20, false)] });
var c2 = cust('01000000002'), m2 = msgs(c2['고객번호']);
ok('문자 경로 → 짧은 판 고객', c2['문자 판'] === '짧은 판');
ok('접수 짧은 판', m2[0]['문자틀'] === '접수' && /예약 받았습니다\. 확정되면 문자 드리겠습니다/.test(m2[0]['결과']), m2[0]['결과']);
ok('확정 + 환불 확인', m2[1]['문자틀'] === '확정' && /입금하시면 이 내용에 동의하신 것으로 봅니다/.test(m2[1]['결과']), m2[1] && m2[1]['결과']);
ok('○호 자리 다 차면 번호 없음·할인 없음', !c2['두두 호'] && order(r2['주문번호'])['할인율'] === 0);
ok('하루 최대량 안이면 같은 날(10+20=30kg)', ymd_(order(r2['주문번호'])['작업일']) === '2026-11-12', ymd_(order(r2['주문번호'])['작업일']));

// 6. 장바구니 여러 곡식 = 주문 1건, 곡식마다 재고, 도정은 쌀만
var r3 = web('시험삼', '01000000003', [rice(10, 10), soy(5)], ['소식']);
var o3 = order(r3['주문번호']);
ok('여러 곡식 한 주문', rows_('주문').filter(function (o) { return o['접수번호'] === o3['접수번호']; }).length === 1 && o3['양(kg)'] === 15);
ok('콩 재고 예약 5', stock('soy')['예약된 양(kg)'] === 5);
ok('작업 달력엔 쌀만(10kg)', rows_('작업 달력').filter(function (d) { return ymd_(d['날짜']) === ymd_(o3['작업일']); })[0]['배정된 양(kg)'] >= 10);
ok('금액 = 쌀 40,000 + 콩 30,000', o3['곡식 금액'] === 70000 && o3['청구액'] === 70000, o3['곡식 금액']);
ok('문자 곡식 칸에 품목 전체', /두두쌀 찹쌀 10% 10kg, 두두콩 5kg/.test(msgs(cust('01000000003')['고객번호'], '확정')[0]['결과']));

// 7. 재고 부족 → 대기 → 재고 넣으면 「대기확정」
var r4 = web('시험사', '01000000004', [soy(10)], []);
ok('콩 모자라 대기', r4['상태'] === '대기' && /남은 양 부족/.test(order(r4['주문번호'])['메모']));
ok('대기 문자', last('연락')['문자틀'] === '대기');
var s = stock('soy'); s['남은 양(kg)'] = 30; save_('재고', s);
onBookEdit({ range: { getSheet: function () { return { getName: function () { return '연락'; } }; } } });
ok('다른 시트를 고치면 그대로 대기', order(r4['주문번호'])['상태'] === '대기');
onBookEdit({ range: { getSheet: function () { return { getName: function () { return '재고'; } }; } } });
ok('재고 칸 고치면 바로 대기확정(10분 안 기다림)', order(r4['주문번호'])['상태'] === '확정' && msgs(cust('01000000004')['고객번호'], '대기확정').length === 1);
tick(10); runScheduled();
ok('last_run 기록', setting_('last_run')['값'] instanceof Date);
ok('대기확정 문자는 한 번만', msgs(cust('01000000004')['고객번호'], '대기확정').length === 1);

// 8. 입금 기한 — 독촉 1회 → 자동 취소·재고 복귀
at(2026, 11, 14, 11); runScheduled();
var o4 = order(r4['주문번호']);
ok('기한 지남 → 입금독촉', o4['입금 안내 횟수'] === 1 && msgs(cust('01000000004')['고객번호'], '입금독촉').length === 1);
at(2026, 11, 18, 11); runScheduled();
ok('다시 지남 → 자동 취소', order(r4['주문번호'])['상태'] === '취소' && msgs(cust('01000000004')['고객번호'], '자동취소').length === 1);
ok('콩 예약 복귀(앞 주문도 기한 지나 함께 취소)', stock('soy')['예약된 양(kg)'] === 0, stock('soy')['예약된 양(kg)']);
['01000000001', '01000000002', '01000000003'].forEach(function (t) {   // 앞 주문들도 이 사이 기한이 지나 취소됐는지 확인 후 정리
  rows_('주문').filter(function (o) { return o['고객'] === cust(t)['고객번호'] && o['상태'] === '취소'; }).forEach(function (o) { o['상태'] = '도착'; o['상태 바뀐 시각'] = clock; save_('주문', o); });
});

// 9. 3번째 주문 할인 — 소식 동의자만, 3·6·9번째
at(2026, 11, 20, 10);
var A = '01000000003';   // 시험삼: 소식 동의, 1번째 주문 끝
var a2 = web('시험삼', A, [rice(10, 10)], []);
ok('2번째는 할인 없음', order(a2['주문번호'])['할인율'] === 0);
var a3 = web('시험삼', A, [rice(10, 10)], []);
ok('3번째 10%', order(a3['주문번호'])['할인율'] === 10 && order(a3['주문번호'])['할인 사유'] === '3번째 주문', order(a3['주문번호'])['할인 사유']);
ok('할인 줄 문구', /3번째 주문 10% 할인 4,000원 적용/.test(msgs(cust(A)['고객번호'], '확정').pop()['결과']));
var B = '01000000002';   // 시험이: 소식 동의 없음
web('시험이', B, [rice(0, 10)], []); var b3 = web('시험이', B, [rice(0, 10)], []);
ok('동의 없으면 3번째도 할인 없음', order(b3['주문번호'])['할인율'] === 0 && cust(B)['단골 회차'] === 3, cust(B)['단골 회차']);
setVal('loyalty', '끔'); var a4 = web('시험삼', A, [rice(10, 10)], []); setVal('loyalty', '켬');
ok('loyalty 끄면 회차 할인 없음', order(a4['주문번호'])['할인율'] === 0);
var r5 = web('시험일', '01000000001', [rice(10, 10)], []);
ok('○호 고객은 매번 10% (회차 할인과 안 겹침)', order(r5['주문번호'])['할인율'] === 10 && /1호/.test(order(r5['주문번호'])['할인 사유']));
ok('단계 단골', cust(A)['단계'] === '단골');

// 10. 입금 → 작업 → 발송 → 도착, 그 뒤 문자들
var no = a2['주문번호'];
setStatus(no, '입금', { '입금자명': '시험삼가족' });
ok('입금자명 기억', /시험삼가족/.test(cust(A)['입금자명들']));
setStatus(no, '작업');
setStatus(no, '발송', { '택배사': '시험택배', '송장': '1234-5678' });
var sentShip = msgs(cust(A)['고객번호'], '발송').pop()['결과'];
ok('발송 문자에 택배사·송장', /시험택배 1234-5678로 보냈습니다/.test(sentShip), sentShip);
ok('찧은날 문자', /쌀을 찧었습니다\. 찹쌀 10%\./.test(msgs(cust(A)['고객번호'], '찧은날').pop()['결과']));
setStatus(no, '도착');
ok('도착 → 예상 소진일', !!cust(A)['예상 소진일']);
at(2026, 11, 21, 10); runScheduled();
ok('도착 다음 날 안내', msgs(cust(A)['고객번호'], '도착다음날').filter(function (x) { return x['주문'] === no; }).length === 1);
ok('2번째 주문 도착 뒤 단골축하(광고·동의자)', /^보류.*\(광고\) 두두농장\(모아온\)/.test((msgs(cust(A)['고객번호'], '단골축하')[0] || {})['결과'] || ''), (msgs(cust(A)['고객번호'], '단골축하')[0] || {})['결과']);
at(2026, 11, 24, 10); runScheduled();
ok('도착 3일 뒤 밥맛', msgs(cust(A)['고객번호'], '밥맛').filter(function (x) { return x['주문'] === no; }).length === 1);
runScheduled();
ok('밥맛은 한 번만', msgs(cust(A)['고객번호'], '밥맛').filter(function (x) { return x['주문'] === no; }).length === 1);

// 11. 밥맛 답
handleFeedback(no, '1');
ok('더 차지게 → 찹쌀 20% 제안', /찹쌀 20%로 바꿀까요/.test(msgs(cust(A)['고객번호'], '다음조합').pop()['결과']));
handleFeedback(no, '4');
ok('별로 → 대표 직접 전화', order(no)['상태'] === '확인필요' && /직접 전화/.test(order(no)['메모']));

// 12. 떨어질 때쯤 — 한 번만, 광고 조건
var cA = cust(A); cA['예상 소진일'] = day_(addDays_(clock, 3)); save_('고객', cA);
refillAlert(); refillAlert();
ok('떨어질 때쯤 한 번만', msgs(cA['고객번호'], '떨어질때').length === 1);
ok('떨어질 때쯤은 광고 표기', /\(광고\)/.test(msgs(cA['고객번호'], '떨어질때')[0]['결과']));

// 13. 시간대 — 밤에 생긴 안내는 기다렸다가 아침에
at(2026, 11, 24, 22);
var r6 = web('시험칠', '01000000007', [rice(10, 10)], []);
var waitMsg = msgs(cust('01000000007')['고객번호'], '확정')[0];
ok('밤 10시 확정 문자는 대기', /^대기: 시간대/.test(waitMsg['결과']), waitMsg['결과']);
at(2026, 11, 25, 9); flushWaiting();
ok('아침에 보낼 차례로', /^보류\(sms_send 끔\)/.test(msgs(cust('01000000007')['고객번호'], '확정')[0]['결과']));

// 14. 빈 값 — 계좌가 비면 보내지 않고 확인필요
setVal('account', null, '');
var r7 = web('시험팔', '01000000008', [rice(10, 10)], []);
ok('계좌 빈칸 → 확인필요', /^확인필요: 빈 값 \{계좌\}/.test(msgs(cust('01000000008')['고객번호'], '확정')[0]['결과']));
setVal('account', null, '시험은행 000-0000-0000');

// 15. 「그만」 — 동의 철회·수신 거부·결과 알림 한 번
optOut(A);
ok('수신 거부 처리', cust(A)['수신 거부'] === 'Y' && !newsOn_(cust(A)['고객번호']));
ok('수신거부 알림은 법검토 문구 그대로', /^보류.*— \(두두농장\) 11월 25일 소식 받기를 멈췄습니다\. 주문 안내 문자는 그대로 갑니다\.$/.test(msgs(cust(A)['고객번호'], '수신거부')[0]['결과']));
ok('그 뒤 광고는 건너뜀', adOk_(cust(A)) === false);
var a5 = web('시험삼', A, [rice(10, 10)], []), a6 = web('시험삼', A, [rice(10, 10)], []), a7 = web('시험삼', A, [rice(10, 10)], []);   // 앞 주문 하나는 확인필요라 회차에서 빠짐 → 4·5·6번째
ok('소식 그만둔 뒤에도 6번째 10%(센 횟수·할인 그대로)', order(a5['주문번호'])['할인율'] === 0 && order(a6['주문번호'])['할인율'] === 0 && order(a7['주문번호'])['할인율'] === 10 && order(a7['주문번호'])['할인 사유'] === '6번째 주문', order(a7['주문번호'])['할인 사유']);
ok('불러오기: 지금 동의는 꺼짐·동의한 적은 있음', recall(A).consent === false && recall(A).newsEver === true);

// 16. 지난 주문 불러오기 — 조합만, 반복 조회 막기
var rc = recall('010-0000-0010');
ok('조합만 돌려줌(이름·주소 없음)', rc.found && rc.combos.rice.glutinous === 20 && rc.combos.rice.subpack === true && rc.consent === true && JSON.stringify(rc).indexOf('시험영') < 0, JSON.stringify(rc));
ok('없는 번호', recall('01099999999').found === false);
for (var k = 0; k < 6; k++) rc = recall('01000000010');
ok('한 시간 5번 넘으면 막음', rc.limited === true);

// 17. 웹 입구
setVal('order', '끔');
var before = rows_('주문').length;
var closedRes = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'order', mode: 'order', '이름': '시험구', '연락처': '01000000009', items: [rice(10, 10)] }) } }).text);
ok('order 끔 → 주문 받지 않음(closed)', closedRes.ok === false && closedRes.closed === true && rows_('주문').length === before && !cust('01000000009'));
doPost({ postData: { contents: JSON.stringify({ kind: 'bulk', '경로': '상담', '이름': '시험식당', '연락처': '01000000011', '상호': '시험식당', '지역': '정읍시',
  '유형': '식당·가게', '곡식': '쌀, 콩', '찹쌀': '10%', '양': '20~100kg', '방식': '주기적으로 2주', '시작': '바로', '포장': '큰 포대', '요청사항': '', '동의': [] }) } });
var cb = cust('01000000011');
ok('상담 → 식당·가게 고객, 단계 식당·단체', cb['유형'] === '식당·가게' && cb['단계'] === '식당·단체');
ok('상담 → 관심 한 줄·접수 메모', /식당·가게/.test(last('관심')['용도']) && last('접수')['경로'] === '상담' && /대표 직접 연락/.test(last('접수')['메모']));
ok('상담 → 상담접수 안내 한 통만', msgs(cb['고객번호']).length === 1 && msgs(cb['고객번호'])[0]['문자틀'] === '상담접수' && /문의를 받았습니다/.test(msgs(cb['고객번호'])[0]['결과']));
var g = JSON.parse(doGet({ parameter: { action: 'switches' } }).text);
ok('doGet 스위치 JSON', g.switches.order === false && g.switches.loyalty === true && g.seatsLeft === 0);
var gr = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'recall', tel: '01000000011' }) } }).text);
ok('불러오기는 POST로(번호를 주소에 싣지 않음)', gr.found === true && gr.combos && !gr['이름']);
ok('doGet 으로는 불러오기 안 됨', JSON.parse(doGet({ parameter: { action: 'recall', tel: '01000000011' } }).text).ok === false);
doPost({ postData: { contents: '깨진 글' } });
ok('깨진 요청 → 처리 기록 실패', last('처리 기록')['결과'] === '실패');

// 18. 중복·연락처 없음
var dupP = { '경로': '문자', '원문': '콩 5키로 시험열', '이름': '시험열', '연락처': '010-0000-0012', mode: 'inquiry' };
intake(dupP); tick(3); var rd = intake(dupP);
ok('같은 번호·같은 원문 10분 안 → 중복', rd['중복'] === true && last('접수')['처리상태'] === '중복');
var rn = intake({ '경로': '전화', '원문': '번호 없이 들어온 기록방 한 줄' });
ok('연락처 없음 → 확인필요', rn.ok === false && last('접수')['처리상태'] === '확인필요');

// 19. 받을 날 위험 감지
var late = order(r7['주문번호']); late['작업일'] = day_(addDays_(clock, -1)); save_('주문', late);
detectLate(); detectLate();
ok('작업일 지나도록 작업 전 → 늦어짐 한 번', msgs(cust('01000000008')['고객번호'], '늦어짐').length === 1);

// 20. 쉬는 고객 — 안부는 동의자만, 평생 한 번
var cC = cust('01000000003'); cC['수신 거부'] = ''; save_('고객', cC);
var cZ = cust('01000000002'); cZ['예상 소진일'] = day_(addDays_(clock, -61)); cZ['마지막 주문일'] = day_(addDays_(clock, -90)); save_('고객', cZ);
updateStages();
ok('쉬는 고객으로', cust('01000000002')['단계'] === '쉬는 고객');
ok('동의 없으면 안부 광고 건너뜀', /^건너뜀: 광고 조건/.test(msgs(cZ['고객번호'], '안부')[0]['결과']));

// 21. 문자틀 — 접수·확정에 주문번호, 도정일
var cf = msgs(cust('01000000001')['고객번호'], '확정')[0]['결과'];
ok('확정 문자에 주문번호·도정일', cf.indexOf('주문(' + r1['주문번호'] + ')이 확정됐습니다') >= 0 && /11월 12일에 도정해 보내 드립니다/.test(cf), cf);
ok('접수 문자(일반 판)에 주문번호', DEFAULT_TEMPLATES[0][2].indexOf('주문번호 {주문번호}') >= 0);
ok('확정 답에 도정일', r1['도정일'] === '2026-11-12', r1['도정일']);

// 22. 도정일 — 자리 남은 가장 가까운 날, 다 차면 다음 날
at(2026, 12, 1, 10);
var md = exportSwitches().millDate;
ok('내보내기 도정일 = 내일부터 자리 남은 첫날', md === '2026-12-02', md);
var full = rows_('작업 달력').filter(function (d) { return ymd_(d['날짜']) === '2026-12-02'; })[0]; full['배정된 양(kg)'] = 25; save_('작업 달력', full);
ok('자리가 10kg 안 남으면 다음 날', exportSwitches().millDate === '2026-12-03', exportSwitches().millDate);

// 23. 내 주문 — 번호+주문번호 조회, 받는 분 가림, 틀림 막기
setVal('order', '켬');
var T = '01000000020';
var mo = web('시험이십', T, [rice(20, 10, true, 14)], []);
var v = lookup('010-0000-0020', mo['주문번호']);
ok('조회: 진행 단계 확정', v.found && v.step === 1 && v.steps.join() === '접수,확정,입금 확인,도정,발송', JSON.stringify(v).slice(0, 200));
ok('조회: 받는 분은 첫 글자·시·군까지', v.to.name.charAt(0) === '시' && v.to.name.indexOf('험') < 0 && v.to.region === '시험시', JSON.stringify(v.to));
ok('조회: 정기·다음 예약 도정일', v.regular === true && /^2026-12-\d\d$/.test(v.nextDate), v.nextDate);
ok('조회: 주소·연락처·이름 원문 없음', JSON.stringify(v).indexOf('시험로') < 0 && JSON.stringify(v).indexOf(T) < 0 && JSON.stringify(v).indexOf('시험이십') < 0);
ok('다른 번호로는 안 보임', lookup('01000000001', mo['주문번호']).found === false);
for (var q = 0; q < 6; q++) lookup('01000000021', 'D000000-000');
ok('여러 번 틀리면 막음', lookup('01000000021', 'D000000-000').limited === true);
var mo2 = web('시험이십', T, [soy(5)], []);
ok('같은 번호 다른 주문 목록', lookup(T, mo2['주문번호']).others.some(function (x) { return x.no === mo['주문번호']; }));

// 24. 정기 멈추기
var pz = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'pause', tel: T, no: mo['주문번호'] }) } }).text);
ok('정기 멈춤 → 장부 정기 칸 멈춤', pz.ok && order(mo['주문번호'])['정기'] === '멈춤' && pz.view.paused === true);

// 25. 도정 전 취소 — 재고·작업 달력 복귀, 취소확인(입금 전이면 환불 문장 없음)
var soyBefore = stock('soy')['예약된 양(kg)'];
var cx = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'cancel', tel: T, no: mo2['주문번호'] }) } }).text);
ok('취소 → 상태 취소·콩 예약 복귀', cx.ok && order(mo2['주문번호'])['상태'] === '취소' && stock('soy')['예약된 양(kg)'] === soyBefore - 5, stock('soy')['예약된 양(kg)']);
var cm = msgs(cust(T)['고객번호'], '취소확인').pop()['결과'];
ok('입금 전 취소확인 — 환불 문장 뺌', /두두콩 5kg 예약을 취소했습니다\./.test(cm) && cm.indexOf('환불') < 0, cm);
setStatus(mo['주문번호'], '입금');
var cx2 = cancelMine(T, mo['주문번호']);
ok('입금 뒤 취소확인 — 전액 환불 문장', cx2.ok && /전액 환불해 드립니다/.test(msgs(cust(T)['고객번호'], '취소확인').pop()['결과']));
var mo3 = web('시험이십', T, [rice(0, 10)], []); setStatus(mo3['주문번호'], '작업');
var cx3 = cancelMine(T, mo3['주문번호']);
ok('도정 뒤엔 취소 안 됨', cx3.ok === false && order(mo3['주문번호'])['상태'] === '작업' && cx3.view.canCancel === false);

// 26. 정기 — 다음 도정일 3일 전에 같은 조합으로 다시 예약
var rg = web('시험이십', T, [rice(10, 10, false, 14), soy(5)], []);
setStatus(rg['주문번호'], '입금'); setStatus(rg['주문번호'], '작업');
var wd = order(rg['주문번호'])['작업일'];
clock = new Date(addDays_(wd, 10)); clock.setHours(10); scheduleRegular();
ok('아직 이르면 안 만듦', order(rg['주문번호'])['정기'] === 'Y');
clock = new Date(addDays_(wd, 11)); clock.setHours(10); scheduleRegular();
var child = last('주문');
ok('정기 → 쌀만 다음 예약·확정, 앞 주문은 이어짐', order(rg['주문번호'])['정기'] === '이어짐' && child['정기'] === 'Y' && child['곡식'] === '두두쌀 찹쌀 10% 10kg' && child['상태'] === '확정', child['곡식'] + ' ' + child['상태']);
scheduleRegular();
ok('다음 예약은 한 번만', rows_('접수').filter(function (r) { return r['원문'] === '정기 — ' + rg['주문번호'] + ' 다음 예약'; }).length === 1);

// 27. 시범 운행 — 시험 표시 주문만 지움, 재고 되돌림
setVal('order', '끔');
var riceRes = stock('rice')['예약된 양(kg)'], ordersBefore = rows_('주문').length, custBefore = rows_('고객').length;
var tp = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'order', mode: 'order', test: true, '경로': '홈페이지', '이름': '시험주문', '연락처': '01000000099', '주소': '시험시 시험로 9', items: [rice(10, 20)], '동의': ['소식', '환불확인'] }) } }).text);
ok('주문 꺼져도 시험 주문은 받음·시험 표시', tp.ok && tp['상태'] === '확정' && order(tp['주문번호'])['시험'] === 'Y' && cust('01000000099')['시험'] === 'Y');
ok('시험 주문도 재고 예약', stock('rice')['예약된 양(kg)'] === riceRes + 20);
var gone = purgeTest();
ok('purgeTest → 시험 줄만 지움', gone > 0 && rows_('주문').length === ordersBefore && rows_('고객').length === custBefore && !cust('01000000099') && !one_('주문', '주문번호', tp['주문번호']), gone);
ok('purgeTest → 재고·작업 달력 되돌림', stock('rice')['예약된 양(kg)'] === riceRes, stock('rice')['예약된 양(kg)']);
ok('purgeTest → 그 고객 연락·동의 없음', !rows_('연락').some(function (s) { return s['주문'] === tp['주문번호']; }) && !rows_('동의').some(function (a) { return a['경로'] === '홈페이지' && a['고객'] === tp['고객번호']; }));

// 28. 머리줄 — 끝에 새 칸이 생긴 옛 장부도 setup 이 칸만 채움
var oldHead = SCHEMA['주문'].slice(0, -9), sh = __book.getSheetByName('주문');
sh.data[0] = oldHead.slice(); setup();
ok('옛 머리줄 → 정기·시험·결제 칸 채움', sh.data[0].slice(-9).join() === '정기,시험,결제수단,결제 키,결제 상태,결제 시각,취소 금액,결제 비밀,가상계좌', sh.data[0].slice(-9).join());
ok('설정 설명 — 할인 기준 구매금액(배송비 제외)', /구매금액\(주문 상품 금액, 배송비 제외\)/.test(setting_('loyalty_rate')['설명']));

// 29. 결제 — 남은 양 확인 두 번, 자리 잡기, 수량, 금액은 규칙 일꾼이 정함
function post(o) { return JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).text); }
at(2026, 12, 7, 10); setVal('order', '끔'); setVal('pay_pg', '끔');
for (var cd = 0; cd < 60; cd++) append_('작업 달력', { '날짜': day_(addDays_(new Date(2026, 11, 21), cd)), '도정 가능': '가능', '하루 최대량(kg)': 30, '배정된 양(kg)': 0 });
var buyer = { '이름': '시험결제', '연락처': '01000000030', '주소': '시험시 시험로 30', '동의': ['환불확인'] };
function co(items, extra) { tick(5); return post(Object.assign({ kind: 'checkout', test: true, items: items }, buyer, extra || {})); }
ok('주문서 진입 남은 양 확인', post({ kind: 'stock', items: [rice(10, 10)] }).ok === true && post({ kind: 'stock', items: [soy(500)] }).short === true);
ok('판매 시작 전 · 시험 아님 → 결제 안 받음', post(Object.assign({ kind: 'checkout', items: [rice(10, 10)] }, buyer)).closed === true);
__props.TEST_MODE = ''; ok('TEST_MODE 꺼지면 test 표시도 무시', post(Object.assign({ kind: 'checkout', test: true, items: [rice(10, 10)] }, buyer)).closed === true); __props.TEST_MODE = 'on';
var riceRes0 = stock('rice')['예약된 양(kg)'];
var k1 = co([Object.assign(rice(10, 10, true), { qty: 2 })]);
var ko1 = order(k1['주문번호']);
ok('체크아웃 → 결제대기·자리 잡음(10kg × 2)', k1.ok && ko1['상태'] === '결제대기' && stock('rice')['예약된 양(kg)'] === riceRes0 + 20, JSON.stringify(k1));
ok('수량 금액: 40,000×2 + 소포장 1,000×2', ko1['곡식 금액'] === 80000 && ko1['소포장'] === 2000 && k1['청구액'] === Number(ko1['청구액']), ko1['곡식 금액'] + '/' + ko1['소포장']);
ok('남은 양이 모자라면 결제 전에 막음', co([soy(500)]).short === true);
ok('금액이 다르면 승인 안 함·자리 풀기', post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_1', orderId: k1['주문번호'], amount: 1 }).code === 'AMOUNT' && order(k1['주문번호'])['상태'] === '취소' && stock('rice')['예약된 양(kg)'] === riceRes0);

// 30. 카드 결제 → 입금(확정+입금 한 번에), 입금확인 문자
var k2 = co([rice(10, 10)]);
var p2 = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_2', orderId: k2['주문번호'], amount: k2['청구액'] });
var o2 = order(k2['주문번호']);
ok('카드 승인 → 상태 입금·결제 완료', p2.ok && o2['상태'] === '입금' && o2['결제 상태'] === '완료' && o2['결제수단'] === '카드', JSON.stringify(p2));
ok('카드 → 결제확인 문자(도정일)', /결제를 확인했습니다\. \d+월 \d+일에 도정해/.test(msgs(cust('01000000030')['고객번호'], '결제확인').pop()['결과']));
ok('카드 결제엔 「입금」 문자 안 감', msgs(cust('01000000030')['고객번호'], '입금확인').length === 0);
ok('새로 고침해도 한 번만 승인', post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_2', orderId: k2['주문번호'], amount: k2['청구액'] }).ok && msgs(cust('01000000030')['고객번호'], '결제확인').length === 1);
var kf = co([rice(0, 10)]);
var pf = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_FAIL_x', orderId: kf['주문번호'], amount: kf['청구액'] });
ok('승인 실패 → 자리 풀고 취소', pf.ok === false && order(kf['주문번호'])['상태'] === '취소');
var kb = co([rice(0, 10)]);
ok('결제창에서 취소로 돌아옴 → pay-abort 로 자리 풀기', post({ kind: 'pay-abort', orderId: kb['주문번호'], tel: '01000000030', code: 'PAY_PROCESS_CANCELED' }).ok && order(kb['주문번호'])['상태'] === '취소');

// 31. 가상계좌 — 확정 + 계좌 안내 → 웹훅 입금 → 입금 / 기한 지나면 자동 취소
var k3 = co([soy(5)]);
var p3 = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_3', orderId: k3['주문번호'], amount: k3['청구액'] });
var o3v = order(k3['주문번호']);
ok('가상계좌 → 확정·입금 대기·계좌 돌려줌', p3.ok && o3v['상태'] === '확정' && o3v['결제 상태'] === '입금 대기' && p3['가상계좌'] && p3['가상계좌']['은행'] === '농협은행', JSON.stringify(p3['가상계좌']));
ok('확정 문자에 가상계좌 번호', msgs(cust('01000000030')['고객번호'], '확정').pop()['결과'].indexOf('농협은행 ' + JSON.parse(o3v['가상계좌']).account) >= 0);
ok('웹훅 secret 다르면 거절', post({ createdAt: 'x', secret: 'wrong', status: 'DONE', orderId: k3['주문번호'] }).ok === false && order(k3['주문번호'])['상태'] === '확정');
ok('웹훅 입금 → 입금·결제 완료', post({ createdAt: 'x', secret: o3v['결제 비밀'], status: 'DONE', transactionKey: 't', orderId: k3['주문번호'] }).ok && order(k3['주문번호'])['상태'] === '입금' && order(k3['주문번호'])['결제 상태'] === '완료');
var k4 = co([soy(5)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_4', orderId: k4['주문번호'], amount: k4['청구액'] });
var soyRes = stock('soy')['예약된 양(kg)'];
at(2026, 12, 11, 10); checkDeadlines();
ok('가상계좌 기한 지나면 바로 자동 취소·재고 복귀', order(k4['주문번호'])['상태'] === '취소' && stock('soy')['예약된 양(kg)'] === soyRes - 5 && msgs(cust('01000000030')['고객번호'], '자동취소').length >= 1);
var k5 = co([rice(10, 10)]); clock = new Date(clock.getTime() + 31 * 60000); checkDeadlines();
ok('결제창에서 안 돌아오면 30분 뒤 자리 풀기(문자 없음)', order(k5['주문번호'])['상태'] === '취소' && order(k5['주문번호'])['결제 상태'] === '안 함');

// 32. 결제 취소 — 도정 전 카드 = 자동 결제 취소 / 휴대폰 달 넘김 = 확인필요
var k6 = co([rice(10, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_6', orderId: k6['주문번호'], amount: k6['청구액'] });
var c6 = post({ kind: 'cancel', tel: '01000000030', no: k6['주문번호'] });
ok('카드 결제 도정 전 취소 → 결제 취소·취소 금액', c6.ok && order(k6['주문번호'])['결제 상태'] === '취소' && order(k6['주문번호'])['취소 금액'] === order(k6['주문번호'])['청구액']);
ok('카드 취소 → 결제취소 문자(영업일 3~7일)', /결제도 취소했습니다. .*영업일 3~7일/.test(msgs(cust('01000000030')['고객번호'], '결제취소').pop()['결과']));
at(2026, 12, 30, 10); var k7 = co([rice(10, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_PHONE_7', orderId: k7['주문번호'], amount: k7['청구액'] });
at(2027, 1, 2, 10); var c7 = post({ kind: 'cancel', tel: '01000000030', no: k7['주문번호'] });
ok('휴대폰 결제 달 넘긴 취소 → 확인필요(대표 직접 환불)', c7.ok === false && c7.reason === '확인필요' && order(k7['주문번호'])['상태'] === '확인필요' && c7.view.cancelAsked === true);
ok('확인필요 취소 → 취소접수 문자', /취소 요청을 받았습니다/.test((msgs(cust('01000000030')['고객번호'], '취소접수').pop() || {})['결과']));
var k8 = co([soy(5)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_8', orderId: k8['주문번호'], amount: k8['청구액'] });
var c8 = post({ kind: 'cancel', tel: '01000000030', no: k8['주문번호'] }); var m8 = msgs(cust('01000000030')['고객번호'], '취소확인').pop()['결과'];
ok('가상계좌 입금 전 취소 → 취소확인(환불 문장 없음)', c8.ok && m8.indexOf('환불') < 0 && msgs(cust('01000000030')['고객번호'], '결제취소').length === 1, m8);
var k9 = co([soy(5)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_9', orderId: k9['주문번호'], amount: k9['청구액'] });
var m9 = msgs(cust('01000000030')['고객번호'], '결제확인').pop()['결과'];
ok('콩만 카드 결제 → 결제확인 문자 보냄(빈 칸 없음)', /^보류/.test(m9), m9);

// 33. 회원 — 인증(시험 모드 번호 보여 줌)·가입·로그인·잠금·마이페이지·회원 주문·비밀번호 찾기·탈퇴
setVal('member', '끔');
ok('member 끔·시험 아님 → 가입 막음', post({ kind: 'code', tel: '01000000040', purpose: 'join' }).closed === true);
var sc = post({ kind: 'code', test: true, tel: '010-0000-0040', purpose: 'join' });
ok('인증번호 — 시험 모드에서만 번호를 돌려줌', sc.ok && /^\d{6}$/.test(sc.devCode) && rows_('인증').pop()['인증번호'] !== sc.devCode);
ok('틀린 인증번호', post({ kind: 'verify', test: true, tel: '01000000040', purpose: 'join', code: '000000' }).wrong === true);
var vf = post({ kind: 'verify', test: true, tel: '01000000040', purpose: 'join', code: sc.devCode });
ok('인증 확인 → 표', vf.ok && vf.verifyToken);
ok('비밀번호 규칙(8자·영문·숫자)', post({ kind: 'join', test: true, tel: '01000000040', verifyToken: vf.verifyToken, password: 'short', '이름': '시험회원', '주소': '시험시 1' }).password === true);
var jn = post({ kind: 'join', test: true, tel: '01000000040', verifyToken: vf.verifyToken, password: 'abcd1234', '이름': '시험회원', '주소': '시험시 시험로 40', '상세 주소': '101호', '우편번호': '00000', news: true });
var cm4 = cust('01000000040');
ok('가입 → 회원·토큰, 비밀번호 원문 없음', jn.ok && jn.token && cm4['회원'] === 'Y' && cm4['비밀번호'] !== 'abcd1234' && cm4['비밀번호'].length === 64 && JSON.stringify(rows_('고객')).indexOf('abcd1234') < 0);
ok('가입 동의 넷(이용약관·개인정보·만14세·소식)', rows_('동의').filter(function (a) { return a['고객'] === cm4['고객번호']; }).map(function (a) { return a['종류']; }).join() === '이용약관,개인정보,만14세,소식');
ok('인증 표는 한 번만', post({ kind: 'join', test: true, tel: '01000000040', verifyToken: vf.verifyToken, password: 'abcd1234', '이름': 'x', '주소': 'x' }).ok === false);
ok('이미 가입한 번호로 인증 요청', post({ kind: 'code', test: true, tel: '01000000040', purpose: 'join' }).exists === true);
for (var lf = 0; lf < 5; lf++) post({ kind: 'login', test: true, tel: '01000000040', password: 'wrong999' });
ok('5번 틀리면 잠금', post({ kind: 'login', test: true, tel: '01000000040', password: 'abcd1234' }).locked === true);
__cache['lock_01000000040'] = '0';
var lg = post({ kind: 'login', test: true, tel: '01000000040', password: 'abcd1234', keep: true });
ok('로그인 → 토큰·내 정보(주소)', lg.ok && lg.token && lg.me['주소'] === '시험시 시험로 40' && lg.me['상세주소'] === '101호');
var mk = post(Object.assign({ kind: 'checkout', test: true, token: lg.token, items: [rice(10, 10, false, 14)], '받는 분': null, '주소': '시험시 시험로 40 101호', '동의': ['환불확인'] }));
post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_EASY_m', orderId: mk['주문번호'], amount: mk['청구액'] });
var me = post({ kind: 'member', test: true, token: lg.token, action: 'me' });
ok('회원 주문 → 마이페이지 주문내역·○호 없음(자리 다 참)·회차', me.ok && me.me['주문'][0].no === mk['주문번호'] && me.me['횟수'] === 1 && me.me['주문'][0].pay === '간편결제', JSON.stringify(me.me).slice(0, 160));
ok('마이페이지 정기 주기 바꾸기', post({ kind: 'member', test: true, token: lg.token, action: 'cycle', no: mk['주문번호'], days: 28 }).ok && items_(order(mk['주문번호']))[0].repeat === 28);
ok('마이페이지 정기 멈춤', post({ kind: 'member', test: true, token: lg.token, action: 'pause', no: mk['주문번호'] }).ok && order(mk['주문번호'])['정기'] === '멈춤');
var mc = post({ kind: 'member', test: true, token: lg.token, action: 'cancel', no: mk['주문번호'] });
ok('마이페이지 취소 → 결제 취소까지', mc.ok && order(mk['주문번호'])['상태'] === '취소' && order(mk['주문번호'])['결제 상태'] === '취소');
ok('남의 주문은 못 건드림', post({ kind: 'member', test: true, token: lg.token, action: 'cancel', no: k2['주문번호'] }).auth === true);
ok('지난번과 같게(로그인)', post({ kind: 'member', test: true, token: lg.token, action: 'recall' }).combos.rice.glutinous === 10);
ok('회원정보 수정 — 주소', post({ kind: 'member', test: true, token: lg.token, action: 'update', '이름': '시험회원', '주소': '새 주소 1', '상세 주소': '', '우편번호': '' }).me['주소'] === '새 주소 1');
var rs = post({ kind: 'code', test: true, tel: '01000000040', purpose: 'reset' });
var rv = post({ kind: 'verify', test: true, tel: '01000000040', purpose: 'reset', code: rs.devCode });
ok('비밀번호 찾기 → 새 비밀번호, 옛 로그인 끊김', post({ kind: 'reset', test: true, tel: '01000000040', verifyToken: rv.verifyToken, password: 'newpass77' }).ok && post({ kind: 'member', test: true, token: lg.token, action: 'me' }).auth === true);
var lg2 = post({ kind: 'login', test: true, tel: '01000000040', password: 'newpass77' });
ok('새 비밀번호로 로그인', lg2.ok);
ok('로그아웃 → 표 무효', post({ kind: 'member', test: true, token: lg2.token, action: 'logout' }).ok && post({ kind: 'member', test: true, token: lg2.token, action: 'me' }).auth === true);
var lg3 = post({ kind: 'login', test: true, tel: '01000000040', password: 'newpass77' });
ok('탈퇴 → 회원 정보·주소 지움, 주문 기록은 남음', post({ kind: 'member', test: true, token: lg3.token, action: 'leave' }).ok && cust('01000000040')['회원'] === '' && cust('01000000040')['주소'] === '' && !!order(mk['주문번호']));
ok('비회원 주문했던 번호로 가입하면 그 고객 행에 이어짐', (function () { var s2 = post({ kind: 'code', test: true, tel: '01000000030', purpose: 'join' }); var v2 = post({ kind: 'verify', test: true, tel: '01000000030', purpose: 'join', code: s2.devCode }); var j2 = post({ kind: 'join', test: true, tel: '01000000030', verifyToken: v2.verifyToken, password: 'pass1234', '이름': '시험결제', '주소': '시험시' }); return j2.ok && j2.me['주문'].length >= 3 && rows_('고객').filter(function (c) { return phone_(c['연락처']) === '01000000030'; }).length === 1; })());

// 34. 주문번호 — 짧은 숫자, 토스에는 doodoo- 를 붙여 보내고 돌아오면 떼어 낸다
var nos = rows_('주문').map(function (o) { return Number(o['주문번호']); });
ok('주문번호는 1001부터 차례로(숫자만)', nos[0] === 1001 && nos.every(function (n, i) { return n === 1001 + i; }), nos.slice(0, 5).join());
var kz = co([rice(10, 10)]);
ok('토스 주문번호 doodoo-<번호>', kz.tossOrderId === 'doodoo-' + kz['주문번호']);
ok('토스 번호로 돌아와도 승인', post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_z', orderId: kz.tossOrderId, amount: kz['청구액'] }).ok && order(kz['주문번호'])['상태'] === '입금');

ok('처리 기록에 실패 없음(일부러 낸 것 말고)', rows_('처리 기록').filter(function (x) { return x['결과'] === '실패' && x['무엇'] !== 'doPost'; }).length === 0,
   JSON.stringify(rows_('처리 기록').filter(function (x) { return x['결과'] === '실패'; })));
