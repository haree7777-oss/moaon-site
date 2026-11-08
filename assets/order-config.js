// 두두 쇼핑 설정 — 대표가 정한 값은 여기 한 곳만 고친다. 빈칸(null·'')은 화면에 나오지 않는다.
// 도정일·주문 받기(order)·회원(member)·결제(pay_pg) 스위치는 장부 「설정」·「작업 달력」이 정본 — 규칙 일꾼(endpoint)이 알려 준다.
window.DOODOO_CONFIG = {
  endpoint: '',          // 규칙 일꾼 웹 앱 주소. 비어 있으면 결제·조회·회원 단추를 막는다
  payDays: 3,            // 가상계좌 입금 기한(일) — 토스 결제 어드민 가상계좌 설정과 같게
  kakao: '',             // 카카오톡 채널 「두두농장」 주소 — 개설 뒤
  shipping: null,        // 배송비(원) 【대표】 — 0이면 「무료 배송」
  terms: false,          // 이용약관(문안 03-5) — 법인관리 확인 뒤 true
  pay: { clientKey: '' },// 토스페이먼츠 결제위젯 클라이언트 키(test_gck… / live_gck…) — 공개돼도 되는 키. 시크릿 키는 여기 두지 않는다
  discount: { every: 3, rate: 10, hoSeats: 100, hoRate: 10 },
  rice: {
    name: '두두쌀', variety: '신동진 · 동진찰',
    one: '신동진 쌀에 동진찰 찹쌀을 원하는 만큼 섞어 드립니다.',
    glutinous: [0, 10, 20, 30],
    recommend: 10,
    feel: null,                      // ★대표 확인 뒤: { 0: '담백한 밥', 10: '조금 더 차진 밥', 20: '차진 밥', 30: '찰밥에 가까운 밥' }
    year: '',                        // 생산연도 【대표: 2026년산 확인】
    sizes: [10, 20],                 // kg
    price: { 10: null, 20: null },   // 원 【대표】
    subpack: { unit: 2.5, fee: { 10: 1000, 20: 2000 } },
    cycles: [14, 28],
    perCapitaDailyG: 147.7,
    mealFactor: { '하루 1끼': 1 / 3, '하루 2끼': 2 / 3, '하루 3끼': 1, '주말만': 2 / 7 },
    photo: ['rice-cooked', 'rice-hero']   // 대표 사진(지은 밥) — 파일이 없으면 둘째 이름(임시)
  },
  soy: {
    name: '두두콩', variety: '선풍',
    one: '된장·두부 담그는 노란 메주콩',
    sizes: [],                       // kg 【대표: 단위·가격】
    price: {},
    year: '',
    cycles: [14, 28],
    photo: ['soy-dish', 'soy-hero']
  }
};
