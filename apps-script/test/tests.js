// 가짜 고객·주문으로 처음부터 끝까지. 실제 개인정보 금지 — 이름·번호는 모두 지어낸 값.
var results = [];
function ok(name, cond, detail) { results.push({ name: name, pass: !!cond, detail: detail || '' }); }
var T0 = new Date(2026, 10, 10, 10, 0, 0);   // 2026-11-10 10:00
var clock = new Date(T0);
Clock.now = function () { return new Date(clock); };
function tick(min) { clock = new Date(clock.getTime() + min * 60000); }
function setVal(key, onoff, v) { var r = setting_(key); if (onoff !== null) r['켬/끔'] = onoff; if (v !== undefined) r['값'] = v; save_('설정', r); }
function order(no) { return rows_('주문').filter(function (r) { return r['주문번호'] === no; })[0]; }
function stock(code) { return rows_('재고').filter(function (r) { return r['곡식'] === code; })[0]; }
function cust(tel) { return rows_('고객').filter(function (r) { return r['연락처'] === tel; })[0]; }
function last(sheet) { var r = rows_(sheet); return r[r.length - 1]; }

// 1. 장부 만들기
setup();
ok('시트 14장', __book.getSheets().length === 14, __book.getSheets().map(function (s) { return s.name; }).join(','));
ok('기본 시트1 지움', !__book.getSheetByName('시트1'));
ok('설정 기본값', rows_('설정').length === DEFAULT_SETTINGS.length);
setup();
ok('setup 두 번 돌려도 그대로', rows_('설정').length === DEFAULT_SETTINGS.length && rows_('문자틀').length === DEFAULT_TEMPLATES.length);

// 가짜 곡식·재고·작업 달력
append_('곡식', { '코드': 'RICE-SDJ', '제품': '두두쌀', '상태': '준비 중', '부르는 이름': '신동진', '단위(kg)': 10, '가격(원/kg)': 4000, '공개': 'Y' });
append_('곡식', { '코드': 'MISU-B', '제품': '두두미숫가루', '상태': '숨김', '부르는 이름': '기본 배합', '단위(kg)': 0.5, '가격(원/kg)': 24000, '공개': 'Y' });
append_('재고', { '곡식': 'RICE-SDJ', '남은 양(kg)': 30, '예약된 양(kg)': 0, '기준일': T0 });
for (var i = 1; i <= 10; i++) append_('작업 달력', { '날짜': day_(addDays_(T0, i)), '도정 가능': i === 1 ? '불가' : '가능', '하루 최대량(kg)': 30, '배정된 양(kg)': 0 });

// 2. 스위치 내보내기 — 처음엔 전부 끔, 숨김 곡식은 안 나감
var ex = exportSwitches();
ok('스위치 전부 끔', SWITCHES.every(function (k) { return ex.switches[k] === false; }));
ok('숨김 곡식 안 나감', ex.grains.length === 1 && ex.grains[0]['코드'] === 'RICE-SDJ');
ok('내보내기에 재고 없음(live_stock 끔)', ex.grains[0]['남은 양(kg)'] === undefined);
setVal('order', '켬'); setVal('loyalty', '켬'); setVal('refill_alert', '켬'); setVal('live_stock', '켬');
ex = exportSwitches();
ok('스위치 켜면 따라감', ex.switches.order === true && ex.switches.survey === false);
ok('live_stock 켜면 남은 양', ex.grains[0]['남은 양(kg)'] === 30);

// 3. 문의만 — 관심 고객
var r1 = intake({ '경로': '홈페이지', '이름': '시험일', '연락처': '010-0000-0001', mode: 'inquiry', '곡식': 'RICE-SDJ', '동의': ['필수', '소식'] });
var c1 = cust('01000000001');
ok('문의 → 고객 생성·관심', c1 && c1['단계'] === '관심' && rows_('관심').length === 1, JSON.stringify(r1));
ok('동의 두 줄', rows_('동의').filter(function (a) { return a['고객'] === c1['고객번호']; }).length === 2);

// 4. 주문 — 재고 충분 → 확정, 둘째 날(첫날 불가) 작업
tick(5);
var r2 = intake({ '경로': '홈페이지', '이름': '시험이', '연락처': '010-0000-0002', mode: 'order', '곡식': 'RICE-SDJ', '양': 10, '조합': '7분도·찹쌀10%',
                  '취향': { '제품': '두두쌀', '도정': '7분도', '찹쌀': '10%', '양(kg)': 10, '주기(일)': 40 }, '동의': ['필수'] });
var o2 = order(r2['주문번호']);
ok('주문 확정', r2['상태'] === '확정' && o2['상태'] === '확정', JSON.stringify(r2));
ok('작업일 = 첫 가능일(11-12)', ymd_(o2['작업일']) === '2026-11-12', ymd_(o2['작업일']));
ok('받을 날 = 작업일+2', ymd_(o2['받을 날']) === '2026-11-14');
ok('입금 기한 = +3일', ymd_(o2['입금 기한']) === '2026-11-13');
ok('청구액 40,000 (첫 주문 할인 없음)', o2['청구액'] === 40000 && o2['할인율'] === 0);
ok('예약된 양 10', stock('RICE-SDJ')['예약된 양(kg)'] === 10);
var c2 = cust('01000000002');
ok('두두 1호, 첫 고객', c2['두두 호'] === 1 && c2['단계'] === '첫 고객');
ok('연락: 접수·확정·호 보류', rows_('연락').filter(function (s) { return s['고객'] === c2['고객번호']; }).map(function (s) { return s['문자틀']; }).join() === '접수안내,확정입금안내,첫고객호');
ok('sms 끔이면 보류', String(last('연락')['결과']).indexOf('보류') === 0, last('연락')['결과']);
ok('임시 문구 채움', String(last('연락')['결과']).indexOf('두두 1호') > 0, last('연락')['결과']);

// 5. 중복 — 같은 번호·같은 원문 10분 안
var dupP = { '경로': '문자', '원문': '쌀 10키로 보내주세요 시험삼', '이름': '시험삼', '연락처': '010-0000-0003', mode: 'inquiry' };
intake(dupP); tick(3); var rd = intake(dupP);
ok('중복 → 확인필요 표시', rd['중복'] === true && last('접수')['처리상태'] === '중복');
ok('문자 경로 → 짧은 판', cust('01000000003')['문자 판'] === '짧은 판');

// 6. 재고 부족 → 대기, 재고 넣으면 자동 확정
var r4 = intake({ '경로': '홈페이지', '이름': '시험사', '연락처': '010-0000-0004', mode: 'order', '곡식': 'RICE-SDJ', '양': 25 });
ok('남은 양 부족 → 대기', r4['상태'] === '대기' && order(r4['주문번호'])['메모'] === '남은 양 부족');
ok('대기 문자', last('연락')['문자틀'] === '대기안내');
var s = stock('RICE-SDJ'); s['남은 양(kg)'] = 60; save_('재고', s);
tick(10); runScheduled();
var o4 = order(r4['주문번호']);
ok('재고 넣고 예약 작업 → 확정', o4['상태'] === '확정', o4['상태'] + ' ' + o4['메모']);
ok('하루 최대량 넘지 않게 다음 날로', ymd_(o4['작업일']) === '2026-11-13', ymd_(o4['작업일']));
ok('last_run 기록', setting_('last_run')['값'] instanceof Date);

// 7. 입금 → 작업 → 발송 → 도착, 재고 빠짐·예상 소진일
setStatus(r2['주문번호'], '입금');
setStatus(r2['주문번호'], '작업');
setStatus(r2['주문번호'], '발송', { '송장': 'TEST-123' });
ok('발송하면 남은 양·예약 같이 빠짐', stock('RICE-SDJ')['남은 양(kg)'] === 50 && stock('RICE-SDJ')['예약된 양(kg)'] === 25, JSON.stringify(stock('RICE-SDJ')));
setStatus(r2['주문번호'], '도착');
c2 = cust('01000000002');
ok('도착 → 예상 소진일 = +40일(취향 주기)', ymd_(c2['예상 소진일']) === ymd_(addDays_(clock, 40)), ymd_(c2['예상 소진일']));
ok('작업 뒤 취소 → 확인필요', setStatus(r2['주문번호'], '취소') === false && order(r2['주문번호'])['상태'] === '확인필요');
var o2b = order(r2['주문번호']); o2b['상태'] = '도착'; save_('주문', o2b);   // 대표가 확인필요를 풀었다고 치고 되돌림

// 8. 입금 기한 — 안내 1회 → 다시 지나면 자동 취소·재고 복귀
clock = new Date(2026, 10, 14, 11, 0, 0); runScheduled();
o4 = order(r4['주문번호']);
ok('기한 지남 → 안내 1회', o4['상태'] === '확정' && o4['입금 안내 횟수'] === 1 && ymd_(o4['입금 기한']) === '2026-11-17');
clock = new Date(2026, 10, 18, 11, 0, 0); runScheduled();
o4 = order(r4['주문번호']);
ok('다시 지남 → 자동 취소', o4['상태'] === '취소');
ok('취소 → 예약 복귀', stock('RICE-SDJ')['예약된 양(kg)'] === 0, JSON.stringify(stock('RICE-SDJ')));
ok('취소 → 작업 달력 복귀', rows_('작업 달력').filter(function (d) { return ymd_(d['날짜']) === '2026-11-13'; })[0]['배정된 양(kg)'] === 0);

// 9. 단골 — 같은 번호로 다시 주문하면 2회째 3%
var r5 = intake({ '경로': '카톡', '이름': '시험이', '연락처': '01000000002', mode: 'order', '곡식': 'RICE-SDJ', '양': 10 });
var o5 = order(r5['주문번호']);
ok('2회째 할인 3%', o5['할인율'] === 3 && o5['청구액'] === 38800, o5['할인율'] + ' ' + o5['청구액']);
ok('단계 단골', cust('01000000002')['단계'] === '단골');
ok('단골 할인 축하 문자', rows_('연락').some(function (x) { return x['주문'] === r5['주문번호'] && x['문자틀'] === '단골할인'; }));
ok('호는 그대로 1', cust('01000000002')['두두 호'] === 1);
ok('loyalty 끄면 할인 없음', (function () { setVal('loyalty', '끔'); var r = intake({ '이름': '시험오', '연락처': '01000000005', mode: 'order', '곡식': 'RICE-SDJ', '양': 5 }); setVal('loyalty', '켬'); return order(r['주문번호'])['할인율'] === 0; })());

// 10. 떨어질 때쯤 — 예상 소진일 5일 전부터 한 번만
c2 = cust('01000000002'); c2['예상 소진일'] = day_(addDays_(clock, 3)); save_('고객', c2);
refillAlert(); refillAlert();
ok('떨어질 때쯤 한 번만', rows_('연락').filter(function (x) { return x['고객'] === c2['고객번호'] && x['문자틀'] === '떨어질때'; }).length === 1);

// 11. 쉬는 고객 — 소진일 + 60일 넘도록 주문 없음 → 안부(광고)는 동의 없으면 건너뜀
clock = addDays_(c2['예상 소진일'], 61); updateStages();
c2 = cust('01000000002');
ok('쉬는 고객으로', c2['단계'] === '쉬는 고객', c2['단계']);
var rest = rows_('연락').filter(function (x) { return x['고객'] === c2['고객번호'] && x['문자틀'] === '쉬는고객안부'; })[0];
ok('광고는 규칙 끔이면 건너뜀', rest && rest['결과'] === '건너뜀: 규칙 끔', rest && rest['결과']);

// 12. 광고 조건 — 소식 동의·시간대·월 상한
var c1b = cust('01000000001');
clock = new Date(2026, 11, 1, 21, 0, 0); ok('밤 9시는 광고 안 됨', adOk_(c1b) === false);
clock = new Date(2026, 11, 1, 10, 0, 0); ok('동의자 낮 시간 광고 됨', adOk_(c1b) === true);
ok('동의 없는 사람 광고 안 됨', adOk_(cust('01000000003')) === false);

// 13. 웹 입구 — 주문 스위치 끄면 주문도 문의로
setVal('order', '끔');
var before = rows_('주문').length;
doPost({ postData: { contents: JSON.stringify({ '이름': '시험육', '연락처': '01000000006', mode: 'order', '곡식': 'RICE-SDJ', '양': 5 }) } });
ok('order 끔 → 주문 안 생김, 관심으로', rows_('주문').length === before && cust('01000000006')['단계'] === '관심');
var g = JSON.parse(doGet({ parameter: { action: 'switches' } }).text);
ok('doGet 스위치 JSON', g.switches.order === false && g.switches.loyalty === true);
doPost({ postData: { contents: '깨진 글' } });
ok('깨진 요청 → 처리 기록 실패', last('처리 기록')['결과'] === '실패');

// 14. 연락처 없는 접수 → 확인필요
var rn = intake({ '경로': '전화', '원문': '번호 없이 들어온 기록방 한 줄' });
ok('연락처 없음 → 확인필요', rn.ok === false && last('접수')['처리상태'] === '확인필요');

ok('처리 기록에 실패 없음(일부러 낸 것 말고)', rows_('처리 기록').filter(function (x) { return x['결과'] === '실패' && x['무엇'] !== 'doPost'; }).length === 0);
