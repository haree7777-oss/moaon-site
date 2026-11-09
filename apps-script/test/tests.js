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
ok('문자 주문 접수 안내는 안 감(규칙 끔 — 기록도 안 남김)', m2.filter(function (s) { return s['문자틀'] === '접수'; }).length === 0, JSON.stringify(m2.map(function (s) { return s['문자틀']; })));
ok('확정 한 통 + 쌀 환불 확인', m2[0]['문자틀'] === '확정' && /도정 후에는 단순 변심 반품이 어렵습니다/.test(m2[0]['결과']) && m2.length === 1, m2[0] && m2[0]['결과']);
ok('확정 = 「주문 접수 · 입금 안내」 틀(계좌·기한·도정일)', /\[두두농장\] 주문 접수 · 입금 안내\n\n안녕하세요, 시험이님\.\n주문이 접수되었습니다\. 아래 계좌로 입금해 주세요\./.test(m2[0]['결과']) && /■ 입금계좌 : 시험은행 000-0000-0000/.test(m2[0]['결과']) && /■ 도정일 : 11월 12일/.test(m2[0]['결과']) && !/입금자명|1시간/.test(m2[0]['결과']), m2[0]['결과']);
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

// 7. 재고 부족 → 대기 → 재고 넣으면 「대기확정」 (대기 줄은 2026-11-08 끔 — 스위치 waitlist·규칙 「대기」를 켰을 때)
setVal('waitlist', '켬'); var wr = one_('연락 규칙', '규칙', '대기'); wr['켬/끔'] = '켬'; save_('연락 규칙', wr);
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
setVal('waitlist', '끔'); wr['켬/끔'] = '끔'; save_('연락 규칙', wr);

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
ok('발송 문자에 택배사·송장', /■ 운송장정보 : 시험택배 \/ 1234-5678\n■ 도착예정 : \d+월 \d+일/.test(sentShip), sentShip);
ok('작업 완료엔 문자 없음(찧은날 없앰 — 문자틀·규칙·기록 모두 없음)', msgs(cust(A)['고객번호'], '찧은날').length === 0 && !one_('문자틀', '코드', '찧은날') && !one_('연락 규칙', '규칙', '작업 완료'));
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

// 13. 시간대 — 고객이 방금 한 일의 결과(확정·입금확인 등)는 밤에도 바로, 그 밖의 안내(발송 등)는 기다렸다가 아침에
at(2026, 11, 24, 22);
var r6 = web('시험칠', '01000000007', [rice(10, 10)], []);
ok('밤 10시 확정 문자는 바로(연락 규칙 「바로」)', /^보류\(sms_send 끔\)/.test(msgs(cust('01000000007')['고객번호'], '확정')[0]['결과']));
setStatus(r6['주문번호'], '입금');
ok('밤 10시 입금확인도 바로', /^보류\(sms_send 끔\)/.test(msgs(cust('01000000007')['고객번호'], '입금확인')[0]['결과']));
setStatus(r6['주문번호'], '작업'); setStatus(r6['주문번호'], '발송', { '택배사': '시험택배', '송장': '777' });
var waitMsg = msgs(cust('01000000007')['고객번호'], '발송')[0];
ok('밤 10시 발송 문자는 대기(낮 시간대)', /^대기: 시간대/.test(waitMsg['결과']), waitMsg['결과']);
at(2026, 11, 25, 9); flushWaiting();
ok('아침에 보낼 차례로', /^보류\(sms_send 끔\)/.test(msgs(cust('01000000007')['고객번호'], '발송')[0]['결과']));

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
ok('상담 → 상담접수 안내 한 통만', msgs(cb['고객번호']).length === 1 && msgs(cb['고객번호'])[0]['문자틀'] === '상담접수' && /문의가 접수되었습니다/.test(msgs(cb['고객번호'])[0]['결과']));
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
ok('확정 문자에 주문번호·도정일', cf.indexOf('■ 주문번호 : ' + r1['주문번호']) >= 0 && /■ 도정일 : 11월 12일/.test(cf), cf);
ok('짧은 판은 밥맛·다음조합만, 나머지 같음', DEFAULT_TEMPLATES.every(function (t) { return ['밥맛', '다음조합'].indexOf(t[0]) >= 0 ? t[3] !== '같음' : t[3] === '같음'; }));
ok('틀 모양: 제목 → 인사 → ■ 항목 → 감사', /^결제 완료 안내\n\n안녕하세요, \{이름\}님\.\n.+\n\n■ 주문번호 : \{주문번호\}\n[\s\S]*이용해 주셔서 감사합니다\.$/.test(one_('문자틀', '코드', '결제완료')['문구']));
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
ok('입금 전 취소확인 — 환불 줄 뺌', /요청하신 주문이 취소되었습니다\.\n\n■ 주문번호 : \d+\n\n두두농장/.test(cm) && cm.indexOf('환불') < 0, cm);
setStatus(mo['주문번호'], '입금');
var cx2 = cancelMine(T, mo['주문번호']);
ok('입금 뒤(통장) 취소 → 확인필요, 환불 끝 뒤 취소확인 — 환불금액·환불예정일', cx2.reason === '확인필요' && adminAct(mo['주문번호'], '환불끝').ok && /■ 환불금액 : [\d,]+원\n■ 환불예정일 : \d+월 \d+일 환불 완료/.test(msgs(cust(T)['고객번호'], '취소확인').pop()['결과']));
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
var oldHead = SCHEMA['주문'].slice(0, -10), sh = __book.getSheetByName('주문');
sh.data[0] = oldHead.slice(); setup();
ok('옛 머리줄 → 정기·시험·결제·경로 칸 채움', sh.data[0].slice(-10).join() === '정기,시험,결제수단,결제 키,결제 상태,결제 시각,취소 금액,결제 비밀,가상계좌,경로', sh.data[0].slice(-10).join());
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

// 30. 카드 결제 → 입금(확정+입금 한 번에), 「결제완료」 한 통
var k2 = co([rice(10, 10)]);
var p2 = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_2', orderId: k2['주문번호'], amount: k2['청구액'] });
var o2 = order(k2['주문번호']);
ok('카드 승인 → 상태 입금·결제 완료', p2.ok && o2['상태'] === '입금' && o2['결제 상태'] === '완료' && o2['결제수단'] === '카드', JSON.stringify(p2));
var pm2 = msgs(cust('01000000030')['고객번호'], '결제완료').pop()['결과'];
ok('카드 → 결제완료 문자(결제금액·도정일)', /\[두두농장\] 결제 완료 안내/.test(pm2) && /■ 결제금액 : [\d,]+원/.test(pm2) && /■ 도정일 : \d+월 \d+일/.test(pm2) && /상품이 발송되면 다시 안내드리겠습니다/.test(pm2), pm2);
ok('카드 결제엔 「입금」 문자 안 감', msgs(cust('01000000030')['고객번호'], '입금확인').length === 0);
ok('새로 고침해도 한 번만 승인', post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_2', orderId: k2['주문번호'], amount: k2['청구액'] }).ok && msgs(cust('01000000030')['고객번호'], '결제완료').length === 1);
var kf = co([rice(0, 10)]);
var pf = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_FAIL_x', orderId: kf['주문번호'], amount: kf['청구액'] });
ok('승인 실패 → 자리 풀고 취소', pf.ok === false && order(kf['주문번호'])['상태'] === '취소');
var kb = co([rice(0, 10)]);
ok('결제창에서 취소로 돌아옴 → pay-abort 로 자리 풀기', post({ kind: 'pay-abort', orderId: kb['주문번호'], tel: '01000000030', code: 'PAY_PROCESS_CANCELED' }).ok && order(kb['주문번호'])['상태'] === '취소');
at(2026, 12, 7, 23); var kn = co([rice(0, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_n', orderId: kn['주문번호'], amount: kn['청구액'] });
ok('밤 11시 결제도 결제완료는 바로(시간대 「바로」)', /^보류/.test(msgs(cust('01000000030')['고객번호'], '결제완료').pop()['결과']));
at(2026, 12, 7, 10);

// 31. 가상계좌 — 「입금안내」(주문마다 계좌) → 웹훅 입금 → 「입금확인」 / 기한 지나면 자동 취소
var k3 = co([soy(5)]);
var p3 = post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_3', orderId: k3['주문번호'], amount: k3['청구액'] });
var o3v = order(k3['주문번호']);
ok('가상계좌 → 확정·입금 대기·계좌 돌려줌', p3.ok && o3v['상태'] === '확정' && o3v['결제 상태'] === '입금 대기' && p3['가상계좌'] && p3['가상계좌']['은행'] === '농협은행', JSON.stringify(p3['가상계좌']));
var va3 = msgs(cust('01000000030')['고객번호'], '입금안내').pop()['결과'];
ok('입금안내 문자에 가상계좌·기한, 콩만이라 도정일 줄 없음', va3.indexOf('■ 입금계좌 : 농협은행 ' + JSON.parse(o3v['가상계좌']).account) >= 0 && /■ 입금기한 : \d+월 \d+일/.test(va3) && va3.indexOf('도정일') < 0 && msgs(cust('01000000030')['고객번호'], '확정').length === 0, va3);
ok('웹훅 secret 다르면 거절', post({ createdAt: 'x', secret: 'wrong', status: 'DONE', orderId: k3['주문번호'] }).ok === false && order(k3['주문번호'])['상태'] === '확정');
ok('웹훅 입금 → 입금·결제 완료', post({ createdAt: 'x', secret: o3v['결제 비밀'], status: 'DONE', transactionKey: 't', orderId: k3['주문번호'] }).ok && order(k3['주문번호'])['상태'] === '입금' && order(k3['주문번호'])['결제 상태'] === '완료');
var ic3 = msgs(cust('01000000030')['고객번호'], '입금확인').pop()['결과'];
ok('가상계좌 입금 → 입금확인(콩만 — 도정일 줄 없음)', /입금이 확인되었습니다/.test(ic3) && ic3.indexOf('도정일') < 0, ic3);
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
ok('카드 취소 → 취소확인(환불예정일 = 결제하신 곳에 따라 영업일 3~7일)', /■ 환불예정일 : 결제하신 곳에 따라 영업일 3~7일/.test(msgs(cust('01000000030')['고객번호'], '취소확인').pop()['결과']));
at(2026, 12, 30, 10); var k7 = co([rice(10, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_PHONE_7', orderId: k7['주문번호'], amount: k7['청구액'] });
at(2027, 1, 2, 10); var c7 = post({ kind: 'cancel', tel: '01000000030', no: k7['주문번호'] });
ok('휴대폰 결제 달 넘긴 취소 → 확인필요(대표 직접 환불)', c7.ok === false && c7.reason === '확인필요' && order(k7['주문번호'])['상태'] === '확인필요' && c7.view.cancelAsked === true);
var k8 = co([soy(5)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_8', orderId: k8['주문번호'], amount: k8['청구액'] });
var c8 = post({ kind: 'cancel', tel: '01000000030', no: k8['주문번호'] }); var m8 = msgs(cust('01000000030')['고객번호'], '취소확인').pop()['결과'];
ok('가상계좌 입금 전 취소 → 취소확인(환불 줄 없음)', c8.ok && m8.indexOf('환불') < 0, m8);
var k9 = co([soy(5)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_9', orderId: k9['주문번호'], amount: k9['청구액'] });
var m9 = msgs(cust('01000000030')['고객번호'], '결제완료').pop()['결과'];
ok('콩만 카드 결제 → 결제완료(도정일 줄 빠짐)', /^보류/.test(m9) && m9.indexOf('도정일') < 0 && /상품이 발송되면/.test(m9), m9);

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

// 35. 문자·알림 갱신(2026-11-08) — 경로마다 한 주문을 끝까지(주문 → 입금 → 작업 → 송장 입력) 돌려 나간 문자를 센다
at(2027, 1, 4, 10);
var sr = stock('rice'); sr['남은 양(kg)'] = Number(sr['남은 양(kg)']) + 200; save_('재고', sr);
var ss = stock('soy'); ss['남은 양(kg)'] = Number(ss['예약된 양(kg)']) + 20; save_('재고', ss);   // 콩은 20kg만 남김
function editInvoice(o, text) {   // 대표가 장부 「주문」 송장 칸에 입력한 것처럼
  o = order(o['주문번호']); o['송장'] = text; save_('주문', o);
  var col = SCHEMA['주문'].indexOf('송장') + 1, row = o._row;
  onBookEdit({ range: { getSheet: function () { return { getName: function () { return '주문'; } }; }, getColumn: function () { return col; }, getLastColumn: function () { return col; }, getRow: function () { return row; }, getLastRow: function () { return row; } } });
}
function life(no, invoice) { if (order(no)['상태'] === '확정') setStatus(no, '입금'); if (order(no)['상태'] === '입금') setStatus(no, '작업'); if (order(no)['상태'] === '작업') editInvoice(order(no), invoice); }
function sent(tel) { var c = cust(tel); return c ? msgs(c['고객번호']).map(function (s) { return { code: s['문자틀'], result: s['결과'] }; }) : []; }
function real(tel) { return sent(tel).filter(function (s) { return !/^건너뜀/.test(s.result); }); }
var SC = [];
// ① 홈페이지 카드
buyer = { '이름': '시험카드', '연락처': '01000000051', '주소': '시험시 1', '동의': ['환불확인'] };
var h1 = co([rice(10, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_h1', orderId: h1['주문번호'], amount: h1['청구액'] }); life(h1['주문번호'], '시험택배 111-1111');
SC.push({ name: '홈페이지 · 카드(쌀)', tel: '01000000051' });
ok('홈페이지 카드 → 결제완료 → 발송(운송장)', real('01000000051').map(function (s) { return s.code; }).join() === '결제완료,발송' && /■ 운송장정보 : 시험택배 \/ 111-1111/.test(real('01000000051')[1].result), JSON.stringify(sent('01000000051').map(function (s) { return s.code; })));
// ② 홈페이지 가상계좌
buyer = { '이름': '시험계좌', '연락처': '01000000052', '주소': '시험시 2', '동의': ['환불확인'] };
var h2 = co([rice(10, 10)]); post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_VA_h2', orderId: h2['주문번호'], amount: h2['청구액'] });
post({ createdAt: 'x', secret: order(h2['주문번호'])['결제 비밀'], status: 'DONE', transactionKey: 't2', orderId: h2['주문번호'] }); life(h2['주문번호'], '시험택배 222-2222');
SC.push({ name: '홈페이지 · 무통장(가상계좌, 쌀)', tel: '01000000052' });
ok('홈페이지 가상계좌 → 입금안내 → 입금확인 → 발송', real('01000000052').map(function (s) { return s.code; }).join() === '입금안내,입금확인,발송', JSON.stringify(sent('01000000052').map(function (s) { return s.code; })));
// ③ 문자 주문 — 재고 있음
var t3 = intake({ '경로': '문자', '원문': '쌀 10키로 찹쌀 조금 시험셋', '이름': '시험문자', '연락처': '01000000053', mode: 'order', items: [rice(10, 10)] });
life(t3['주문번호'], '시험택배 333-3333');
SC.push({ name: '문자 주문 · 재고 있음(쌀)', tel: '01000000053' });
ok('문자 주문 재고 있음 → 확정(쌀 환불 확인) → 입금확인 → 발송', t3['상태'] === '확정' && real('01000000053').map(function (s) { return s.code; }).join() === '확정,입금확인,발송', JSON.stringify(sent('01000000053').map(function (s) { return s.code; })));
// ④ 전화 주문 — 재고 없음
var t4 = intake({ '경로': '전화', '원문': '콩 30키로 시험넷', '이름': '시험품절', '연락처': '01000000054', mode: 'order', items: [soy(30)] });
SC.push({ name: '전화 주문 · 재고 없음(콩 30kg)', tel: '01000000054' });
var pm4 = sent('01000000054').filter(function (s) { return s.code === '품절'; })[0];
ok('재고 없음 → 주문 바로 취소 + 품절 한 통(대기 줄 없음)', t4['상태'] === '품절' && order(t4['주문번호'])['상태'] === '취소' && pm4 && /준비된 양이 모두 소진되어 주문이 취소되었습니다/.test(pm4.result) && real('01000000054').length === 1, JSON.stringify(sent('01000000054')));
// ⑤ 콩만 담은 카톡 주문
var t5 = intake({ '경로': '카톡', '원문': '콩 5키로 시험다섯', '이름': '시험콩', '연락처': '01000000055', mode: 'order', items: [soy(5)] });
life(t5['주문번호'], '시험택배 555-5555');
SC.push({ name: '카톡 주문 · 콩만(5kg)', tel: '01000000055' });
var cf5 = sent('01000000055').filter(function (s) { return s.code === '확정'; })[0].result;
ok('콩만 → 확정에 도정일 줄 없음·콩 환불 확인(환불확인콩)', cf5.indexOf('도정일') < 0 && /※ 보내기 전에는 전액 환불됩니다/.test(cf5) && cf5.indexOf('도정 후에는') < 0, cf5);
ok('콩만 → 입금확인에도 도정일 줄 없음', sent('01000000055').filter(function (s) { return s.code === '입금확인'; })[0].result.indexOf('도정일') < 0);
// ⑥ 지인 주문
var f0 = intake({ '경로': '지인', '원문': '지인 주문 시험지인 010-0000-0056 쌀 20kg 찹쌀10% 주소 시험시 금액 70,000원', '이름': '시험지인', '연락처': '01000000056', '주소': '시험시 6', mode: 'order', items: [rice(10, 20)], '금액': '70,000원' });
var of6 = order(f0['주문번호']);
ok('지인 주문 — 금액은 대표 값 그대로·할인 없음·확정·재고 잡음', f0['상태'] === '확정' && of6['청구액'] === 70000 && of6['할인액'] === 0 && of6['경로'] === '지인' && cust('01000000056')['유형'] === '지인' && !cust('01000000056')['두두 호'], JSON.stringify([f0['상태'], of6['청구액'], of6['할인액'], of6['경로']]));
ok('지인 주문은 회차에 안 셈', liveCount_(cust('01000000056')['고객번호']) === 0);
at(2027, 1, 20, 10); checkDeadlines();
ok('지인 주문은 입금 기한·자동 취소 없음', order(f0['주문번호'])['상태'] === '확정');
life(f0['주문번호'], 'CJ대한통운 666-6666');
SC.push({ name: '지인 주문(쌀 20kg, 70,000원)', tel: '01000000056' });
var fs = real('01000000056');
ok('지인 → 「지인발송」 한 통뿐, 머리·꼬리 없음', fs.length === 1 && fs[0].code === '지인발송' && /— 두두쌀 찹쌀 10% 20kg 오늘 CJ대한통운으로 출발했습니다\. 감사합니다\.\n송장번호 666-6666\n— 최현철$/.test(fs[0].result) && fs[0].result.indexOf('[두두농장]') < 0, JSON.stringify(sent('01000000056')));
at(2027, 1, 22, 10); setStatus(f0['주문번호'], '도착'); at(2027, 1, 30, 10); runScheduled();
ok('지인 → 도착 뒤 안내·밥맛도 거름', real('01000000056').length === 1);
var f2 = intake({ '경로': '지인', '원문': '지인 콩 100kg', '이름': '시험지인둘', '연락처': '01000000057', mode: 'order', items: [soy(100)], '금액': 500000 });
ok('지인 주문 재고 모자람 → 확인필요(문자 없음)', f2['상태'] === '확인필요' && /지인 주문 — 남은 양 부족/.test(order(f2['주문번호'])['메모']) && sent('01000000057').length === 0);
// 송장 칸 — 이미 발송한 주문은 다시 안 보냄
editInvoice(order(t3['주문번호']), '시험택배 333-3334');
ok('송장 고쳐도 발송 문자는 한 번', sent('01000000053').filter(function (s) { return s.code === '발송'; }).length === 1);
// 판매 통장 하나 — 확정 계좌는 설정 account 한 곳
setVal('account', null, '시험농협 111-2222-3333 모아온');
var t6 = intake({ '경로': '문자', '원문': '쌀 10 시험여섯', '이름': '시험통장', '연락처': '01000000058', mode: 'order', items: [rice(0, 10)] });
ok('판매 통장 바꾸면 확정 계좌도 그 한 곳으로', /■ 입금계좌 : 시험농협 111-2222-3333 모아온/.test(sent('01000000058').filter(function (s) { return s.code === '확정'; })[0].result));
setVal('account', null, '시험은행 000-0000-0000');
// 문자틀·연락 규칙 판 — 옛 장부 규칙이 켜져 있으면 setup 이 한 번 끄고, 그 뒤 대표가 고친 것은 지킴
var rj = one_('연락 규칙', '규칙', '접수'); rj['켬/끔'] = '켬'; save_('연락 규칙', rj); setVal('rules_ver', null, 1);
var tj = one_('문자틀', '코드', '안부'); tj['문구'] = '옛 문구'; save_('문자틀', tj); setVal('tpl_ver', null, 1);
setup();
ok('판 오르면 setup 이 연락 규칙 켬/끔·문자틀 문구를 한 번 맞춤', one_('연락 규칙', '규칙', '접수')['켬/끔'] === '끔' && one_('문자틀', '코드', '안부')['문구'] === DEFAULT_TEMPLATES.filter(function (t) { return t[0] === '안부'; })[0][2]);
tj = one_('문자틀', '코드', '안부'); tj['문구'] = '대표가 고친 문구 {이름}'; save_('문자틀', tj); rj = one_('연락 규칙', '규칙', '접수'); rj['켬/끔'] = '켬'; save_('연락 규칙', rj);
setup();
ok('같은 판이면 대표가 고친 문구·켬/끔 그대로', one_('문자틀', '코드', '안부')['문구'] === '대표가 고친 문구 {이름}' && one_('연락 규칙', '규칙', '접수')['켬/끔'] === '켬');
rj = one_('연락 규칙', '규칙', '접수'); rj['켬/끔'] = '끔'; save_('연락 규칙', rj);
window.__scenarios = SC.map(function (s) { return { name: s.name, msgs: sent(s.tel) }; });

// 36. 주문 관리 화면(대표 전용) — 장부에 손으로 넣는 것과 같은 길
at(2027, 2, 1, 10);
__user = '';
ok('공개 배포(로그인 없음)로 열면 화면 대신 막힘', !!doGet({ parameter: { page: 'admin' } }).html);
var denied = false; try { adminLoad(); } catch (e) { denied = true; }
ok('로그인 없으면 adminLoad 거부', denied);
denied = false; try { adminAct('1', '입금'); } catch (e) { denied = true; }
ok('로그인 없으면 adminAct 거부', denied);
__user = 'other@test';
denied = false; try { adminLoad(); } catch (e) { denied = true; }
ok('다른 계정도 거부', denied);
__user = 'owner@test';
ok('대표 계정이면 화면 파일 Admin', doGet({ parameter: { page: 'admin' } }).file === 'Admin');
var ad = adminOrder({ route: '전화', name: '시험관리', tel: '010-0000-0061', addr: '시험시 61', items: [{ grain: 'rice', glutinous: 20, size: 10 }] });
var an = ad.res['주문번호'];
ok('새 주문(전화) → 확정 + 확정 문자', ad.ok && order(an)['상태'] === '확정' && order(an)['경로'] === '전화' && real('01000000061').map(function (s) { return s.code; }).join() === '확정', JSON.stringify(ad));
var L = adminLoad();
ok('adminLoad 에 그 주문·재고·시험 표시', L.orders.some(function (o) { return o.no === String(an) && o.status === '확정' && o.name === '시험관리'; }) && L.stock.length > 0 && L.test === true);
ok('adminLoad 값에 날짜 객체 없음(google.script.run 은 Date 를 못 넘김)', JSON.stringify(L).indexOf('"20') < 0 || L.orders.every(function (o) { return Object.keys(o).every(function (k) { return !(o[k] instanceof Date); }); }));
ok('확정 아닌데 작업 완료 → 거절', adminAct(an, '작업').ok === false && order(an)['상태'] === '확정');
ok('입금 확인 → 입금 + 입금확인 문자', adminAct(an, '입금').ok && order(an)['상태'] === '입금' && real('01000000061').map(function (s) { return s.code; }).join() === '확정,입금확인');
ok('작업 완료 → 작업', adminAct(an, '작업').ok && order(an)['상태'] === '작업');
ok('송장 형식 틀리면 거절', adminAct(an, '송장', { text: '1234' }).ok === false);
ok('송장 입력 → 발송 + 발송 문자(택배사·번호 나눠 넣음)', adminAct(an, '송장', { text: 'CJ대한통운 777-7777' }).ok && order(an)['상태'] === '발송' && order(an)['송장'] === 'CJ대한통운 777-7777' && /■ 운송장정보 : CJ대한통운 \/ 777-7777/.test(sent('01000000061').filter(function (s) { return s.code === '발송'; })[0].result), JSON.stringify(sent('01000000061')));
ok('같은 주문 송장 다시 → 거절(문자 한 번)', adminAct(an, '송장', { text: 'CJ대한통운 777-7778' }).ok === false && sent('01000000061').filter(function (s) { return s.code === '발송'; }).length === 1);
ok('도착 → 도착', adminAct(an, '도착').ok && order(an)['상태'] === '도착');
var af = adminOrder({ route: '지인', name: '시험관리지인', tel: '01000000062', addr: '시험시 62', items: [{ grain: 'soy', size: 5 }], amount: '30,000원' });
ok('지인 주문 금액 없으면 거절', adminOrder({ route: '지인', name: 'x', tel: '01000000063', items: [{ grain: 'soy', size: 5 }] }).ok === false);
ok('새 주문(지인) → 확정·금액 그대로·문자 없음', af.ok && order(af.res['주문번호'])['청구액'] === 30000 && order(af.res['주문번호'])['경로'] === '지인' && real('01000000062').length === 0, JSON.stringify(af));
var ac = adminOrder({ route: '문자', name: '시험관리취소', tel: '01000000064', addr: '시험시 64', items: [{ grain: 'rice', glutinous: 0, size: 10 }] });
var cn = ac.res['주문번호'], heldBefore = stock('rice')['예약된 양(kg)'];
ok('확정 주문 취소 → 취소 + 재고 풀림', adminAct(cn, '취소', { why: '고객 전화' }).ok && order(cn)['상태'] === '취소' && /대표 취소: 고객 전화/.test(order(cn)['메모']) && Number(stock('rice')['예약된 양(kg)']) === Number(heldBefore) - 10);
var bad = adminOrder({ route: '지인', name: '시험관리부족', tel: '01000000065', items: [{ grain: 'soy', size: 999 }], amount: 1 });
var bn = bad.res['주문번호'];
ok('확인필요 주문 → 상태 바꾸기(문자 없음)', order(bn)['상태'] === '확인필요' && adminAct(bn, '상태', { to: '취소', memo: '대표 정리' }).ok && order(bn)['상태'] === '취소' && order(bn)['메모'] === '대표 정리' && sent('01000000065').length === 0);
ok('메모 저장', adminAct(af.res['주문번호'], '메모', { memo: '문 앞에' }).ok && order(af.res['주문번호'])['메모'] === '문 앞에');
ok('새 주문 경로 틀리면 거절', adminOrder({ route: '홈페이지', name: 'x', tel: '01000000066', items: [{ grain: 'soy', size: 5 }] }).ok === false);
var sb = Number(stock('soy')['남은 양(kg)']);
ok('재고 넣기 → 남은 양에 더함(덮어쓰기 아님)', adminStock('soy', 12.5, '시험 입고').ok && Number(stock('soy')['남은 양(kg)']) === sb + 12.5);
ok('재고 넣기 — 이상한 값 거절', adminStock('soy', -3).ok === false && adminStock('barley', 5).ok === false && adminStock('rice', 0).ok === false);
setVal('last_run', null, addDays_(now_(), -1));
var L2 = adminLoad();
ok('자동 처리 멈춤 → n시간째 없음', L2.staleHours >= 23, String(L2.staleHours));
setVal('last_run', null, now_());
ok('자동 처리 방금 → 경보 없음', adminLoad().staleHours === 0);
log_('시험 실패', 'x', '실패', '일부러 낸 실패');
ok('처리 실패(7일) 끌어옴', adminLoad().fails.some(function (f) { return f.what === '시험 실패' && /일부러/.test(f.why); }));
var dn = adminOrder({ route: '문자', name: '시험임박', tel: '01000000067', addr: '시험시 67', items: [{ grain: 'rice', glutinous: 0, size: 10 }] }).res['주문번호'];
var od = order(dn); od['입금 기한'] = addDays_(now_(), 0.5); save_('주문', od);
ok('입금 기한 24시간 안 → 임박 표시', adminLoad().orders.filter(function (o) { return o.no === String(dn); })[0].dueSoon === true);
od = order(dn); od['작업일'] = now_(); save_('주문', od); adminAct(dn, '입금');
ok('작업일이 오늘인 입금 주문 → 오늘 작업', adminLoad().orders.filter(function (o) { return o.no === String(dn); })[0].workToday === true);

// 37. 없앤 것 정리 — 옛 장부에 남은 찧은날 문자틀·작업 완료 규칙·보내지 않은 기록 줄을 setup 이 지운다
append_('문자틀', { '코드': '찧은날', '상태': '확정', '문구': '옛 문구', '짧은 판': '같음', '종류': '안내' });
append_('연락 규칙', { '규칙': '작업 완료', '문자틀': '찧은날', '켬/끔': '끔' });
append_('연락', { '시각': now_(), '고객': 'C9999', '주문': '9999', '경로': '문자', '문자틀': '찧은날', '종류': '안내', '결과': '건너뜀: 규칙 끔' });
append_('연락', { '시각': now_(), '고객': 'C9999', '주문': '9999', '경로': '문자', '문자틀': '접수', '종류': '안내', '결과': '건너뜀: 규칙 끔' });
append_('연락', { '시각': now_(), '고객': 'C9999', '주문': '9999', '경로': '문자', '문자틀': '입금확인', '종류': '안내', '결과': '건너뜀: 지인 주문(지인발송만)' });
var keepN = rows_('연락').filter(function (r) { return !/^건너뜀/.test(String(r['결과'])); }).length;
setup();
ok('setup 이 찧은날 문자틀·작업 완료 규칙을 지움', !one_('문자틀', '코드', '찧은날') && !one_('연락 규칙', '규칙', '작업 완료'));
ok('보내지 않은 기록(규칙 끔·지인 거름) 지우고 보낸 기록은 그대로', rows_('연락').filter(function (r) { return r['고객'] === 'C9999'; }).length === 0 && rows_('연락').filter(function (r) { return !/^건너뜀/.test(String(r['결과'])); }).length === keepN);

// 38. 통장으로 입금한 주문(전화·문자·카톡) 취소 — 대표가 직접 돌려줘야 하므로 확인필요 → 「환불 끝」에서 취소·취소확인
at(2027, 2, 3, 10);
var bk = adminOrder({ route: '문자', name: '시험통장취소', tel: '01000000081', addr: '시험시 81', items: [{ grain: 'rice', glutinous: 10, size: 10 }] }).res['주문번호'];
adminAct(bk, '입금');
var heldB = Number(stock('rice')['예약된 양(kg)']);
var cr = cancelMine('01000000081', bk);
ok('통장 입금 주문을 고객이 취소 → 확인필요(통장 환불 필요), 재고는 아직 잡힘, 취소 문자 아직 없음',
   cr.ok === false && cr.reason === '확인필요' && order(bk)['상태'] === '확인필요' && /^취소 요청: 통장 입금 40,000원/.test(order(bk)['메모']) &&
   Number(stock('rice')['예약된 양(kg)']) === heldB && sent('01000000081').filter(function (s) { return s.code === '취소확인'; }).length === 0, JSON.stringify([cr.reason, order(bk)['메모']]));
ok('주문 관리 「취소」는 막고 「환불 끝」으로 안내', adminAct(bk, '취소').ok === false && order(bk)['상태'] === '확인필요');
ok('환불 끝 → 취소 + 재고 풀림', adminAct(bk, '환불끝').ok && order(bk)['상태'] === '취소' && Number(stock('rice')['예약된 양(kg)']) === heldB - 10);
var cm = sent('01000000081').filter(function (s) { return s.code === '취소확인'; })[0];
ok('취소확인 문자에 환불금액·환불 완료 날짜(빈 칸 없음)', cm && /^보류/.test(cm.result) && /■ 환불금액 : 40,000원/.test(cm.result) && /■ 환불예정일 : 2월 3일 환불 완료/.test(cm.result), cm && cm.result);
ok('환불 끝은 취소 요청 주문만', adminAct(bk, '환불끝').ok === false);
var un = adminOrder({ route: '전화', name: '시험입금전취소', tel: '01000000082', addr: '시험시 82', items: [{ grain: 'rice', glutinous: 0, size: 10 }] }).res['주문번호'];
var cu = cancelMine('01000000082', un);
var cmu = sent('01000000082').filter(function (s) { return s.code === '취소확인'; })[0];
ok('입금 전이면 바로 취소 + 환불 줄 없는 취소확인', cu.ok && order(un)['상태'] === '취소' && cmu && cmu.result.indexOf('환불') < 0, cmu && cmu.result);
var ap = adminOrder({ route: '카톡', name: '시험대표취소', tel: '01000000083', addr: '시험시 83', items: [{ grain: 'soy', size: 5 }] }).res['주문번호'];
adminAct(ap, '입금');
var ar = adminAct(ap, '취소', { why: '고객 전화' });
ok('대표가 입금된 통장 주문을 취소 → 확인필요로 옮기고 환불 끝 안내', ar.ok && /환불 끝/.test(ar.msg) && order(ap)['상태'] === '확인필요');

// 39. 한꺼번에 처리 · 품목·배송지(배송 개요·택배 파일용)
at(2027, 2, 4, 10);
var b1 = adminOrder({ route: '전화', name: '시험묶음일', tel: '01000000091', addr: '시험시 묶음로 1', items: [{ grain: 'rice', glutinous: 10, size: 20, subpack: true }, { grain: 'soy', size: 5 }] }).res['주문번호'];
var b2 = adminOrder({ route: '문자', name: '시험묶음이', tel: '01000000092', addr: '시험시 묶음로 2', items: [{ grain: 'rice', glutinous: 0, size: 10 }] }).res['주문번호'];
var BL = adminLoad().orders.filter(function (o) { return o.no === String(b1); })[0];
ok('도정률 설정(기본 70%)이 주문 관리로', adminLoad().millYield === 70);
ok('주문 관리에 품목(조합·양·소포장)과 배송지', BL.items.length === 2 && BL.items[0].gl === 10 && BL.items[0].size === 20 && BL.items[0].sub === true && BL.ship.addr === '시험시 묶음로 1' && BL.ship.name === '시험묶음일', JSON.stringify(BL.items) + JSON.stringify(BL.ship));
var bb = adminBulk([{ no: b1, action: '입금' }, { no: b2, action: '입금' }, { no: b2, action: '취소' }]);
ok('한꺼번에 입금 확인 — 둘 다 입금·문자 각각, 취소는 한꺼번에 안 됨', bb.done === 2 && bb.failed.length === 1 && order(b1)['상태'] === '입금' && order(b2)['상태'] === '입금' && sent('01000000091').filter(function (s) { return s.code === '입금확인'; }).length === 1, JSON.stringify(bb));
var bw = adminBulk([{ no: b1, action: '작업' }, { no: b2, action: '작업' }]);
var bs = adminBulk([{ no: b1, action: '송장', data: { text: 'CJ대한통운 111' } }, { no: b2, action: '송장', data: { text: 'CJ대한통운 222' } }]);
ok('한꺼번에 작업 완료 → 송장 → 발송 문자 각각', bw.done === 2 && bs.done === 2 && order(b2)['상태'] === '발송' && /222/.test(order(b2)['송장']) && sent('01000000092').filter(function (s) { return s.code === '발송'; }).length === 1);

// 40. 결제창이 동시에 둘 열려도 ○호 할인 사유는 실제 번호로
var seatsWas = val_('ho_seats', 100); setVal('ho_seats', null, 999);
buyer = { '이름': '시험동시일', '연락처': '01000000095', '주소': '시험시 95', '동의': ['환불확인'] };
var q1 = co([rice(10, 10)]);
buyer = { '이름': '시험동시이', '연락처': '01000000096', '주소': '시험시 96', '동의': ['환불확인'] };
var q2 = co([rice(10, 10)]);
post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_q1', orderId: q1['주문번호'], amount: q1['청구액'] });
post({ kind: 'pay-confirm', test: true, paymentKey: 'mock_CARD_q2', orderId: q2['주문번호'], amount: q2['청구액'] });
var h1 = cust('01000000095')['두두 호'], h2 = cust('01000000096')['두두 호'];
ok('동시 결제 — ○호는 서로 다르고 할인 사유도 각자 번호', h1 && h2 && h1 !== h2 && order(q1['주문번호'])['할인 사유'] === '두두 ' + h1 + '호 고객' && order(q2['주문번호'])['할인 사유'] === '두두 ' + h2 + '호 고객',
   JSON.stringify([h1, h2, order(q1['주문번호'])['할인 사유'], order(q2['주문번호'])['할인 사유']]));
setVal('ho_seats', null, seatsWas);


ok('처리 기록에 실패 없음(일부러 낸 것 말고)', rows_('처리 기록').filter(function (x) { return x['결과'] === '실패' && x['무엇'] !== 'doPost' && x['무엇'] !== '시험 실패'; }).length === 0,
   JSON.stringify(rows_('처리 기록').filter(function (x) { return x['결과'] === '실패'; })));
