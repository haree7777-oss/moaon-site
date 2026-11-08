// 실제 구글 환경 시험 — 임시 시트를 새로 만들어 그 위에서만 돈다(실제 장부는 건드리지 않음). 가짜 값만 쓴다.
// 편집기에서 selfTest 실행 → 실행 로그에 결과. 끝나면 「두두 고객장부 시험 ○」 시트는 지워도 된다.
function selfTest() {
  var tmp = SpreadsheetApp.create('두두 고객장부 시험 ' + Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyMMdd-HHmm'));
  var real = book_;
  book_ = function () { return tmp; };
  var out = [];
  function ok(name, cond, detail) { out.push((cond ? '통과 ' : '실패 ') + name + (cond ? '' : ' — ' + detail)); }
  try {
    setup();
    ok('시트 14장', tmp.getSheets().length === 14, tmp.getSheets().length);
    var r = function (k) { var x = setting_(k); return x; };
    var s1 = r('order'); s1['켬/끔'] = '켬'; save_('설정', s1);
    var s2 = r('account'); s2['값'] = '시험은행 000'; save_('설정', s2);
    append_('곡식', { '코드': 'rice', '제품': '두두쌀', '상태': '곧', '가격(원/kg)': 4000, '공개': 'Y' });
    append_('재고', { '곡식': 'rice', '남은 양(kg)': 100, '예약된 양(kg)': 0, '기준일': new Date() });
    for (var i = 1; i <= 10; i++) append_('작업 달력', { '날짜': day_(addDays_(new Date(), i)), '도정 가능': '가능', '하루 최대량(kg)': 50, '배정된 양(kg)': 0 });
    var res = doPost({ postData: { contents: JSON.stringify({ kind: 'order', mode: 'order', '경로': '홈페이지', '이름': '시험일', '연락처': '01000000001',
      items: [{ grain: 'rice', glutinous: 10, size: 10, subpack: true, repeat: 'once' }], '동의': ['소식'] }) } });
    var body = JSON.parse(res.getContent());
    ok('웹 접수 → 확정', body['상태'] === '확정', res.getContent());
    var o = one_('주문', '주문번호', body['주문번호']);
    ok('금액 40,000+1,000, ○호 10%', o && o['청구액'] === 36900, o && o['청구액']);
    ok('날짜 칸이 Date', o && o['입금 기한'] instanceof Date, o && typeof o['입금 기한']);
    ok('확정 문자 남김', rows_('연락').some(function (x) { return x['문자틀'] === '확정'; }));
    setStatus(body['주문번호'], '입금'); setStatus(body['주문번호'], '발송', { '택배사': '시험택배', '송장': '1' }); setStatus(body['주문번호'], '도착');
    ok('발송 → 재고 차감', one_('재고', '곡식', 'rice')['남은 양(kg)'] === 90);
    var g = JSON.parse(doGet({ parameter: { action: 'switches' } }).getContent());
    ok('스위치 내보내기', g.switches.order === true && g.seatsLeft === 99, JSON.stringify(g.switches));
    var rc = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'recall', tel: '01000000001' }) } }).getContent());
    ok('불러오기(조합만)', rc.found && rc.combos.rice.glutinous === 10 && !rc['이름'], JSON.stringify(rc));
    var mine = JSON.parse(doPost({ postData: { contents: JSON.stringify({ kind: 'lookup', tel: '01000000001', no: body['주문번호'] }) } }).getContent());
    ok('내 주문 조회(도착 → 발송 단계)', mine.found && mine.step === 4 && mine.canCancel === false, JSON.stringify(mine).slice(0, 200));
    ok('도정일 내보내기', 'millDate' in g, JSON.stringify(g).slice(0, 120));
    doPost({ postData: { contents: JSON.stringify({ kind: 'bulk', '경로': '상담', '이름': '시험식당', '연락처': '01000000002', '유형': '식당·가게', '곡식': '쌀', '동의': [] }) } });
    ok('상담 접수', rows_('연락').some(function (x) { return x['문자틀'] === '상담접수'; }));
    runScheduled();
    ok('예약 작업 돎', setting_('last_run')['값'] instanceof Date);
    ok('처리 기록 실패 없음', !rows_('처리 기록').some(function (x) { return x['결과'] === '실패'; }), JSON.stringify(rows_('처리 기록').filter(function (x) { return x['결과'] === '실패'; })));
  } catch (err) {
    out.push('오류 ' + err + ' ' + (err.stack || ''));
  } finally {
    book_ = real;
  }
  var fail = out.filter(function (x) { return x.indexOf('통과') !== 0; }).length;
  Logger.log('시험 시트: ' + tmp.getUrl());
  Logger.log((out.length - fail) + '/' + out.length + ' 통과\n' + out.join('\n'));
  return out;
}
