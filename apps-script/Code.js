// 두두 고객장부 규칙 일꾼 (Google Apps Script, V8)
// 설계 정본: 80_브랜드마케팅/주문고객_설계.md 3·4·5·6·7·9·11장. 문자틀·연락 규칙은 홈페이지_문안.md 부록 1~5.
// 키·비밀번호는 여기 적지 않는다. 발송 서비스 키는 프로젝트 설정 > 스크립트 속성에만 (6단계).

// ───────── 장부 구조 (시트 이름과 칸 순서) ─────────
var SCHEMA = {
  '접수': ['접수번호', '시각', '경로', '원문', '이름', '연락처', '처리상태', '연결 고객', '연결 주문', '메모', '시험'],
  '고객': ['고객번호', '이름', '연락처', '지역', '유형', '식구 수', '처음 온 날', '처음 경로', '입금자명들', '단골 회차', '두두 호',
          '단계', '첫 주문일', '마지막 주문일', '예상 소진일', '문자 판', '수신 거부', '메모', '시험',
          '회원', '가입일', '비밀번호', '소금', '약관 동의일', '만14세 확인일', '마지막 로그인', '주소', '상세 주소', '우편번호'],
  '동의': ['동의번호', '고객', '종류', '문구 판', '동의 시각', '철회 시각', '경로', '보관 끝나는 날'],
  '관심': ['관심번호', '고객', '곡식', '양', '시기', '용도', '출처', '기록일'],
  '취향': ['취향번호', '고객', '제품', '도정', '찹쌀', '콩 비율', '양(kg)', '소포장', '주기(일)', '판', '확정일'],
  '주문': ['주문번호', '접수번호', '고객', '곡식', '조합', '양(kg)', '곡식 금액', '소포장', '할인율', '할인 사유', '할인액', '배송비', '청구액',
          '상태', '작업일', '받을 날', '입금 기한', '입금 안내 횟수', '입금일', '송장', '피드백', '받는 분', '상태 바뀐 시각', '메모', '정기', '시험',
          '결제수단', '결제 키', '결제 상태', '결제 시각', '취소 금액', '결제 비밀', '가상계좌', '경로'],
  '연락': ['시각', '고객', '주문', '경로', '문자틀', '종류', '결과'],
  '곡식': ['코드', '제품', '상태', '부르는 이름', '한 줄', '맛', '요리', '보관', '수확', '단위(kg)', '가격(원/kg)', '단백질(g/100g)',
          '사진', '출처', '공개'],
  '재고': ['곡식', '남은 양(kg)', '예약된 양(kg)', '기준일'],
  '작업 달력': ['날짜', '도정 가능', '하루 최대량(kg)', '배정된 양(kg)', '메모'],
  '문자틀': ['코드', '상태', '문구', '짧은 판', '종류'],
  '연락 규칙': ['규칙', '때(조건)', '받는 단계', '문자틀', '종류', '하루 시간대', '월 상한', '켬/끔'],
  '설정': ['이름', '켬/끔', '값', '설명', '공개'],
  '처리 기록': ['시각', '무엇', '대상', '결과', '실패 이유'],
  '인증': ['번호', '용도', '인증번호', '보낸 시각', '틀린 횟수', '확인'],
  '로그인': ['토큰', '고객', '만든 시각', '만료']
};

// 홈페이지가 읽는 스위치(설계 7장). 처음엔 전부 끔.
var SWITCHES = ['order', 'survey', 'notify', 'kakao_bot', 'sms_send', 'bank_match', 'loyalty', 'refill_alert',
                'live_stock', 'countdown', 'doodoo_rice', 'doodoo_misu', 'member', 'pay_pg'];

var DEFAULT_SETTINGS = [
  ['order', '끔', '', '주문 받기', 'Y'], ['survey', '끔', '', '취향 설문(보류)', 'Y'], ['notify', '끔', '', '소식 받기', 'Y'],
  ['kakao_bot', '끔', '', '카톡 챗봇', 'Y'], ['sms_send', '끔', '', '문자 실제 발송(끄면 연락 시트에 「보류」만)', 'Y'],
  ['bank_match', '끔', '', '입금 대조', 'Y'], ['loyalty', '끔', '', '소식 동의자 3번째 주문 할인(구매금액의 10%, 배송비 제외)', 'Y'],
  ['member', '끔', '', '간편 회원(휴대폰 인증) — 문자 업체 연결 뒤 켬', 'Y'],
  ['pay_pg', '끔', '', '토스페이먼츠 결제 — 시크릿 키는 스크립트 속성 TOSS_SECRET_KEY 에만', 'Y'],
  ['pay_bank', '켬', '', '농협 통장 직접 입금(문자·전화·카톡·대량 주문만)', ''],
  ['refill_alert', '끔', '', '떨어질 때쯤 알림', 'Y'], ['live_stock', '끔', '', '남은 양 실시간 표시', 'Y'],
  ['countdown', '끔', '', '오픈 예고', 'Y'], ['doodoo_rice', '끔', '', '두두쌀', 'Y'], ['doodoo_misu', '끔', '', '두두미숫가루(보류)', 'Y'],
  ['pay_days', '', 3, '입금 기한(일). 지나면 안내 1회, 다시 지나면 자동 취소', ''],
  ['lead_days', '', 1, '확정 뒤 가장 빠른 작업일까지(일)', ''],
  ['ship_days', '', 2, '작업일 뒤 받을 날까지(일)', ''],
  ['feedback_days', '', 3, '받은 뒤 밥맛 묻기까지(일)', ''],
  ['loyalty_every', '', 3, '소식 동의자 할인 회차 간격(3이면 3·6·9번째)', ''],
  ['loyalty_rate', '', 10, '회차 할인율(%) — 구매금액(주문 상품 금액, 배송비 제외) 기준 · 임시값', ''],
  ['ho_seats', '', 100, '두두 ○호 번호를 주는 첫 고객 수', ''],
  ['ho_rate', '', 10, '○호 고객 모든 주문 할인율(%) — 구매금액(배송비 제외) 기준 · 회차 할인과 겹치지 않음', ''],
  ['pay_hold_minutes', '', 30, '결제창에서 돌아오지 않은 주문의 재고를 풀어 주는 시간(분)', ''],
  ['login_days', '', 30, '로그인 상태 유지(일)', ''],
  ['code_per_day', '', 5, '인증번호 — 번호 하나당 하루 횟수', ''],
  ['login_fail_max', '', 5, '비밀번호 틀림 — 이만큼이면 10분 잠금', ''],
  ['subpack_fee', '', '10:1000,20:2000', '소포장 추가 금액(포장 kg:원)', ''],
  ['shipping_fee', '', '', '배송비(원) 【대표】 — 0이면 무료 배송', ''],
  ['account', '', '', '판매 통장 【대표】 — 하나만: 문자·전화·카톡·지인 주문 입금 + 토스 정산 계좌. 등기 뒤 법인 통장으로 바꿀 땐 여기 한 곳(+ 토스 정산 계좌·자동 전달 앱)', ''],
  ['waitlist', '끔', '', '재고가 모자란 문자·전화·카톡 주문을 대기 줄에 둠(끄면 바로 품절 취소 — 2026-11-08 대표 결정)', ''],
  ['tpl_ver', '', 0, '문자틀 판(자동) — 문안 판이 오르면 setup이 문구를 한 번 새로 씀', ''],
  ['rules_ver', '', 0, '연락 규칙 판(자동) — 설계 판이 오르면 setup이 켬/끔을 한 번 맞춤', ''],
  ['refill_lead_days', '', 5, '예상 소진일 며칠 전에 알림', ''],
  ['default_cycle_days', '', 30, '취향에 주기가 없을 때 예상 소진 날수', ''],
  ['rest_days', '', 60, '예상 소진일 뒤 이만큼 주문 없으면 쉬는 고객', ''],
  ['dup_minutes', '', 10, '같은 연락처·같은 내용이 이 안에 또 오면 중복', ''],
  ['notice_hours', '', '8~21', '안내 문자 시간대(시~시)', ''],
  ['ad_hours', '', '9~20', '광고 보내는 시간대(시~시)', ''],
  ['ad_monthly_max', '', 2, '사람마다 한 달 광고 상한', ''],
  ['recall_per_hour', '', 5, '지난 주문 불러오기 — 번호 하나당 한 시간 횟수', ''],
  ['lookup_fail_per_hour', '', 5, '내 주문 조회 — 번호 하나당 한 시간에 틀릴 수 있는 횟수', ''],
  ['min_mill_kg', '', 10, '홈페이지 도정일: 이만큼 자리가 남은 가장 가까운 도정일', ''],
  ['regular_ahead_days', '', 3, '정기 주문: 다음 도정일 며칠 전에 다음 예약을 만듦', ''],
  ['last_run', '', '', '규칙 일꾼이 마지막으로 돈 시각(자동)', '']
];

// 문자틀 — 문안 부록 1~3 그대로(2026-11-08 실제 쇼핑몰 알림톡 틀: 제목 → 인사 → 한 문장 → ■ 항목 → 다음 안내 → 감사).
// 「<br>」은 \n. {이름} 등은 장부 값으로 채운다. 「■」 줄의 값이 비어도 되는 칸(도정일·밥 짓기 한 줄 등)이면 그 줄을 빼고 보낸다.
// 짧은 판은 대표 결정(2026-11-08)으로 「밥맛」「다음조합」만 답장 판, 나머지는 「같음」 — 문자로 대체 발송될 때도 같은 글이 장문 문자로.
// 거래 안내는 코드가 맨 앞에 「[두두농장] 」, 끝에 꼬리(TAIL)를 붙인다. 「지인발송」은 붙이지 않는다(NO_FRAME). 알림톡일 때 [두두농장]을 빼는 것은 6단계 발송 연결 때.
var ITEM_LINE = '■ 주문상품 : {곡식} {양} ({조합})';
var THANKS = '이용해 주셔서 감사합니다.';
function tpl_() { return Array.prototype.slice.call(arguments).join('\n'); }
var DEFAULT_TEMPLATES = [
  ['접수', '확정', tpl_('주문 접수 안내', '', '안녕하세요, {이름}님.', '주문이 접수되었습니다.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '', '남은 양을 확인한 뒤 확정 안내를 드리겠습니다.', THANKS), '같음', '안내'],
  ['입금안내', '확정', tpl_('주문 접수 · 입금 안내', '', '안녕하세요, {이름}님.', '주문이 접수되었습니다. 아래 계좌로 입금해 주세요.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '■ 입금계좌 : {은행} {계좌번호}', '■ 입금금액 : {금액}원', '■ 입금기한 : {기한}', '', '입금이 확인되면 다시 안내드리겠습니다.', THANKS), '같음', '안내'],
  ['결제완료', '확정', tpl_('결제 완료 안내', '', '안녕하세요, {이름}님.', '주문하신 상품의 결제가 완료되었습니다.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '■ 결제금액 : {금액}원{할인 줄}', '■ 도정일 : {도정일}', '', '상품이 발송되면 다시 안내드리겠습니다.', THANKS), '같음', '안내'],
  ['상담접수', '확정', tpl_('문의 접수 안내', '', '안녕하세요, {이름}님.', '대량 주문·협력 문의가 접수되었습니다.', '확인 후 연락드리겠습니다.'), '같음', '안내'],
  ['확정', '확정', tpl_('주문 접수 · 입금 안내', '', '안녕하세요, {이름}님.', '주문이 접수되었습니다. 아래 계좌로 입금해 주세요.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '■ 입금계좌 : {계좌}', '■ 입금금액 : {금액}원{할인 줄}', '■ 입금기한 : {기한}', '■ 도정일 : {도정일}', '', '입금이 확인되면 다시 안내드리겠습니다.', THANKS), '같음', '안내'],
  ['품절', '확정', tpl_('주문 취소 안내 (품절)', '', '안녕하세요, {이름}님.', '준비된 양이 모두 소진되어 주문이 취소되었습니다.', '', ITEM_LINE, '', '죄송합니다. 다음 도정분이 준비되면 홈페이지에서 다시 주문하실 수 있습니다.'), '같음', '안내'],
  ['확정·환불확인', '확정', '※ 주문 후 도정하는 상품으로, 도정 후에는 단순 변심 반품이 어렵습니다(도정 전 취소는 전액 환불). 입금하시면 이 내용에 동의하신 것으로 봅니다.', '같음', '안내'],
  ['환불확인콩', '확정', '※ 보내기 전에는 전액 환불됩니다. 상품에 문제가 있으면 교환·환불해 드립니다. 입금하시면 이 내용에 동의하신 것으로 봅니다.', '같음', '안내'],
  ['첫고객', '확정', '※ {이름}님은 두두 {○호} 고객입니다. 모든 주문에 10% 할인이 적용됩니다.', '같음', '안내'],
  ['대기', '확정', tpl_('주문 대기 안내', '', '안녕하세요, {이름}님.', '준비된 양이 부족해 주문 확정이 늦어지고 있습니다.', '', '■ 주문번호 : {주문번호}', '', '준비되는 대로 순서대로 안내드리겠습니다.'), '같음', '안내'],
  ['대기확정', '확정', tpl_('주문 접수 · 입금 안내', '', '안녕하세요, {이름}님.', '기다리신 주문이 확정되었습니다. 아래 계좌로 입금해 주세요.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '■ 입금계좌 : {계좌}', '■ 입금금액 : {금액}원{할인 줄}', '■ 입금기한 : {기한}', '■ 도정일 : {도정일}', '', '입금이 확인되면 다시 안내드리겠습니다.', THANKS), '같음', '안내'],
  ['입금확인', '확정', tpl_('입금 확인 안내', '', '안녕하세요, {이름}님.', '입금이 확인되었습니다.', '', '■ 주문번호 : {주문번호}', '■ 입금금액 : {금액}원', '■ 도정일 : {도정일}', '', '상품이 발송되면 다시 안내드리겠습니다.'), '같음', '안내'],
  ['입금독촉', '확정', tpl_('입금 요청 안내', '', '안녕하세요, {이름}님.', '주문하신 상품의 입금이 아직 확인되지 않았습니다.', '', '■ 주문번호 : {주문번호}', '■ 입금기한 : {새 기한}', '', '기한까지 입금이 없으면 주문이 자동으로 취소됩니다.'), '같음', '안내'],
  ['자동취소', '확정', tpl_('주문 취소 안내', '', '안녕하세요, {이름}님.', '입금 기한이 지나 주문이 취소되었습니다.', '', '■ 주문번호 : {주문번호}'), '같음', '안내'],
  ['취소확인', '확정', tpl_('주문 취소 안내', '', '안녕하세요, {이름}님.', '요청하신 주문이 취소되었습니다.', '', '■ 주문번호 : {주문번호}', '■ 환불금액 : {금액}원', '■ 환불예정일 : {환불일}'), '같음', '안내'],
  ['찧은날', '확정', tpl_('도정 완료 안내', '', '안녕하세요, {이름}님.', '주문하신 {곡식}을 오늘 도정했습니다.', '', '■ 주문번호 : {주문번호}', ITEM_LINE, '', '발송되면 운송장 번호를 안내드리겠습니다.'), '같음', '안내'],
  ['발송', '확정', tpl_('상품 발송 안내', '', '안녕하세요, {이름}님.', '주문하신 상품이 발송되었습니다.', '', '■ 주문번호 : {주문번호}', '■ 운송장정보 : {택배사} / {송장번호}', '■ 도착예정 : {받을 날}', '', THANKS), '같음', '안내'],
  ['지인발송', '확정', tpl_('{곡식} {양} 오늘 {택배사}로 출발했습니다. 감사합니다.', '송장번호 {송장번호}', '— 최현철'), '같음', '안내'],
  ['늦어짐', '확정', tpl_('도정일 변경 안내', '', '안녕하세요, {이름}님.', '작업 일정으로 도정일이 변경되었습니다.', '', '■ 주문번호 : {주문번호}', '■ 변경 전 : {도정일}', '■ 변경 후 : {새 도정일}', '', '취소를 원하시면 연락 주세요.'), '같음', '안내'],
  ['도착다음날', '확정', tpl_('배송 완료 안내', '', '안녕하세요, {이름}님.', '주문하신 상품이 배송 완료되었습니다.', '{밥 짓기 한 줄}', '', '상품에 문제가 있으면 연락 주세요.'), '같음', '안내'],
  ['밥맛', '확정', tpl_('{이름}님, 두두쌀 밥맛은 어떠셨나요?', '알려 주시면 다음 주문의 찹쌀 비율에 반영하겠습니다. [더 차지게] [그대로] [덜 차지게] [별로였어요]'), '{이름}님, 밥맛은 어떠셨나요? 숫자로 답장 주세요. 1 더 차지게 2 그대로 3 덜 차지게 4 별로였어요', '안내'],
  ['다음조합', '확정', '다음 주문은 찹쌀 {새 비율}로 바꿀까요? [바꾸기] [그대로]', '다음 주문은 찹쌀 {새 비율}로 바꿀까요? 바꾸시려면 「네」라고 답장 주세요.', '안내'],
  ['수신거부', '확정', '(두두농장) {날짜} 소식 받기를 멈췄습니다. 주문 안내 문자는 그대로 갑니다.', '같음', '안내'],
  ['동의확인', '확정', '(두두농장) {이름}님은 {동의한 날} 두두 소식 받기에 동의하셨습니다. 계속 받으시려면 그대로 두시고, 그만 받으시려면 「그만」이라고 답장 주세요.', '같음', '안내'],
  ['떨어질때', '확정', '{이름}님, 지난번 받으신 {양} 쌀이 떨어질 무렵입니다. 같은 조합({조합})으로 다시 주문하시겠어요? [같은 조합으로 주문]', '같음', '광고'],
  ['단골축하', '확정', '{이름}님, 다음({n+1}번째) 주문은 10% 할인됩니다.', '같음', '광고'],
  ['우선예약', '확정', '{이름}님(두두 {○호}), 올해 햅쌀 우선 주문을 시작합니다. {날짜}까지 {이름}님 몫을 남겨 둡니다. [같은 조합으로 주문]', '같음', '광고'],
  ['오픈예고', '확정', '두두 햅쌀 주문을 {날짜} {시각}에 시작합니다. 준비한 양은 {수량}입니다. 소식 받기 고객은 {n}시간 먼저 주문하실 수 있습니다.', '같음', '광고'],
  ['미숫가루', '보류', '{이름}님, 두두미숫가루를 시작했습니다. 콩과 보리 비율을 직접 고르실 수 있습니다. [보기]', '같음', '광고'],
  ['1년', '확정', '{이름}님, 1년 전 오늘 첫 주문을 보내 드렸습니다. 같은 논에서 1년 동안 찍은 영상입니다. [영상 보기]', '같음', '광고'],
  ['안부', '확정', '{이름}님, 두두농장 최현철입니다. 들녘은 {계절 한 줄}. 필요하실 때 연락 주세요.', '같음', '광고']
];
var NO_FRAME = ['지인발송'];   // 머리 [두두농장]·꼬리 없이(대표가 보내는 말투)

// 연락 규칙 — 문안 부록 5. 대표는 켬/끔만. 「하루 시간대」가 「바로」면 밤에도 바로 보낸다(결제 직후 안내).
var DEFAULT_RULES = [
  ['접수', '접수(문자·전화·기록방) — 장부에 올리는 즉시 재고 확인 → 확정 또는 품절 한 통', '모두', '접수', '안내', '08~21시', '', '끔'],
  ['입금 안내', '홈페이지 무통장(가상계좌) 주문', '해당 주문', '입금안내', '안내', '바로', '', '켬'],
  ['결제 완료', '카드·간편결제·휴대폰 결제 승인', '해당 주문(첫 주문이면 첫고객 한 줄)', '결제완료 · 첫고객', '안내', '바로', '', '켬'],
  ['확정', '자동 확정(문자·전화·카톡 주문)', '모두(첫 주문이면 첫고객 한 줄)', '확정 · 첫고객', '안내', '08~21시', '', '켬'],
  ['품절', '재고 모자람(문자·전화·카톡 주문) — 주문 바로 취소', '해당 주문', '품절', '안내', '08~21시', '', '켬'],
  ['대기', '재고 모자람 / 재고 들어옴 — 대기 줄(설정 waitlist 켤 때만)', '해당 주문', '대기 / 대기확정', '안내', '08~21시', '', '끔'],
  ['입금 확인', '입금 맞춤(농협 통장·가상계좌)', '해당 주문', '입금확인', '안내', '08~21시', '', '켬'],
  ['입금 기한', '입금 기한 1차 / 2차(가상계좌는 첫 기한)', '해당 주문', '입금독촉 / 자동취소', '안내', '09~20시', '', '켬'],
  ['고객 취소', '고객 취소(도정 전)', '해당 주문', '취소확인', '안내', '08~21시', '', '켬'],
  ['작업 완료', '작업 완료 — 보내지 않음(2026-11-08)', '해당 주문', '찧은날', '안내', '08~21시', '', '끔'],
  ['송장', '송장 입력', '해당 주문(지인 주문은 「지인발송」)', '발송 / 지인발송', '안내', '08~21시', '', '켬'],
  ['늦어짐', '도정일 위험', '해당 주문(쌀이 든 주문)', '늦어짐', '안내', '08~21시', '', '켬'],
  ['도착 다음 날', '도착 다음 날', '해당 주문', '도착다음날', '안내', '09~20시', '', '켬'],
  ['밥맛', '도착 {피드백 날수}일 뒤', '해당 주문(쌀이 든 주문)', '밥맛 → 다음조합', '안내', '09~20시', '', '켬'],
  ['떨어질 때쯤', '예상 소진일 무렵', '첫 고객·단골(소식 동의 또는 마지막 거래 6개월 안·같은 곡식)', '떨어질때', '광고', '09~20시', '광고 합쳐 2회', '켬'],
  ['단골 축하', '할인 직전 회차(2·5·8번째) 도착 뒤', '단골 · 소식 동의', '단골축하', '광고', '09~20시', '광고 합쳐 2회', '켬'],
  ['수신 거부', '「그만」 답장', '모두', '수신거부', '안내', '바로', '', '켬'],
  ['동의 확인', '소식 동의 2년', '소식 동의', '동의확인', '안내', '09~20시', '2년에 1회', '켬'],
  ['우선 예약', '햅쌀 예약 전', '○호 고객 · 소식 동의', '우선예약', '광고(문자)', '09~20시', '광고 합쳐 2회', '끔'],
  ['오픈 예고', '첫 예약 D-30·7·1', '소식 동의', '오픈예고', '광고(카톡 먼저, 카톡 없는 짧은 판만 문자)', '09~20시', '광고 합쳐 2회', '끔'],
  ['미숫가루', '미숫가루 출시 뒤', '쌀 2회 이상 단골 · 소식 동의', '미숫가루', '광고', '09~20시', '광고 합쳐 2회', '끔'],
  ['1년', '첫 주문 1년', '단골 · 소식 동의', '1년', '광고', '09~20시', '광고 합쳐 2회', '끔'],
  ['안부', '예상 소진일 + 60일', '쉬는 고객 · 소식 동의', '안부', '광고', '09~20시', '1회만(평생)', '켬']
];
var RULES_VER = 2;   // 연락 규칙 켬/끔을 설계대로 한 번 맞출 판(2 = 2026-11-08 접수·대기·찧은날 끔)

var LIVE = ['확정', '입금', '작업', '발송', '도착'];   // 취소·대기·확인필요가 아닌 주문
var TEXT_ROUTES = ['문자', '전화', '카톡'];   // 주문서 체크가 없는 경로 — 확정 끝에 환불 확인 한 줄
function isFriend_(o) { return !!o && o['경로'] === '지인'; }   // 지인 주문(설계 3-1)
var GRAIN_NAME = { rice: '두두쌀', soy: '두두콩' };
var STEPS = ['접수', '확정', '입금 확인', '도정', '발송'];   // 내 주문 진행 단계(문안 03-2c)
var STEP_OF = { '결제대기': 0, '접수': 0, '대기': 0, '확인필요': 0, '확정': 1, '입금': 2, '작업': 3, '발송': 4, '도착': 4 };
var CANCELABLE = ['접수', '대기', '확정', '입금'];   // 도정 전
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
// 시험 일꾼(사본)은 스크립트 속성 BOOK_ID 에 「두두 고객장부 (시험)」 ID를 넣어 그 장부만 연다. 실제 일꾼은 속성 없이 아래 ID.
var BOOK_ID = '1yfEsV8uxlwXRmSt9dTuEMhBDeF09eCtbKlGj3T01xTM';
var bookId_ = null;
function book_() {
  var a = SpreadsheetApp.getActive(); if (a) return a;
  if (bookId_ === null) bookId_ = PropertiesService.getScriptProperties().getProperty('BOOK_ID') || BOOK_ID;
  return SpreadsheetApp.openById(bookId_);
}
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
function one_(name, key, v) { v = String(v); return rows_(name).filter(function (r) { return String(r[key]) === v; })[0] || null; }

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
    var filled = cur.filter(String).length;   // 끝에 새 칸(정기·시험 등)이 생기면 빈 머리칸만 채운다
    var same = cur.slice(0, filled).join('|') === head.slice(0, filled).join('|') && cur.slice(filled).join('') === '';
    if (!same) throw new Error(name + ' 머리줄이 설계와 다릅니다 — 손으로 맞춘 뒤 다시');
    if (filled < head.length) sh.getRange(1, 1, 1, head.length).setValues([head]);
    sh.setFrozenRows(1);
  });
  var first = ss.getSheetByName('시트1') || ss.getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  seed_('설정', DEFAULT_SETTINGS, '이름');
  seed_('문자틀', DEFAULT_TEMPLATES, '코드');
  syncTemplates_();
  syncSettingNotes_();
  seed_('연락 규칙', DEFAULT_RULES, '규칙');
  syncRuleTemplates_();
  log_('setup', '', '끝');
}
// 장부 「문자틀」의 문구·짧은 판·상태는 대표가 고치는 정본이라 평소엔 건드리지 않는다(새 코드만 seed_가 더한다).
// 문안 판(TEMPLATES_VER)이 오를 때만 문구·짧은 판을 한 번 새로 쓴다. 「종류」(안내/광고)는 늘 설계대로 — 광고 표시·수신 동의 검사가 이 칸으로 정해진다.
var TEMPLATES_VER = 2;   // 2 = 2026-11-08 문안 부록 1~3 쇼핑몰 알림톡 틀
function syncTemplates_() {
  var byCode = {}, ver = setting_('tpl_ver'), fresh = ver && Number(ver['값'] || 0) < TEMPLATES_VER;
  DEFAULT_TEMPLATES.forEach(function (t) { byCode[t[0]] = t; });
  rows_('문자틀').forEach(function (r) {
    var t = byCode[r['코드']]; if (!t) return;
    var ch = false;
    if (fresh && (r['문구'] !== t[2] || r['짧은 판'] !== t[3])) { r['문구'] = t[2]; r['짧은 판'] = t[3]; ch = true; }
    if (r['종류'] !== t[4]) { r['종류'] = t[4]; ch = true; }
    if (ch) save_('문자틀', r);
  });
  if (fresh) { ver['값'] = TEMPLATES_VER; save_('설정', ver); log_('문자틀', '', '문안 판 ' + TEMPLATES_VER + '로 새로 씀'); }
}
// 연락 규칙 — 때·받는 단계·문자틀·종류·시간대·상한은 늘 설계대로. 켬/끔은 대표 것이라 그대로 두되, 설계 판(RULES_VER)이 오를 때 한 번 맞춘다.
function syncRuleTemplates_() {
  var byKey = {}, ver = setting_('rules_ver'), fresh = ver && Number(ver['값'] || 0) < RULES_VER;
  DEFAULT_RULES.forEach(function (r) { byKey[r[0]] = r; });
  var cols = SCHEMA['연락 규칙'];
  rows_('연락 규칙').forEach(function (r) {
    var d = byKey[r['규칙']]; if (!d) return;
    var ch = false;
    cols.forEach(function (h, i) { if (i === 0 || (h === '켬/끔' && !fresh)) return; if (r[h] !== d[i]) { r[h] = d[i]; ch = true; } });
    if (ch) save_('연락 규칙', r);
  });
  if (fresh) { ver['값'] = RULES_VER; save_('설정', ver); log_('연락 규칙', '', '설계 판 ' + RULES_VER + '로 켬/끔 맞춤'); }
}
// 설정 시트의 「설명」 칸도 설계와 같게(켬/끔·값은 대표 것이라 그대로).
function syncSettingNotes_() {
  var byKey = {};
  DEFAULT_SETTINGS.forEach(function (s) { byKey[s[0]] = s; });
  rows_('설정').forEach(function (r) { var s = byKey[r['이름']]; if (s && r['설명'] !== s[3]) { r['설명'] = s[3]; save_('설정', r); } });
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
// 장부의 「재고」「작업 달력」을 손으로 고치면 대기 주문을 바로 다시 본다(onBookEdit).
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['runScheduled', 'onBookEdit'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runScheduled').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('onBookEdit').forSpreadsheet(book_()).onEdit().create();
  log_('installTriggers', '', '10분마다 · 재고·작업 달력·송장 고치면 바로');
}

// 장부를 손으로 고칠 때(현황판·장부 직접 입력) 바로 반응한다 — 정해진 간격 확인을 쓰지 않는다(설계 3장 깨우는 방식).
// · 「재고」「작업 달력」 → 대기 주문 다시 봄(대기 줄을 켰을 때)
// · 「주문」 송장 칸 → 「발송」(지인 주문은 「지인발송」) 문자 바로(설계 3-3). 택배사 송장 자동 연동(진행표 6-2)도 이 칸을 채우면 같은 길로 간다.
function onBookEdit(e) {
  var sh = e && e.range ? e.range.getSheet() : null, name = sh ? sh.getName() : '';
  if (name === '주문') return invoiceEdited_(e);
  if (['재고', '작업 달력'].indexOf(name) < 0) return;
  var waiting = rows_('주문').filter(function (o) { return o['상태'] === '대기'; }).length;
  if (!waiting) return;
  withLock_(function () {
    try { processWaitlist(); log_('재고 고침', name, '대기 ' + waiting + '건 다시 봄'); }
    catch (err) { log_('재고 고침', name, '실패', String(err)); }
  });
}
// 송장 칸 형식: 「택배사 송장번호」(예: 「CJ대한통운 1234567890」). 도정·작업 전이어도 송장이 들어오면 발송으로 본다.
function invoiceEdited_(e) {
  var col = SCHEMA['주문'].indexOf('송장') + 1, r = e.range;
  if (col < r.getColumn() || col > r.getLastColumn()) return;
  withLock_(function () {
    for (var row = Math.max(2, r.getRow()); row <= r.getLastRow(); row++) {
      var o = rows_('주문').filter(function (x) { return x._row === row; })[0];
      if (!o || !String(o['송장']).trim() || ['발송', '도착', '취소'].indexOf(o['상태']) >= 0) continue;
      try { setStatusIn_(o, one_('고객', '고객번호', o['고객']), '발송', {}); }
      catch (err) { log_('송장 입력', o['주문번호'], '실패', String(err)); }
    }
  });
}

// ───────── 입구: 접수 ─────────
// 홈페이지 장바구니: { kind:'order', mode:'order'|'inquiry', 경로, 이름, 연락처, 주소, 받는 분:{이름,연락처,주소}|null,
//                     요청사항, test(시범 운행이면 true), items:[{grain:'rice'|'soy', glutinous, size, subpack, repeat, text}], 동의:['소식','환불확인'] }
// 대량 상담:          { kind:'bulk', 경로:'상담', 이름, 연락처, 상호, 지역, 유형, 곡식, 찹쌀, 양, 방식, 시작, 포장, 요청사항, 동의 }
// 문자·전화·기록방:   { 경로:'문자'|'전화'|'카톡', 원문, 이름, 연락처, mode:'order', items:[…] } — 클로드가 정리해 넣는다
function intake(p) {
  return withLock_(function () {
    var t = now_();
    var tel = phone_(p['연락처']);
    var route = p['경로'] || '홈페이지';
    var raw = p['원문'] || JSON.stringify(p);
    var test = p.test ? 'Y' : '';   // 시범 운행 — 끝나면 purgeTest()로 지운다
    var rec = append_('접수', { '접수번호': nextId_('접수', 'R', 5), '시각': t, '경로': route, '원문': raw,
                                '이름': p['이름'] || '', '연락처': tel, '처리상태': '새로', '시험': test });
    if (!tel) { rec['처리상태'] = '확인필요'; rec['메모'] = '연락처 없음'; save_('접수', rec); log_('접수', rec['접수번호'], '확인필요', '연락처 없음'); return { ok: false, 접수번호: rec['접수번호'] }; }

    var dupMin = Number(val_('dup_minutes', 10));
    var dup = rows_('접수').filter(function (r) {
      return r._row !== rec._row && phone_(r['연락처']) === tel && r['원문'] === raw && (t - toDate_(r['시각'])) <= dupMin * 60000;
    })[0];
    if (dup) { rec['처리상태'] = '중복'; rec['메모'] = dup['접수번호'] + '와 같음 — 확인필요'; save_('접수', rec); log_('접수', rec['접수번호'], '중복', dup['접수번호']); return { ok: true, 중복: true, 접수번호: rec['접수번호'] }; }

    var c = customer_(p, tel, t, route, test);
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
                                 '메모': p['요청사항'] || '', '정기': regularItems_(items).length ? 'Y' : '', '시험': test, '경로': route });
        rec['연결 주문'] = o['주문번호'];
        res['주문번호'] = o['주문번호'];
        if (route === '지인') res['상태'] = friendOrder_(o, p);
        else {
          if (TEXT_ROUTES.indexOf(route) >= 0) send_('접수', c, o);   // 연락 규칙 「접수」 끔(2026-11-08) — 켜면 다시 감
          res['상태'] = confirm_(o, c);
        }
        res['도정일'] = o['작업일'] ? ymd_(o['작업일']) : (millDate_() || '');
        if (o['청구액'] !== '' && o['청구액'] !== undefined) res['청구액'] = Number(o['청구액']);
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
function customer_(p, tel, t, route, test) {
  var type = p.kind === 'bulk' ? (BULK_TYPE[p['유형']] || '가정') : route === '지인' ? '지인' : (p['유형'] || '가정');
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
                           '메모': p['상호'] ? '상호 ' + p['상호'] : '', '시험': test || '' });
}

function saveTaste_(cid, it, t) {
  var prev = rows_('취향').filter(function (r) { return r['고객'] === cid && r['제품'] === it.grain; });
  append_('취향', { '취향번호': nextId_('취향', 'T', 5), '고객': cid, '제품': it.grain, '도정': it.grain === 'rice' ? '백미' : '',
                    '찹쌀': it.grain === 'rice' ? Number(it.glutinous || 0) : '', '양(kg)': Number(it.size), '소포장': it.subpack ? 'Y' : '',
                    '주기(일)': it.repeat && it.repeat !== 'once' ? Number(it.repeat) : '', '판': prev.length + 1, '확정일': t });
}

function orderNo_() {   // 주문번호 — 짧은 숫자(1001부터 차례로). 토스에는 doodoo- 를 붙여 보낸다(토스 주문번호는 6자 이상)
  var max = 1000;
  rows_('주문').forEach(function (r) { var n = Number(r['주문번호']); if (n > max) max = n; });
  return max + 1;
}
function tossId_(no) { return 'doodoo-' + no; }
function noOf_(id) { return String(id || '').trim().replace(/^doodoo-/i, ''); }

// ───────── 주문 품목 ─────────
function items_(o) { try { var a = JSON.parse(o['조합']); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function qty_(it) { return Math.max(1, Math.round(Number(it.qty) || 1)); }
function totalKg_(items) { return items.reduce(function (s, it) { return s + Number(it.size) * qty_(it); }, 0); }
function millKg_(items) { return items.filter(function (it) { return it.grain === 'rice'; }).reduce(function (s, it) { return s + Number(it.size) * qty_(it); }, 0); }
function itemText_(it) {
  var parts = [GRAIN_NAME[it.grain]];
  if (it.grain === 'rice') parts.push(Number(it.glutinous) ? '찹쌀 ' + it.glutinous + '%' : '멥쌀만');
  parts.push(it.size + 'kg');
  if (it.subpack) parts.push('소포장');
  if (qty_(it) > 1) parts.push('× ' + qty_(it));
  return parts.join(' ');
}
function grainsText_(items) { return items.map(itemText_).join(', '); }
function regularItems_(items) { return items.filter(function (it) { return it.repeat && it.repeat !== 'once' && Number(it.repeat) > 0; }); }
function byGrain_(items) { var m = {}; items.forEach(function (it) { m[it.grain] = (m[it.grain] || 0) + Number(it.size) * qty_(it); }); return m; }

// ───────── 할인 (설계 4·9장) ─────────
// ○호 고객(전체 첫 ho_seats명)은 모든 주문 ho_rate%. 아니면 소식 받기에 동의한 적이 있으면 loyalty_every번째마다 loyalty_rate%.
// 소식 받기를 그만둬도 그때까지 센 횟수와 할인은 그대로(법검토 1-8). 기준은 구매금액(주문 상품 금액, 배송비 제외), 둘은 겹치지 않는다.
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
  if (why && !on_('waitlist')) {   // 대기 줄 끔(2026-11-08) — 주문 바로 취소 + 「품절」 한 통
    o['상태'] = '취소'; o['상태 바뀐 시각'] = t; o['메모'] = '품절 — ' + why; save_('주문', o);
    send_('품절', c, o);
    log_('확정', o['주문번호'], '품절 취소', why);
    return '품절';
  }
  if (why) {
    var first = o['상태'] !== '대기';
    if (first) { o['상태'] = '대기'; o['상태 바뀐 시각'] = t; }
    if (first || o['메모'] !== why) { o['메모'] = why; save_('주문', o); }
    if (first) send_('대기', c, o);
    log_('확정', o['주문번호'], '대기', why);
    return '대기';
  }
  var fromWait = o['상태'] === '대기';
  reserve_(o, need, day, mill, stocks);
  var r = price_(o, c, grains);
  o['입금 기한'] = addDays_(t, val_('pay_days', 3)); o['입금 안내 횟수'] = 0;
  o['상태'] = '확정'; o['상태 바뀐 시각'] = t; o['메모'] = '';
  save_('주문', o);
  var firstEver = settle_(c, r.n, t);
  var route = o['경로'] || (one_('접수', '접수번호', o['접수번호']) || {})['경로'];
  var refund = TEXT_ROUTES.indexOf(route) >= 0 ? (mill > 0 ? '확정·환불확인' : '환불확인콩') : '';   // 쌀이 들면 쌀 기준
  send_(fromWait ? '대기확정' : '확정', c, o, { append: [refund, firstEver && c['두두 호'] ? '첫고객' : ''] });
  log_('확정', o['주문번호'], '확정', r.why);
  return '확정';
}

// 지인 주문(설계 3-1) — 금액은 대표가 적은 값 그대로(가격표·할인·○호·회차에서 빠짐). 재고는 바로 잡고, 모자라면 확인필요(문자 없음).
// 입금 기한·자동 취소 없음. 고객에게 가는 문자는 송장 입력 때 「지인발송」 한 통뿐(send_ 가 나머지를 거른다).
function friendOrder_(o, p) {
  var t = now_(), items = items_(o), need = byGrain_(items), mill = millKg_(items);
  var amt = Number(String(p['금액'] === undefined ? '' : p['금액']).replace(/[^\d]/g, ''));
  o['곡식 금액'] = amt || ''; o['소포장'] = 0; o['할인율'] = 0; o['할인 사유'] = ''; o['할인액'] = 0; o['배송비'] = 0; o['청구액'] = amt || '';
  var why = shortage_(items);
  if (!amt) why = why || '금액 없음';
  if (why) {
    o['상태'] = '확인필요'; o['상태 바뀐 시각'] = t; o['메모'] = '지인 주문 — ' + why; save_('주문', o);
    log_('지인 주문', o['주문번호'], '확인필요', why);
    return '확인필요';
  }
  reserve_(o, need, mill > 0 ? workDay_(mill, t) : { 날짜: day_(addDays_(t, val_('lead_days', 1))), _none: true }, mill);
  o['상태'] = '확정'; o['상태 바뀐 시각'] = t; o['입금 기한'] = ''; o['입금 안내 횟수'] = 0;
  save_('주문', o);
  log_('지인 주문', o['주문번호'], '확정', amt + '원');
  return '확정';
}

// 남은 양·도정일 자리 확인(결제 전 두 번 — 주문서 진입·결제 단추). 모자라면 이유 글, 되면 ''.
function shortage_(items) {
  var need = byGrain_(items), stocks = rows_('재고'), grains = rows_('곡식'), why = '';
  Object.keys(need).forEach(function (g) {
    if (why) return;
    var gr = grains.filter(function (r) { return r['코드'] === g; })[0];
    var s = stocks.filter(function (r) { return r['곡식'] === g; })[0];
    if (!gr) why = '곡식 표에 없음(' + g + ')';
    else if (!s) why = '재고 줄 없음(' + g + ')';
    else if (Number(s['남은 양(kg)'] || 0) - Number(s['예약된 양(kg)'] || 0) < need[g]) why = '남은 양 부족(' + g + ')';
  });
  var mill = millKg_(items);
  if (!why && mill > 0 && !workDay_(mill, now_())) why = '작업일 없음(하루 최대량·도정 가능일 확인)';
  return why;
}
// 재고 예약·작업 달력 배정
function reserve_(o, need, day, mill, stocks) {
  (stocks || rows_('재고')).forEach(function (s) { if (need[s['곡식']]) { s['예약된 양(kg)'] = Number(s['예약된 양(kg)'] || 0) + need[s['곡식']]; save_('재고', s); } });
  if (!day._none) { day['배정된 양(kg)'] = Number(day['배정된 양(kg)'] || 0) + mill; save_('작업 달력', day); }
  o['작업일'] = day_(day['날짜']); o['받을 날'] = addDays_(o['작업일'], val_('ship_days', 2));
}
// 금액 — 할인은 구매금액(주문 상품 금액 = 곡식 + 소포장, 배송비 제외)의 10%. 첫 주문이고 ○호 자리가 남으면 ○호 할인.
function price_(o, c, grains) {
  var items = items_(o), fee = pairs_(val_('subpack_fee', '')), price = {};
  (grains || rows_('곡식')).forEach(function (g) { price[g['코드']] = Number(g['가격(원/kg)'] || 0); });
  var grainSum = items.reduce(function (s, it) { return s + price[it.grain] * Number(it.size) * qty_(it); }, 0);
  var subSum = items.reduce(function (s, it) { return s + (it.subpack ? Number(fee[Number(it.size)] || 0) * qty_(it) : 0); }, 0);
  var n = liveCount_(c['고객번호']) + 1;
  var d = discount_(c, n);
  if (!d.rate && !c['두두 호'] && n === 1 && seatsLeft_() > 0) d = { rate: Number(val_('ho_rate', 10)), why: '두두 ' + nextHo_() + '호 고객' };
  o['곡식 금액'] = grainSum; o['소포장'] = subSum; o['할인율'] = d.rate; o['할인 사유'] = d.why;
  o['할인액'] = Math.round((grainSum + subSum) * d.rate / 100);
  o['배송비'] = Number(val_('shipping_fee', 0)) || 0;
  o['청구액'] = grainSum + subSum - o['할인액'] + o['배송비'];
  return { n: n, why: d.why };
}
// 주문이 맺어진 때 고객 칸(○호·첫 주문일·회차)
function settle_(c, n, t) {
  var firstEver = !c['두두 호'] && liveCount_(c['고객번호']) <= 1 && !c['첫 주문일'];
  if (firstEver && seatsLeft_() > 0) c['두두 호'] = nextHo_();
  if (firstEver) c['첫 주문일'] = t;
  c['마지막 주문일'] = t;
  c['단골 회차'] = n;
  save_('고객', c);
  return firstEver;
}

function workDay_(qty, t) { return workDayFrom_(qty, addDays_(t, val_('lead_days', 1))); }
function workDayFrom_(qty, fromDate) {
  var from = day_(fromDate);
  return rows_('작업 달력')
    .filter(function (d) {
      return d['도정 가능'] === '가능' && day_(d['날짜']) >= from &&
        Number(d['배정된 양(kg)'] || 0) + qty <= Number(d['하루 최대량(kg)'] || 0);
    })
    .sort(function (a, b) { return toDate_(a['날짜']) - toDate_(b['날짜']); })[0] || null;
}

function liveCount_(cid) {
  return rows_('주문').filter(function (r) { return r['고객'] === cid && LIVE.indexOf(r['상태']) >= 0 && !isFriend_(r); }).length;   // 지인 주문은 회차·○호에서 빠진다
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
  // 결제창에서 돌아오지 않은 주문 — 재고·작업 달력 자리를 풀어 준다(문자 없음)
  rows_('주문').filter(function (o) { return o['상태'] === '결제대기' && toDate_(o['입금 기한']) < t; })
    .forEach(function (o) { o['결제 상태'] = '안 함'; cancel_(o, '결제 안 함'); });
  rows_('주문').filter(function (o) { return o['상태'] === '확정' && !isFriend_(o) && o['입금 기한'] && toDate_(o['입금 기한']) < t; })
    .forEach(function (o) {
      var c = one_('고객', '고객번호', o['고객']);
      if (o['결제수단'] === '가상계좌') {   // PG 가상계좌는 기한이 지나면 계좌가 닫힌다 → 바로 자동 취소
        o['결제 상태'] = '취소'; cancel_(o, '가상계좌 입금 기한 지남');
        send_('자동취소', c, o);
        return;
      }
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
  if (['확정', '입금', '결제대기'].indexOf(o['상태']) >= 0) {
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
    var o = one_('주문', '주문번호', orderNo);
    if (!o) { log_('상태', orderNo, '실패', '주문 없음'); return false; }
    return setStatusIn_(o, one_('고객', '고객번호', o['고객']), status, extra || {});
  });
}
function setStatusIn_(o, c, status, extra) {
  var orderNo = o['주문번호'];
  return (function () {
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
      o['송장'] = [extra['택배사'], extra['송장']].filter(function (v) { return v && String(v).trim(); }).join(' ') || o['송장'];
      var need = byGrain_(items_(o));
      rows_('재고').forEach(function (s) {
        var q = need[s['곡식']]; if (!q) return;
        s['남은 양(kg)'] = Number(s['남은 양(kg)']) - q; s['예약된 양(kg)'] = Math.max(0, Number(s['예약된 양(kg)']) - q); save_('재고', s);
      });
    }
    o['상태'] = status; o['상태 바뀐 시각'] = t; save_('주문', o);
    var tpl = { '입금': '입금확인', '작업': millKg_(items_(o)) > 0 ? '찧은날' : '', '발송': isFriend_(o) ? '지인발송' : '발송' }[status];   // 찧은날은 연락 규칙 끔(2026-11-08)
    if (tpl) send_(tpl, c, o, extra);
    if (status === '도착') { c['예상 소진일'] = addDays_(t, cycleDays_(c['고객번호'])); save_('고객', c); }
    log_('상태', orderNo, status);
    return true;
  })();
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
    var n = rows_('주문').filter(function (r) { return r['고객'] === o['고객'] && LIVE.indexOf(r['상태']) >= 0 && !isFriend_(r) && r._row <= o._row; }).length;   // 이 주문이 몇 번째였나
    if (!c['두두 호'] && n % every === every - 1 && today >= addDays_(arrived, 1) && !sentEver_(c['고객번호'], '단골축하', o['주문번호'])) send_('단골축하', c, o, { 'n+1': n + 1 });
  });
}
function detectLate() {
  var today = day_(now_());
  rows_('주문').filter(function (o) { return ['확정', '입금'].indexOf(o['상태']) >= 0 && o['작업일'] && millKg_(items_(o)) > 0 && day_(o['작업일']) < today; })
    .forEach(function (o) {
      var c = one_('고객', '고객번호', o['고객']);
      if (sentEver_(c['고객번호'], '늦어짐', o['주문번호'])) return;
      var d = workDay_(millKg_(items_(o)), now_());
      send_('늦어짐', c, o, { '새 도정일': d ? md_(d['날짜']) : '' });
      o['메모'] = '도정일 위험 — 늦어짐 안내'; save_('주문', o);
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
// 연락 규칙 「하루 시간대」가 「바로」면 시간대를 보지 않는다(결제 직후 안내·수신거부).
// extra.append: 같은 문자 끝에 붙일 문자틀 코드들(첫고객·확정·환불확인·환불확인콩). extra.unpaid: 입금 전 취소 — 환불 줄을 뺀다.
function send_(code, c, o, extra) {
  if (!c) return;
  extra = extra || {};
  var tpl = one_('문자틀', '코드', code);
  var rule = rows_('연락 규칙').filter(function (r) { return String(r['문자틀']).split(/\s*[\/·→]\s*/).indexOf(code) >= 0; })[0];
  var rec = { '시각': now_(), '고객': c['고객번호'], '주문': o ? o['주문번호'] : '', '경로': '문자', '문자틀': code,
              '종류': tpl ? tpl['종류'] : '', '결과': '' };
  var ad = tpl && tpl['종류'] === '광고';
  var gift = o && o['받는 분'];
  var friend = o ? isFriend_(o) : c['유형'] === '지인';
  if (!tpl) rec['결과'] = '건너뜀: 문자틀 없음';
  else if (friend && code !== '지인발송') rec['결과'] = '건너뜀: 지인 주문(지인발송만)';
  else if (tpl['상태'] === '보류') rec['결과'] = '건너뜀: 문자틀 보류';
  else if (rule && rule['켬/끔'] !== '켬') rec['결과'] = '건너뜀: 규칙 끔';
  else if (ad && c['수신 거부'] === 'Y') rec['결과'] = '건너뜀: 수신 거부';
  else if (ad && gift) rec['결과'] = '건너뜀: 선물 받는 분';
  else if (ad && !adOk_(c)) rec['결과'] = '건너뜀: 광고 조건(소식 동의·시간대·월 상한)';
  else if (c['문자 판'] === '짧은 판' && tpl['짧은 판'] === '') rec['결과'] = '건너뜀: 짧은 판 없음';
  else {
    var text = compose_(tpl, c, o, extra);
    var blank = text.match(/\{[^}]+\}/g);
    var now = code === '수신거부' || (rule && rule['하루 시간대'] === '바로');
    var span = hours_(val_(ad ? 'ad_hours' : 'notice_hours', ad ? '9~20' : '8~21'), ad ? 9 : 8, ad ? 20 : 21);
    var h = now_().getHours();
    if (blank) rec['결과'] = '확인필요: 빈 값 ' + blank.join(' ') + ' — ' + text;
    else if (!now && (h < span[0] || h >= span[1])) rec['결과'] = '대기: 시간대 — ' + text;
    else rec['결과'] = (on_('sms_send') ? '보낼 차례(6단계 연결 전)' : '보류(sms_send 끔)') + ' — ' + text;
  }
  append_('연락', rec);
}

function compose_(tpl, c, o, extra) {
  var short = c['문자 판'] === '짧은 판';
  var body = function (t) { return short && t['짧은 판'] && t['짧은 판'] !== '같음' ? t['짧은 판'] : t['문구']; };
  var parts = [body(tpl)];
  (extra.append || []).filter(String).forEach(function (code) { var t = one_('문자틀', '코드', code); if (t) parts.push(body(t)); });
  var joined = parts.join('\n\n');
  if (extra.unpaid) joined = joined.split('\n').filter(function (l) { return l.indexOf('환불') < 0; }).join('\n');   // 입금 전 취소면 환불 줄을 뺀다
  var text = fill_(joined, c, o, extra);
  if (/^\(두두농장\)/.test(text) || NO_FRAME.indexOf(tpl['코드']) >= 0) return text;
  return tpl['종류'] === '광고' ? '(광고) 두두농장(모아온)\n' + text + '\n무료 수신거부: 「그만」 답장' : '[두두농장] ' + text + '\n\n' + TAIL;
}

// 값이 null 이면 그 칸이 든 줄을 통째로 뺀다(콩만 담은 주문의 「■ 도정일」, 받기 전의 {밥 짓기 한 줄}).
// must 칸이 '' 이면 보내지 않고 확인필요(계좌가 비었을 때 등).
function fill_(text, c, o, extra) {
  var map = { '이름': c['이름'], '○호': c['두두 호'] ? c['두두 호'] + '호' : '', '계좌': val_('account', ''), '피드백 날수': val_('feedback_days', 3),
              '밥 짓기 한 줄': null };
  if (o) {
    var items = items_(o), rice = items.filter(function (it) { return it.grain === 'rice'; })[0];
    map['곡식'] = o['곡식']; map['금액'] = o['청구액'] === '' ? '' : Number(o['청구액']).toLocaleString('ko-KR');
    map['조합'] = rice ? (Number(rice.glutinous) ? '찹쌀 ' + rice.glutinous + '%' : '멥쌀만') : '';
    map['양'] = rice ? rice.size + 'kg' : o['양(kg)'] + 'kg';
    map['할인 줄'] = Number(o['할인액']) > 0 ? ' (' + o['할인 사유'] + ' ' + o['할인율'] + '% 할인 ' + Number(o['할인액']).toLocaleString('ko-KR') + '원 적용)' : '';
    map['기한'] = o['입금 기한'] ? md_(o['입금 기한']) : ''; map['새 기한'] = map['기한'];
    map['받을 날'] = o['받을 날'] ? md_(o['받을 날']) : '';
    map['도정일'] = millKg_(items) > 0 ? (o['작업일'] ? md_(o['작업일']) : '') : null;   // 콩만이면 도정 없음 — 줄을 뺀다
    map['주문번호'] = o['주문번호'];
    map['환불일'] = md_(addDays_(now_(), 3));
    var inv = String(o['송장'] || '').split(' ');
    map['택배사'] = inv.length > 1 ? inv[0] : ''; map['송장번호'] = inv.length > 1 ? inv.slice(1).join(' ') : inv[0];
  }
  Object.keys(extra || {}).forEach(function (k) { if (k !== 'append' && k !== 'unpaid') map[k] = extra[k]; });
  // 장바구니 주문은 품목이 여럿이라 상품 자리에 품목 전체(곡식·조합·양)를 한 번에 쓴다
  if (o) text = String(text || '').split('{곡식} {양} ({조합})').join(o['곡식']).split('{곡식} {조합} {양}').join(o['곡식']).split('{곡식} {양}').join(o['곡식']);
  var must = ['이름', '계좌', '은행', '계좌번호', '금액', '기한', '새 기한', '받을 날', '도정일', '새 도정일', '주문번호', '○호', '택배사', '송장번호', '새 비율', '날짜', '동의한 날', '환불일'];   // 비면 보내지 않고 확인필요
  // 「{택배사}로」 — 받침이 있으면(ㄹ 받침 빼고) 「으로」(CJ대한통운으로 · 로젠택배로)
  text = String(text || '').replace(/\{택배사\}로/g, function (m) {
    var v = String(map['택배사'] || ''), code = v ? v.charCodeAt(v.length - 1) - 0xAC00 : -1, jong = code >= 0 && code < 11172 ? code % 28 : 0;
    return jong && jong !== 8 ? '{택배사}으로' : m;
  });
  var lines = String(text || '').split('\n').filter(function (l) {
    return !(l.match(/\{([^}]+)\}/g) || []).some(function (m) { return map[m.slice(1, -1)] === null; });
  });
  return lines.join('\n').replace(/\{([^}]+)\}/g, function (m, k) {
    var v = map[k];
    return v === undefined || v === null || (v === '' && must.indexOf(k) >= 0) ? m : v;
  })
    .replace(/[ \t]+\./g, '.').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
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
  return { switches: sw, grains: grains, seatsLeft: seatsLeft_(), millDate: millDate_() || '', at: now_().toISOString() };
}

// 홈페이지 상품 딱지·주문서·완료에 보이는 도정일 — 작업 달력에서 자리가 남은 가장 가까운 날(확정 때 배정과 같은 규칙).
function millDate_() {
  var d = workDay_(Number(val_('min_mill_kg', 10)), now_());
  return d ? ymd_(d['날짜']) : '';
}

// ───────── 내 주문 (문안 03-2c) — 휴대폰 번호 + 주문번호. 회원가입 없음 ─────────
// 틀리면 번호마다 한 시간 lookup_fail_per_hour 번까지. 받는 분은 이름 첫 글자·주소 시·군까지만.
function findMine_(tel, no) {
  tel = phone_(tel); no = String(no || '').trim().toUpperCase();
  var cache = CacheService.getScriptCache(), key = 'lookup_' + tel, fails = Number(cache.get(key) || 0);
  if (fails >= Number(val_('lookup_fail_per_hour', 5))) return { limited: true };
  var o = tel.length >= 10 && no ? one_('주문', '주문번호', no) : null;
  var c = o ? one_('고객', '고객번호', o['고객']) : null;
  if (!o || !c || phone_(c['연락처']) !== tel) { cache.put(key, String(fails + 1), 3600); return { found: false }; }
  return { found: true, o: o, c: c };
}
function maskName_(s) { s = String(s || ''); return s ? s.charAt(0) + new Array(Math.max(2, s.length)).join('○') : ''; }
function region_(addr) {
  var w = String(addr || '').split(/\s+/), out = [];
  for (var i = 0; i < w.length && i < 2; i++) { out.push(w[i]); if (/(시|군)$/.test(w[i])) return out.join(' '); }
  return out[0] || '';   // 시·군을 못 찾으면 첫 낱말만
}
function orderDate_(o) { var r = one_('접수', '접수번호', o['접수번호']); return r ? ymd_(r['시각']) : ''; }
function recipient_(o, c) {
  var to = null; try { to = o['받는 분'] ? JSON.parse(o['받는 분']) : null; } catch (e) {}
  var addr = to && to['주소'];
  if (!addr) { var r = one_('접수', '접수번호', o['접수번호']); try { addr = JSON.parse(r['원문'])['주소']; } catch (e) {} }
  return { name: maskName_(to ? to['이름'] : c['이름']), region: region_(addr) };
}
function nextRegular_(o) {
  if (o['정기'] !== 'Y') return null;
  var reg = regularItems_(items_(o)); if (!reg.length) return null;
  var cycle = Math.min.apply(null, reg.map(function (it) { return Number(it.repeat); }));
  var base = o['작업일'] ? toDate_(o['작업일']) : now_();
  var d = workDayFrom_(millKg_(reg) || Number(val_('min_mill_kg', 10)), addDays_(base, cycle));
  return d ? ymd_(d['날짜']) : ymd_(addDays_(base, cycle));
}
function mineView_(o, c) {
  var step = o['상태'] === '취소' ? -1 : (STEP_OF[o['상태']] === undefined ? 0 : STEP_OF[o['상태']]);
  var inv = String(o['송장'] || '');
  var others = rows_('주문').filter(function (r) { return r['고객'] === c['고객번호'] && r['주문번호'] !== o['주문번호'] && r['결제 상태'] !== '안 함' && r['상태'] !== '결제대기'; })
    .reverse().map(function (r) { return { no: r['주문번호'], date: orderDate_(r), grain: r['곡식'], step: r['상태'] === '취소' ? '취소' : STEPS[STEP_OF[r['상태']] || 0] }; });
  return {
    found: true, no: o['주문번호'], date: orderDate_(o), items: items_(o).map(itemText_), regularText: regularItems_(items_(o)).length ? '정기' : '',
    total: o['청구액'] === '' ? null : Number(o['청구액']), steps: STEPS, step: step, canceled: o['상태'] === '취소', waiting: o['상태'] === '대기',
    millDate: o['작업일'] && millKg_(items_(o)) > 0 ? ymd_(o['작업일']) : '', invoice: inv, trackUrl: inv ? 'https://search.naver.com/search.naver?query=' + encodeURIComponent(inv + ' 배송조회') : '',
    to: recipient_(o, c), canCancel: CANCELABLE.indexOf(o['상태']) >= 0,
    regular: o['정기'] === 'Y' && o['상태'] !== '취소', paused: o['정기'] === '멈춤', nextDate: nextRegular_(o), others: others,
    pay: o['결제수단'] || '', va: o['결제 상태'] === '입금 대기' ? payResult_(o)['가상계좌'] : null,
    cancelAsked: o['상태'] === '확인필요' && /^취소 요청/.test(String(o['메모']))
  };
}
function lookup(tel, no) {
  var m = findMine_(tel, no);
  return m.found ? mineView_(m.o, m.c) : m;
}
// 도정 전이면 바로 취소 → 재고·작업 달력 복귀 → 「취소확인」 문자(입금 전이면 환불 문장 뺌) → 대기 주문 다시 봄
function cancelMine(tel, no) {
  return withLock_(function () {
    var m = findMine_(tel, no); if (!m.found) return m;
    return customerCancel_(m.o, m.c, '고객 취소(내 주문)');
  });
}
// 고객이 도정 전에 취소 — PG 결제면 결제도 취소. 휴대폰 결제 달 넘김·입금 끝난 가상계좌(환불 계좌 필요)는 대표 확인(확인필요).
function customerCancel_(o, c, why) {
  if (CANCELABLE.indexOf(o['상태']) < 0) return { ok: false, reason: o['상태'] === '취소' ? '이미 취소' : '도정 뒤', view: mineView_(o, c) };
  var paid = o['상태'] === '입금', pgRefund = false;
  if (o['결제 키'] && ['완료', '입금 대기'].indexOf(o['결제 상태']) >= 0) {
    var manual = '';
    if (o['결제수단'] === '휴대폰' && Utilities.formatDate(toDate_(o['결제 시각']), 'Asia/Seoul', 'yyMM') !== Utilities.formatDate(now_(), 'Asia/Seoul', 'yyMM')) manual = '휴대폰 결제 달 넘김 — 대표 직접 환불';
    if (o['결제수단'] === '가상계좌' && o['결제 상태'] === '완료') manual = '가상계좌 입금 뒤 취소 — 환불 계좌 받아 대표 처리';
    if (!manual) {
      var r = tossCancel_(o, why);
      if (!r.ok) manual = 'PG 취소 실패 ' + (r.code || '') + ' — 대표 확인';
    }
    if (manual) {
      o['상태'] = '확인필요'; o['메모'] = '취소 요청: ' + manual; o['상태 바뀐 시각'] = now_(); save_('주문', o);
      log_('취소 요청', o['주문번호'], '확인필요', manual);
      return { ok: false, reason: '확인필요', view: mineView_(o, c) };
    }
    pgRefund = o['결제 상태'] === '완료';   // 가상계좌 입금 전 취소는 돌려줄 돈이 없다
    o['결제 상태'] = '취소'; o['취소 금액'] = o['청구액'];
  }
  cancel_(o, why);
  if (o['정기'] === 'Y') { o['정기'] = '멈춤'; save_('주문', o); }
  send_('취소확인', c, o, pgRefund ? { '환불일': '결제하신 곳에 따라 영업일 3~7일' } : paid ? {} : { unpaid: true });   // 카드·간편결제·휴대폰은 토스에서 바로 취소
  processWaitlist();
  return { ok: true, view: mineView_(one_('주문', '주문번호', o['주문번호']), c) };
}

// ───────── 결제(토스페이먼츠 결제위젯 · 설계 13장) ─────────
// 흐름: 주문서 진입 때 stock(남은 양 확인 1) → [결제하기] 때 checkout(남은 양 확인 2 + 자리 잡기 · 금액은 여기서 정함)
//       → 토스 결제창 → successUrl → payConfirm(승인 API) → 카드·간편결제·휴대폰 = 입금 / 가상계좌 = 확정 + 계좌 안내
//       → 가상계좌 입금 웹훅(DEPOSIT_CALLBACK, secret 대조) → 입금. 결제창에서 돌아오지 않으면 pay_hold_minutes 뒤 자리를 푼다.
// 시크릿 키는 스크립트 속성 TOSS_SECRET_KEY 에만(대표가 넣음). 시범 운행(test)이고 결제 키가 mock_ 로 시작하면 토스를 부르지 않는다.
var TOSS_API = 'https://api.tosspayments.com/v1/payments/';
var METHOD_NAME = { '카드': '카드', '가상계좌': '가상계좌', '간편결제': '간편결제', '휴대폰': '휴대폰' };
function payOpen_(p) { return p.test || (on_('order') && on_('pay_pg')); }
function stockCheck(p) {
  var items = (p.items || []).filter(function (it) { return GRAIN_NAME[it.grain] && Number(it.size) > 0; });
  if (!items.length) return { ok: false, empty: true };
  var why = shortage_(items);
  return why ? { ok: false, short: true } : { ok: true, 도정일: millKg_(items) > 0 ? (millDate_() || '') : '' };
}
function checkout(p) {
  return withLock_(function () {
    if (!payOpen_(p)) return { ok: false, closed: true };
    var items = (p.items || []).filter(function (it) { return GRAIN_NAME[it.grain] && Number(it.size) > 0; });
    if (!items.length) return { ok: false, empty: true };
    var t = now_(), test = p.test ? 'Y' : '';
    var me = p.token ? auth_(p.token) : null;
    var tel = me ? phone_(me['연락처']) : phone_(p['연락처']);
    if (!tel) return { ok: false, error: 'tel' };
    if (shortage_(items)) return { ok: false, short: true };
    var rec = append_('접수', { '접수번호': nextId_('접수', 'R', 5), '시각': t, '경로': '홈페이지', '원문': JSON.stringify(p.public || p),
                                '이름': p['이름'] || (me && me['이름']) || '', '연락처': tel, '처리상태': '처리됨', '시험': test });
    var c = me || customer_(p, tel, t, '홈페이지', test);
    rec['연결 고객'] = c['고객번호'];
    (p['동의'] || []).forEach(function (kind) {
      if (kind === '소식' && newsOn_(c['고객번호'])) return;
      append_('동의', { '동의번호': nextId_('동의', 'A', 5), '고객': c['고객번호'], '종류': kind, '문구 판': '문안 3차 2026-11-08', '동의 시각': t, '경로': '홈페이지' });
    });
    items.forEach(function (it) { saveTaste_(c['고객번호'], it, t); });
    var o = append_('주문', { '주문번호': orderNo_(t), '접수번호': rec['접수번호'], '고객': c['고객번호'], '곡식': grainsText_(items), '조합': JSON.stringify(items),
                             '양(kg)': totalKg_(items), '상태': '결제대기', '입금 안내 횟수': 0, '받는 분': p['받는 분'] ? JSON.stringify(p['받는 분']) : '',
                             '상태 바뀐 시각': t, '메모': p['요청사항'] || '', '정기': regularItems_(items).length ? 'Y' : '', '시험': test, '결제 상태': '대기', '경로': '홈페이지' });
    rec['연결 주문'] = o['주문번호']; save_('접수', rec);
    var mill = millKg_(items);
    var day = mill > 0 ? workDay_(mill, t) : { 날짜: day_(addDays_(t, val_('lead_days', 1))), _none: true };
    reserve_(o, byGrain_(items), day, mill);
    price_(o, c);
    o['입금 기한'] = new Date(t.getTime() + Number(val_('pay_hold_minutes', 30)) * 60000);
    save_('주문', o);
    log_('결제 준비', o['주문번호'], '결제대기');
    var name = GRAIN_NAME[items[0].grain] + (items.length > 1 ? ' 외 ' + (items.length - 1) + '건' : '');
    return { ok: true, 주문번호: o['주문번호'], tossOrderId: tossId_(o['주문번호']), 청구액: Number(o['청구액']), orderName: name, 도정일: mill > 0 ? ymd_(o['작업일']) : '',
             할인: o['할인액'] ? { 사유: o['할인 사유'], 율: o['할인율'], 액: Number(o['할인액']) } : null };
  });
}
function payConfirm(p) {
  return withLock_(function () {
    var o = one_('주문', '주문번호', noOf_(p.orderId));
    if (!o) return { ok: false, code: 'NO_ORDER' };
    var c = one_('고객', '고객번호', o['고객']);
    if (o['결제 키'] && o['결제 키'] === p.paymentKey) return payResult_(o);   // 새로 고침 — 이미 승인됨
    if (o['상태'] !== '결제대기') return { ok: false, code: 'NOT_PENDING' };
    if (Number(p.amount) !== Number(o['청구액'])) { abort_(o, '금액 다름'); return { ok: false, code: 'AMOUNT' }; }
    var r = tossConfirm_(p.paymentKey, o, !!(p.test && o['시험'] === 'Y'));
    if (!r.ok) { abort_(o, 'PG 승인 실패 ' + r.code); return { ok: false, code: r.code, message: r.message }; }
    var t = now_(), pay = r.body;
    o['결제수단'] = METHOD_NAME[pay.method] || pay.method || ''; o['결제 키'] = p.paymentKey; o['결제 비밀'] = pay.secret || '';
    o['결제 시각'] = t; o['상태 바뀐 시각'] = t;
    var n = liveCount_(c['고객번호']) + 1;
    if (pay.status === 'WAITING_FOR_DEPOSIT' && pay.virtualAccount) {
      var va = pay.virtualAccount;
      o['결제 상태'] = '입금 대기'; o['상태'] = '확정';
      o['가상계좌'] = JSON.stringify({ bank: va.bankCode, account: va.accountNumber, due: va.dueDate });
      o['입금 기한'] = va.dueDate ? new Date(String(va.dueDate)) : addDays_(t, val_('pay_days', 3));
      save_('주문', o);
      var first = settle_(c, n, t);
      send_('입금안내', c, o, { '은행': bankName_(va.bankCode), '계좌번호': va.accountNumber, append: [first && c['두두 호'] ? '첫고객' : ''] });
    } else if (pay.status === 'DONE') {
      o['결제 상태'] = '완료'; o['상태'] = '입금'; o['입금일'] = t;
      save_('주문', o);
      var firstEver = settle_(c, n, t);
      send_('결제완료', c, o, { append: [firstEver && c['두두 호'] ? '첫고객' : ''] });
    } else { abort_(o, 'PG 상태 ' + pay.status); return { ok: false, code: pay.status }; }
    log_('결제 승인', o['주문번호'], o['결제 상태'], o['결제수단']);
    return payResult_(one_('주문', '주문번호', o['주문번호']));
  });
}
function payResult_(o) {
  var va = null; try { va = o['가상계좌'] ? JSON.parse(o['가상계좌']) : null; } catch (e) {}
  return { ok: true, 주문번호: o['주문번호'], 상태: o['상태'], 결제수단: o['결제수단'], 결제상태: o['결제 상태'], 청구액: Number(o['청구액']),
           도정일: o['작업일'] && millKg_(items_(o)) > 0 ? ymd_(o['작업일']) : '', 가상계좌: va && o['결제 상태'] === '입금 대기' ? { 은행: bankName_(va.bank), 계좌: va.account, 기한: ymd_(o['입금 기한']) } : null };
}
// 결제창에서 실패·취소로 돌아왔을 때 — 자리를 바로 푼다(주문한 번호가 맞아야)
function payAbort(p) {
  return withLock_(function () {
    var o = one_('주문', '주문번호', noOf_(p.orderId));
    var c = o ? one_('고객', '고객번호', o['고객']) : null;
    if (!o || !c || o['상태'] !== '결제대기') return { ok: true };
    if (phone_(p.tel) !== phone_(c['연락처']) && !(p.token && auth_(p.token) && auth_(p.token)['고객번호'] === c['고객번호'])) return { ok: false };
    abort_(o, '결제 안 함(' + (p.code || '') + ')');
    return { ok: true };
  });
}
function abort_(o, why) { o['결제 상태'] = '안 함'; cancel_(o, why); }
// 가상계좌 입금 웹훅 — secret 이 승인 때 받은 값과 같아야 진짜
function depositCallback(p) {
  return withLock_(function () {
    var o = one_('주문', '주문번호', noOf_(p.orderId));
    if (!o || !o['결제 비밀'] || o['결제 비밀'] !== p.secret) { log_('입금 알림', p.orderId || '', '거절', 'secret 다름'); return { ok: false }; }
    var c = one_('고객', '고객번호', o['고객']);
    if (p.status === 'DONE' && o['상태'] === '확정') {
      o['결제 상태'] = '완료'; save_('주문', o);
      setStatusIn_(o, c, '입금', {});
    } else if (p.status === 'CANCELED' && o['상태'] !== '취소') {
      o['결제 상태'] = '취소'; cancel_(o, '가상계좌 취소 알림');
    } else if (p.status === 'WAITING_FOR_DEPOSIT' && o['상태'] === '입금') {
      o['상태'] = '확인필요'; o['메모'] = '입금 오류 알림 — 대표 확인'; save_('주문', o);
    }
    log_('입금 알림', o['주문번호'], p.status);
    return { ok: true };
  });
}
function tossAuth_() {
  var key = PropertiesService.getScriptProperties().getProperty('TOSS_SECRET_KEY');
  if (!key) throw new Error('TOSS_SECRET_KEY 없음 — 스크립트 속성에 넣어 주세요');
  return 'Basic ' + Utilities.base64Encode(key + ':');
}
function tossCall_(path, body) {
  var res = UrlFetchApp.fetch(TOSS_API + path, { method: 'post', contentType: 'application/json', headers: { Authorization: tossAuth_() },
                                                payload: JSON.stringify(body), muteHttpExceptions: true });
  var j = {}; try { j = JSON.parse(res.getContentText()); } catch (e) {}
  return res.getResponseCode() < 300 ? { ok: true, body: j } : { ok: false, code: j.code || res.getResponseCode(), message: j.message || '' };
}
function tossConfirm_(paymentKey, o, mock) {
  if (mock && /^mock_/.test(paymentKey)) {   // 시범 운행 — 결제 키 mock_<수단>_… 로 결제수단을 흉내
    var m = paymentKey.split('_')[1];
    if (m === 'FAIL') return { ok: false, code: 'REJECT_CARD_COMPANY', message: '시험 실패' };
    var method = { VA: '가상계좌', CARD: '카드', EASY: '간편결제', PHONE: '휴대폰' }[m] || '카드';
    var body = { method: method, status: method === '가상계좌' ? 'WAITING_FOR_DEPOSIT' : 'DONE', secret: 'mocksecret' + Math.floor(Math.random() * 1e9) };
    if (method === '가상계좌') body.virtualAccount = { bankCode: '11', accountNumber: '79000' + String(Math.floor(Math.random() * 1e8)), dueDate: Utilities.formatDate(addDays_(now_(), val_('pay_days', 3)), 'Asia/Seoul', "yyyy-MM-dd'T'23:59:59") };
    return { ok: true, body: body };
  }
  try { return tossCall_('confirm', { paymentKey: paymentKey, orderId: tossId_(o['주문번호']), amount: Number(o['청구액']) }); }
  catch (err) { return { ok: false, code: 'CALL', message: String(err) }; }
}
function tossCancel_(o, why) {
  if (o['시험'] === 'Y' && /^mock_/.test(o['결제 키'])) return { ok: true };
  try { return tossCall_(encodeURIComponent(o['결제 키']) + '/cancel', { cancelReason: why || '고객 요청' }); }
  catch (err) { return { ok: false, code: 'CALL', message: String(err) }; }
}
var BANKS = { '39': '경남은행', '34': '광주은행', '12': '단위농협', '32': '부산은행', '45': '새마을금고', '88': '신한은행', '48': '신협', '27': '씨티은행', '20': '우리은행', '71': '우체국', '50': '저축은행', '37': '전북은행', '35': '제주은행', '90': '카카오뱅크', '89': '케이뱅크', '92': '토스뱅크', '81': '하나은행', '03': '기업은행', '06': '국민은행', '31': '대구은행', '02': '산업은행', '11': '농협은행', '23': 'SC제일은행', '07': '수협은행' };
function bankName_(code) { return BANKS[String(code)] || String(code || ''); }

// ───────── 간편 회원 — 휴대폰 번호가 아이디 (설계 12장 · 문안 03-6) ─────────
// 비밀번호는 원문을 남기지 않는다: 번호마다 다른 소금값 + SHA-256 여러 번. 5번 틀리면 10분 잠금. 로그인 표(토큰)는 장부에 해시만.
var HASH_ROUNDS = 1000;
function hex_(bytes) { return bytes.map(function (b) { return ('0' + ((b < 0 ? b + 256 : b)).toString(16)).slice(-2); }).join(''); }
function sha_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function hashPw_(pw, salt) { var h = salt + ':' + pw; for (var i = 0; i < HASH_ROUNDS; i++) h = sha_(salt + h); return h; }
function rand_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); }
function memberOpen_(p) { return p.test || on_('member'); }
function pwOk_(pw) { return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(String(pw || '')); }
function isMember_(c) { return !!c && c['회원'] === 'Y'; }
function custByTel_(tel) { tel = phone_(tel); return rows_('고객').filter(function (r) { return phone_(r['연락처']) === tel; })[0] || null; }

// 인증번호 — 6자리, 3분, 하루 code_per_day 번. 문자 업체 전에는 시범 운행에서만 화면에 번호를 돌려준다(devCode).
function sendCode(p) {
  if (!memberOpen_(p)) return { ok: false, closed: true };
  var tel = phone_(p.tel), purpose = p.purpose === 'reset' ? 'reset' : 'join';
  if (!/^01\d{8,9}$/.test(tel)) return { ok: false, error: 'tel' };
  var c = custByTel_(tel);
  if (purpose === 'join' && isMember_(c)) return { ok: false, exists: true };
  if (purpose === 'reset' && !isMember_(c)) return { ok: false, notMember: true };
  var today = ymd_(now_());
  var used = rows_('인증').filter(function (r) { return phone_(r['번호']) === tel && ymd_(r['보낸 시각']) === today; }).length;
  if (used >= Number(val_('code_per_day', 5))) return { ok: false, limited: true };
  var code = String(100000 + Math.floor(Math.random() * 900000));
  append_('인증', { '번호': tel, '용도': purpose, '인증번호': sha_('code:' + tel + ':' + code), '보낸 시각': now_(), '틀린 횟수': 0, '확인': '' });
  log_('인증번호', tel.slice(0, 3) + '****' + tel.slice(-4), on_('sms_send') ? '보낼 차례(문자 업체 연결 전)' : '보류(sms_send 끔)');
  return p.test ? { ok: true, ttl: 180, devCode: code } : { ok: true, ttl: 180 };
}
function verifyCode(p) {
  if (!memberOpen_(p)) return { ok: false, closed: true };
  var tel = phone_(p.tel), purpose = p.purpose === 'reset' ? 'reset' : 'join';
  var r = rows_('인증').filter(function (x) { return phone_(x['번호']) === tel && x['용도'] === purpose && !x['확인']; }).pop();
  if (!r || now_() - toDate_(r['보낸 시각']) > 180000) return { ok: false, expired: true };
  if (Number(r['틀린 횟수']) >= 5) return { ok: false, expired: true };
  if (r['인증번호'] !== sha_('code:' + tel + ':' + String(p.code || '').trim())) { r['틀린 횟수'] = Number(r['틀린 횟수']) + 1; save_('인증', r); return { ok: false, wrong: true }; }
  r['확인'] = 'Y'; save_('인증', r);
  var vt = rand_();
  CacheService.getScriptCache().put('vt_' + vt, tel + '|' + purpose, 600);
  return { ok: true, verifyToken: vt };
}
function useVerify_(vt, tel, purpose) {
  var cache = CacheService.getScriptCache(), v = vt && cache.get('vt_' + vt);
  return v === phone_(tel) + '|' + purpose;
}
function issueToken_(c, keep) {
  var tok = rand_(), t = now_();
  append_('로그인', { '토큰': sha_('tok:' + tok), '고객': c['고객번호'], '만든 시각': t, '만료': addDays_(t, keep ? val_('login_days', 30) : 1) });
  return tok;
}
function auth_(token) {
  if (!token) return null;
  var h = sha_('tok:' + token), now = now_();
  var row = rows_('로그인').filter(function (r) { return r['토큰'] === h && toDate_(r['만료']) > now; })[0];
  if (!row) return null;
  var c = one_('고객', '고객번호', row['고객']);
  return isMember_(c) ? c : null;
}
function join(p) {
  return withLock_(function () {
    if (!memberOpen_(p)) return { ok: false, closed: true };
    var tel = phone_(p.tel);
    if (!useVerify_(p.verifyToken, tel, 'join')) return { ok: false, verify: true };
    if (!pwOk_(p.password)) return { ok: false, password: true };
    if (!String(p['이름'] || '').trim()) return { ok: false, name: true };
    if (!String(p['주소'] || '').trim()) return { ok: false, address: true };
    var t = now_(), c = custByTel_(tel);
    if (isMember_(c)) return { ok: false, exists: true };
    if (!c) c = customer_({ '이름': p['이름'] }, tel, t, '회원가입', p.test ? 'Y' : '');
    var salt = rand_().slice(0, 32);
    c['이름'] = String(p['이름']).trim(); c['회원'] = 'Y'; c['가입일'] = t; c['소금'] = salt; c['비밀번호'] = hashPw_(p.password, salt);
    c['약관 동의일'] = t; c['만14세 확인일'] = t; c['주소'] = p['주소']; c['상세 주소'] = p['상세 주소'] || ''; c['우편번호'] = p['우편번호'] || '';
    c['마지막 로그인'] = t;
    save_('고객', c);
    ['이용약관', '개인정보', '만14세'].concat(p.news && !newsOn_(c['고객번호']) ? ['소식'] : []).forEach(function (kind) {
      append_('동의', { '동의번호': nextId_('동의', 'A', 5), '고객': c['고객번호'], '종류': kind, '문구 판': '문안 03-6 2026-11-08', '동의 시각': t, '경로': '회원가입' });
    });
    CacheService.getScriptCache().put('vt_' + p.verifyToken, 'used', 1);
    log_('회원가입', c['고객번호'], '끝');
    return { ok: true, token: issueToken_(c, true), me: meView_(c) };
  });
}
function login(p) {
  if (!memberOpen_(p)) return { ok: false, closed: true };
  var tel = phone_(p.tel), cache = CacheService.getScriptCache(), key = 'lock_' + tel, fails = Number(cache.get(key) || 0);
  if (fails >= Number(val_('login_fail_max', 5))) return { ok: false, locked: true };
  var c = custByTel_(tel);
  if (!isMember_(c) || hashPw_(String(p.password || ''), c['소금']) !== c['비밀번호']) { cache.put(key, String(fails + 1), 600); return { ok: false, wrong: true }; }
  cache.put(key, '0', 1);
  c['마지막 로그인'] = now_(); save_('고객', c);
  return { ok: true, token: issueToken_(c, !!p.keep), me: meView_(c) };
}
function resetPw(p) {
  return withLock_(function () {
    if (!memberOpen_(p)) return { ok: false, closed: true };
    var tel = phone_(p.tel), c = custByTel_(tel);
    if (!isMember_(c) || !useVerify_(p.verifyToken, tel, 'reset')) return { ok: false, verify: true };
    if (!pwOk_(p.password)) return { ok: false, password: true };
    c['소금'] = rand_().slice(0, 32); c['비밀번호'] = hashPw_(p.password, c['소금']); save_('고객', c);
    dropTokens_(c['고객번호']);
    CacheService.getScriptCache().put('vt_' + p.verifyToken, 'used', 1);
    log_('비밀번호 찾기', c['고객번호'], '바꿈');
    return { ok: true };
  });
}
function dropTokens_(cid, only) {
  var sh = sheet_('로그인');
  rows_('로그인').filter(function (r) { return r['고객'] === cid && (!only || r['토큰'] === only); }).map(function (r) { return r._row; })
    .sort(function (a, b) { return b - a; }).forEach(function (row) { sh.deleteRow(row); });
}
function meView_(c) {
  var n = liveCount_(c['고객번호']), every = Number(val_('loyalty_every', 3));
  var orders = rows_('주문').filter(function (o) { return o['고객'] === c['고객번호'] && o['상태'] !== '결제대기' && o['결제 상태'] !== '안 함'; }).reverse();
  return { 이름: c['이름'], 연락처: phone_(c['연락처']), 주소: c['주소'] || '', 상세주소: c['상세 주소'] || '', 우편번호: c['우편번호'] || '',
           호: c['두두 호'] || null, 횟수: n, 다음할인까지: newsEver_(c['고객번호']) && !c['두두 호'] ? every - (n % every) : null,
           소식: newsOn_(c['고객번호']),
           주문: orders.slice(0, 30).map(function (o) { var v = mineView_(o, c); v.items_raw = items_(o); return v; }) };
}
// 로그인한 회원의 요청 한곳: me · 정보 수정 · 로그아웃 · 탈퇴 · 주문 취소 · 정기 멈춤/주기 · 지난번과 같게
function member(p) {
  return withLock_(function () {
    if (!memberOpen_(p)) return { ok: false, closed: true };
    var c = auth_(p.token);
    if (!c) return { ok: false, auth: true };
    var a = p.action, o = p.no ? one_('주문', '주문번호', String(p.no)) : null;
    if (o && o['고객'] !== c['고객번호']) return { ok: false, auth: true };
    if (a === 'me') return { ok: true, me: meView_(c) };
    if (a === 'recall') return recallOf_(c);
    if (a === 'update') {
      if (p['이름'] !== undefined && String(p['이름']).trim()) c['이름'] = String(p['이름']).trim();
      if (p['주소'] !== undefined) { c['주소'] = p['주소']; c['상세 주소'] = p['상세 주소'] || ''; c['우편번호'] = p['우편번호'] || ''; }
      if (p.newPassword) {
        if (hashPw_(String(p.password || ''), c['소금']) !== c['비밀번호']) return { ok: false, wrong: true };
        if (!pwOk_(p.newPassword)) return { ok: false, password: true };
        c['소금'] = rand_().slice(0, 32); c['비밀번호'] = hashPw_(p.newPassword, c['소금']);
        dropTokens_(c['고객번호']);
        save_('고객', c);
        return { ok: true, relogin: true };
      }
      save_('고객', c);
      if (p.news === true && !newsOn_(c['고객번호'])) append_('동의', { '동의번호': nextId_('동의', 'A', 5), '고객': c['고객번호'], '종류': '소식', '문구 판': '문안 03-6 2026-11-08', '동의 시각': now_(), '경로': '마이페이지' });
      if (p.news === false && newsOn_(c['고객번호'])) rows_('동의').forEach(function (x) { if (x['고객'] === c['고객번호'] && x['종류'] === '소식' && !x['철회 시각']) { x['철회 시각'] = now_(); save_('동의', x); } });
      return { ok: true, me: meView_(c) };
    }
    if (a === 'logout') { dropTokens_(c['고객번호'], sha_('tok:' + p.token)); return { ok: true }; }
    if (a === 'leave') {
      ['회원', '가입일', '비밀번호', '소금', '약관 동의일', '만14세 확인일', '마지막 로그인', '주소', '상세 주소', '우편번호'].forEach(function (k) { c[k] = ''; });
      save_('고객', c); dropTokens_(c['고객번호']);
      log_('회원 탈퇴', c['고객번호'], '회원 정보 지움(주문 기록은 5년 보관)');
      return { ok: true };
    }
    if (!o) return { ok: false, error: 'no' };
    if (a === 'cancel') return customerCancel_(o, c, '고객 취소(마이페이지)');
    if (a === 'pause') { if (o['정기'] !== 'Y') return { ok: false, reason: '정기 아님' }; o['정기'] = '멈춤'; save_('주문', o); log_('정기 멈춤', o['주문번호'], '회원'); return { ok: true, view: mineView_(o, c) }; }
    if (a === 'cycle') {
      var days = Math.round(Number(p.days)); if (o['정기'] !== 'Y' || !(days >= 7 && days <= 182)) return { ok: false };
      var items = items_(o).map(function (it) { if (it.repeat && it.repeat !== 'once') it.repeat = days; return it; });
      o['조합'] = JSON.stringify(items); save_('주문', o); log_('정기 주기', o['주문번호'], days + '일');
      return { ok: true, view: mineView_(o, c) };
    }
    return { ok: false, error: 'action' };
  });
}
function recallOf_(c) {
  var combos = {};
  rows_('취향').filter(function (k) { return k['고객'] === c['고객번호']; }).forEach(function (k) {
    combos[k['제품']] = { glutinous: k['찹쌀'] === '' ? null : Number(k['찹쌀']), size: Number(k['양(kg)']), subpack: k['소포장'] === 'Y',
                          repeat: k['주기(일)'] ? Number(k['주기(일)']) : 'once' };
  });
  return { ok: true, found: Object.keys(combos).length > 0, combos: combos };
}
// 정기 멈추기 — 다음 예약부터. 장부 「주문」 정기 칸을 「멈춤」으로.
function pauseMine(tel, no) {
  return withLock_(function () {
    var m = findMine_(tel, no); if (!m.found) return m;
    if (m.o['정기'] !== 'Y') return { ok: false, reason: '정기 아님', view: mineView_(m.o, m.c) };
    m.o['정기'] = '멈춤'; save_('주문', m.o);
    log_('정기 멈춤', m.o['주문번호'], '고객');
    return { ok: true, view: mineView_(m.o, m.c) };
  });
}

// 정기 주문 — 다음 도정일 regular_ahead_days 전에 정기로 고른 곡식만 같은 조합으로 다시 예약(확정 문자가 「보내기 전 안내」).
function scheduleRegular() {
  var today = day_(now_()), ahead = Number(val_('regular_ahead_days', 3));
  rows_('주문').filter(function (o) { return o['정기'] === 'Y' && ['작업', '발송', '도착'].indexOf(o['상태']) >= 0 && o['작업일']; })
    .forEach(function (o) {
      var reg = regularItems_(items_(o)), cycle = Math.min.apply(null, reg.map(function (it) { return Number(it.repeat); }));
      if (!reg.length || today < day_(addDays_(o['작업일'], cycle - ahead))) return;
      var c = one_('고객', '고객번호', o['고객']); if (!c) return;
      var t = now_();
      var rec = append_('접수', { '접수번호': nextId_('접수', 'R', 5), '시각': t, '경로': '정기', '원문': '정기 — ' + o['주문번호'] + ' 다음 예약',
                                  '이름': c['이름'], '연락처': c['연락처'], '처리상태': '처리됨', '연결 고객': c['고객번호'], '시험': o['시험'] });
      var n = append_('주문', { '주문번호': orderNo_(t), '접수번호': rec['접수번호'], '고객': c['고객번호'], '곡식': grainsText_(reg), '조합': JSON.stringify(reg),
                               '양(kg)': totalKg_(reg), '상태': '접수', '입금 안내 횟수': 0, '받는 분': o['받는 분'], '상태 바뀐 시각': t,
                               '메모': '정기 — ' + o['주문번호'] + ' 다음', '정기': 'Y', '시험': o['시험'], '경로': '정기' });
      rec['연결 주문'] = n['주문번호']; save_('접수', rec);
      o['정기'] = '이어짐'; save_('주문', o);
      log_('정기 예약', n['주문번호'], confirm_(n, c), o['주문번호'] + ' 다음');
    });
}

// 시범 운행 정리 — 「시험」 표시 줄과 그 고객의 동의·취향·관심·연락·처리 기록을 지운다. 확정분은 먼저 취소해 재고·작업 달력을 되돌린다.
function purgeTest() {
  return withLock_(function () {
    var orders = rows_('주문').filter(function (o) { return o['시험'] === 'Y'; });
    orders.forEach(function (o) { if (['확정', '입금'].indexOf(o['상태']) >= 0) cancel_(o, '시험 정리'); });
    var cids = rows_('고객').filter(function (c) { return c['시험'] === 'Y'; }).map(function (c) { return c['고객번호']; });
    var rids = rows_('접수').filter(function (r) { return r['시험'] === 'Y'; }).map(function (r) { return r['접수번호']; });
    var onos = orders.map(function (o) { return o['주문번호']; });
    var ids = cids.concat(rids, onos), n = 0;
    function drop(name, test) {
      var sh = sheet_(name);
      rows_(name).filter(test).map(function (r) { return r._row; }).sort(function (a, b) { return b - a; })
        .forEach(function (row) { sh.deleteRow(row); n++; });
    }
    drop('주문', function (o) { return o['시험'] === 'Y'; });
    drop('접수', function (r) { return r['시험'] === 'Y'; });
    ['동의', '취향', '관심'].forEach(function (s) { drop(s, function (r) { return cids.indexOf(r['고객']) >= 0; }); });
    drop('연락', function (r) { return cids.indexOf(r['고객']) >= 0 || onos.indexOf(r['주문']) >= 0; });
    drop('처리 기록', function (r) { return ids.indexOf(r['대상']) >= 0; });
    var tels = rows_('고객').filter(function (c) { return c['시험'] === 'Y'; }).map(function (c) { return phone_(c['연락처']); });
    drop('로그인', function (r) { return cids.indexOf(r['고객']) >= 0; });
    drop('인증', function (r) { return tels.indexOf(phone_(r['번호'])) >= 0; });
    drop('고객', function (c) { return c['시험'] === 'Y'; });
    log_('시험 정리', '', n + '줄 지움');
    return n;
  });
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

// ───────── 주문 관리 화면(대표 전용 · 진행표 7단계) ─────────
// 장부 쓰기는 규칙 일꾼 하나로 — 이 화면의 단추는 장부에 손으로 넣을 때와 같은 함수(setStatus·intake·customerCancel_)를 부른다.
// 배포를 하나 더 만든다: 웹 앱, 실행 = 나, 액세스 = 나만 → 그 주소 끝에 ?page=admin. 공개 배포(모든 사용자)로 열면 로그인한 대표가 아니어서 막힌다.
function isOwner_() {
  try { var a = Session.getActiveUser().getEmail(); return !!a && a === Session.getEffectiveUser().getEmail(); } catch (e) { return false; }
}
function ownerOnly_() { if (!isOwner_()) throw new Error('대표 계정으로만 쓸 수 있습니다'); }
function adminPage_() {
  if (!isOwner_()) return HtmlService.createHtmlOutput('<p style="font:16px sans-serif;padding:24px">대표 계정으로만 열립니다.</p>');
  return HtmlService.createHtmlOutputFromFile('Admin').setTitle(testMode_() ? '두두 주문 관리 (시험)' : '두두 주문 관리')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
function md2_(v) { var x = v ? toDate_(v) : null; return x ? (x.getMonth() + 1) + "/" + x.getDate() : ""; }   // 스크립트 시간대 Asia/Seoul
function mdhm_(v) { var x = v ? toDate_(v) : null; return x ? md2_(x) + " " + ("0" + x.getHours()).slice(-2) + ":" + ("0" + x.getMinutes()).slice(-2) : ""; }
// 화면에 보일 것: 취소 안 된 주문 전부 + 최근 14일 안에 끝난(취소·도착) 주문
function adminLoad() {
  ownerOnly_();
  var cs = {}; rows_('고객').forEach(function (c) { cs[c['고객번호']] = c; });
  var since = addDays_(now_(), -14), msgs = {};
  rows_('연락').forEach(function (m) {   // 주문마다 나간(또는 보류·건너뜀) 문자 — 결과 칸에 문구 전체가 있다
    var k = String(m['주문'] || ''); if (!k) return;
    (msgs[k] = msgs[k] || []).push({ at: mdhm_(m['시각']), code: m['문자틀'], result: String(m['결과'] || '') });
  });
  var orders = rows_('주문').filter(function (o) {
    return ['취소', '도착'].indexOf(o['상태']) < 0 || (o['상태 바뀐 시각'] && toDate_(o['상태 바뀐 시각']) > since);
  }).map(function (o) {
    var c = cs[o['고객']] || {};
    return { no: String(o['주문번호']), status: o['상태'], name: c['이름'] || '', tel: String(c['연락처'] || ''), grain: o['곡식'], kg: o['양(kg)'],
             amount: o['청구액'] === '' ? '' : Number(o['청구액']), route: o['경로'] || '', pay: o['결제수단'] || '', work: md2_(o['작업일']),
             arrive: md2_(o['받을 날']), due: mdhm_(o['입금 기한']), invoice: String(o['송장'] || ''), memo: String(o['메모'] || ''),
             changed: mdhm_(o['상태 바뀐 시각']), test: o['시험'] === 'Y', friend: isFriend_(o), regular: o['정기'] === 'Y',
             overdue: o['상태'] === '확정' && o['입금 기한'] && toDate_(o['입금 기한']) < now_(), msgs: msgs[String(o['주문번호'])] || [] };
  });
  var stock = rows_('재고').map(function (s) { return { grain: s['곡식'], left: s['남은 양(kg)'], held: s['예약된 양(kg)'] }; });
  return { orders: orders, stock: stock, lastRun: mdhm_(val_('last_run', '')), test: testMode_(), book: book_().getUrl(), now: mdhm_(now_()) };
}
// 단추 하나 = 장부에 손으로 넣는 일 하나. 문자는 연락 규칙대로 나간다(수동 상태 바꾸기만 문자 없음).
function adminAct(no, action, data) {
  ownerOnly_();
  data = data || {};
  return withLock_(function () {
    var o = one_('주문', '주문번호', no);
    if (!o) return { ok: false, msg: '주문 없음' };
    var c = one_('고객', '고객번호', o['고객']), st = o['상태'], done;
    if (action === '입금') { if (st !== '확정') return { ok: false, msg: '확정 주문만 입금 처리' }; done = setStatusIn_(o, c, '입금', {}); }
    else if (action === '작업') { if (st !== '입금') return { ok: false, msg: '입금된 주문만 작업 완료' }; done = setStatusIn_(o, c, '작업', {}); }
    else if (action === '송장') {
      var text = String(data.text || '').trim();
      if (!/\S+\s+\S+/.test(text)) return { ok: false, msg: '「택배사 송장번호」로 적어 주세요' };
      if (['발송', '도착', '취소'].indexOf(st) >= 0) return { ok: false, msg: '이미 ' + st };
      var sp = text.split(/\s+/);
      done = setStatusIn_(o, c, '발송', { '택배사': sp.slice(0, -1).join(' '), '송장': sp[sp.length - 1] });
    }
    else if (action === '도착') { if (st !== '발송') return { ok: false, msg: '발송된 주문만 도착 처리' }; done = setStatusIn_(o, c, '도착', {}); }
    else if (action === '취소') {
      var why = '대표 취소' + (data.why ? ': ' + data.why : '');
      if (CANCELABLE.indexOf(st) >= 0) { var r = customerCancel_(o, c, why); done = r.ok; if (!r.ok) return { ok: false, msg: r.reason === '확인필요' ? '결제 취소를 직접 해야 합니다 — 메모 확인' : r.reason }; }
      else if (st === '확인필요' || st === '결제대기') { cancel_(o, why); done = true; }
      else return { ok: false, msg: st + ' 주문은 「상태 바꾸기」로(환불은 직접)' };
    }
    else if (action === '상태') {   // 확인필요 정리용 — 문자 없이 상태만
      var to = String(data.to || '');
      if (['확정', '입금', '작업', '발송', '도착', '취소'].indexOf(to) < 0) return { ok: false, msg: '상태 이름 확인' };
      o['상태'] = to; o['상태 바뀐 시각'] = now_();
      if (data.memo !== undefined) o['메모'] = String(data.memo);
      save_('주문', o); log_('대표 수동', o['주문번호'], to, '문자 없음'); done = true;
    }
    else if (action === '메모') { o['메모'] = String(data.memo || ''); save_('주문', o); done = true; }
    else return { ok: false, msg: '모르는 일: ' + action };
    if (done && action !== '상태' && action !== '메모') log_('주문 관리', no, action);
    return { ok: !!done, msg: done ? '' : '처리 안 됨 — 처리 기록 확인' };
  });
}
// 전화·문자·카톡·지인 주문 입력 — 클로드가 정리해 넣던 것을 대표가 바로(intake 와 같은 길).
// f: { route, name, tel, addr, items:[{grain:'rice'|'soy', glutinous, size, subpack}], amount(지인), memo }
function adminOrder(f) {
  ownerOnly_();
  f = f || {};
  if (['전화', '문자', '카톡', '지인'].indexOf(f.route) < 0) return { ok: false, msg: '경로를 고르세요' };
  if (!f.name || phone_(f.tel).length < 10) return { ok: false, msg: '이름·연락처를 확인하세요' };
  var items = (f.items || []).filter(function (it) { return it && (it.grain === 'rice' || it.grain === 'soy') && Number(it.size) > 0; })
    .map(function (it) { return { grain: it.grain, glutinous: it.grain === 'rice' ? Number(it.glutinous || 0) : undefined, size: Number(it.size), subpack: !!it.subpack, repeat: 'once' }; });
  if (!items.length) return { ok: false, msg: '품목을 넣으세요' };
  if (f.route === '지인' && !(Number(String(f.amount || '').replace(/\D/g, '')) > 0)) return { ok: false, msg: '지인 주문은 금액을 적으세요' };
  var p = { '경로': f.route, '원문': '주문 관리 입력' + (f.memo ? ' — ' + f.memo : ''), '이름': f.name, '연락처': f.tel, '주소': f.addr || '',
            mode: 'order', items: items, '금액': f.amount || '' };
  if (testMode_()) p.test = true;
  var r = intake(p);
  return { ok: !!r && r.ok !== false, msg: r && r['상태'] ? '주문 ' + (r['주문번호'] || '') + ' — ' + r['상태'] : '', res: r };
}

// ───────── 웹 입구 (배포: 웹 앱, 실행 = 나, 액세스 = 모든 사용자) ─────────
function doGet(e) {
  var q = (e && e.parameter) || {};
  if (q.page === 'admin') return adminPage_();
  var body;
  try {
    body = q.action === 'switches' ? exportSwitches() : { ok: false, error: 'unknown action' };   // 번호가 든 요청은 주소에 싣지 않고 POST로만
  } catch (err) { log_('doGet', q.action || '', '실패', String(err)); body = { ok: false }; }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
function testMode_() { return PropertiesService.getScriptProperties().getProperty('TEST_MODE') === 'on'; }
function doPost(e) {
  var body;
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.test && !testMode_()) delete p.test;   // 시험 표시는 스크립트 속성 TEST_MODE=on 일 때만(가짜 결제 막기)
    if (p.eventType === 'DEPOSIT_CALLBACK' || (p.secret && p.orderId && p.status && !p.kind)) body = depositCallback(p.data || p);
    else if (p.kind === 'stock') body = stockCheck(p);
    else if (p.kind === 'checkout') body = checkout(p);
    else if (p.kind === 'pay-confirm') body = payConfirm(p);
    else if (p.kind === 'pay-abort') body = payAbort(p);
    else if (p.kind === 'code') body = sendCode(p);
    else if (p.kind === 'verify') body = verifyCode(p);
    else if (p.kind === 'join') body = join(p);
    else if (p.kind === 'login') body = login(p);
    else if (p.kind === 'reset') body = resetPw(p);
    else if (p.kind === 'member') body = member(p);
    else if (p.kind === 'recall') body = recall(p.tel);
    else if (p.kind === 'lookup') body = lookup(p.tel, p.no);
    else if (p.kind === 'cancel') body = cancelMine(p.tel, p.no);
    else if (p.kind === 'pause') body = pauseMine(p.tel, p.no);
    else if (p.kind === 'order' && !on_('order') && !p.test) body = { ok: false, closed: true };   // 판매 시작 전엔 시험 주문만
    else body = intake(p);
  } catch (err) {
    log_('doPost', '', '실패', String(err));
    body = { ok: false };
  }
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

// ───────── 예약 작업 ─────────
function runScheduled() {
  withLock_(function () {
    [checkDeadlines, processWaitlist, detectLate, afterArrival, scheduleRegular, updateStages, refillAlert, consentCheck, flushWaiting].forEach(function (fn) {
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
