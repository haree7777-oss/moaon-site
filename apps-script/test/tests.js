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
ok('시트 14장', __book.getSheets().length === 14, __book.getSheets().map(function (s) { return s.name; }).join(','));
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
ok('문자 곡식 칸에 품목 전체', /두두쌀 찹쌀 10% 10kg, 선풍 콩 5kg/.test(msgs(cust('01000000003')['고객번호'], '확정')[0]['결과']));

// 7. 재고 부족 → 대기 → 재고 넣으면 「대기확정」
var r4 = web('시험사', '01000000004', [soy(10)], []);
ok('콩 모자라 대기', r4['상태'] === '대기' && /남은 양 부족/.test(order(r4['주문번호'])['메모']));
ok('대기 문자', last('연락')['문자틀'] === '대기');
var s = stock('soy'); s['남은 양(kg)'] = 30; save_('재고', s);
tick(10); runScheduled();
ok('재고 넣고 예약 작업 → 대기확정', order(r4['주문번호'])['상태'] === '확정' && msgs(cust('01000000004')['고객번호'], '대기확정').length === 1);
ok('last_run 기록', setting_('last_run')['값'] instanceof Date);

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

// 16. 지난 주문 불러오기 — 조합만, 반복 조회 막기
var rc = recall('010-0000-0010');
ok('조합만 돌려줌(이름·주소 없음)', rc.found && rc.combos.rice.glutinous === 20 && rc.combos.rice.subpack === true && rc.consent === true && JSON.stringify(rc).indexOf('시험영') < 0, JSON.stringify(rc));
ok('없는 번호', recall('01099999999').found === false);
for (var k = 0; k < 6; k++) rc = recall('01000000010');
ok('한 시간 5번 넘으면 막음', rc.limited === true);

// 17. 웹 입구
setVal('order', '끔');
var before = rows_('주문').length;
doPost({ postData: { contents: JSON.stringify({ kind: 'order', mode: 'order', '이름': '시험구', '연락처': '01000000009', items: [rice(10, 10)] }) } });
ok('order 끔 → 주문 안 생기고 관심', rows_('주문').length === before && cust('01000000009')['단계'] === '관심');
doPost({ postData: { contents: JSON.stringify({ kind: 'bulk', '경로': '상담', '이름': '시험식당', '연락처': '01000000011', '상호': '시험식당', '지역': '정읍시',
  '유형': '식당·가게', '곡식': '쌀, 콩', '찹쌀': '10%', '양': '20~100kg', '방식': '주기적으로 2주', '시작': '바로', '포장': '큰 포대', '요청사항': '', '동의': [] }) } });
var cb = cust('01000000011');
ok('상담 → 식당·가게 고객, 단계 식당·단체', cb['유형'] === '식당·가게' && cb['단계'] === '식당·단체');
ok('상담 → 관심 한 줄·접수 메모', /식당·가게/.test(last('관심')['용도']) && last('접수')['경로'] === '상담' && /대표 직접 연락/.test(last('접수')['메모']));
ok('상담은 자동 문자 없음', msgs(cb['고객번호']).length === 0);
var g = JSON.parse(doGet({ parameter: { action: 'switches' } }).text);
ok('doGet 스위치 JSON', g.switches.order === false && g.switches.loyalty === true && g.seatsLeft === 0);
var gr = JSON.parse(doGet({ parameter: { action: 'recall', tel: '01000000011' } }).text);
ok('doGet 불러오기', gr.found === true && gr.combos && !gr['이름']);
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

ok('처리 기록에 실패 없음(일부러 낸 것 말고)', rows_('처리 기록').filter(function (x) { return x['결과'] === '실패' && x['무엇'] !== 'doPost'; }).length === 0,
   JSON.stringify(rows_('처리 기록').filter(function (x) { return x['결과'] === '실패'; })));
