// 두두 주문 화면 설정 — 대표가 정한 값은 여기 한 곳만 고친다. 빈칸(null·'')은 화면에 나오지 않는다.
// 규칙 일꾼(endpoint)이 연결되면 order 스위치·남은 ○호 자리는 장부 「설정」 값이 덮어쓴다.
window.DOODOO_CONFIG = {
  endpoint: '',          // 규칙 일꾼 웹 앱 주소(4-1 끝나면). 비어 있으면 보내기 단추를 막는다
  order: false,          // 스위치 order — false = 「예약 문의」, true = 「주문」
  payDays: 3,            // 입금 기한(일)
  account: '',           // 입금 계좌 【대표】
  shipping: null,        // 배송비(원) 【대표】 — 0이면 「무료 배송」
  discount: { every: 3, rate: 10, hoSeats: 100, hoRate: 10 },   // 10%는 임시값
  rice: {
    name: '두두쌀',
    glutinous: [0, 10, 20, 30],      // 찹쌀 비율 단계(%)
    recommend: 10,
    sizes: [10, 20],                 // kg
    price: { 10: null, 20: null },   // 원 【대표】
    subpack: { unit: 2.5, fee: { 10: 1000, 20: 2000 } },
    cycles: [14, 28],                // 정기 주기(일) — 직접 입력도 됨
    perCapitaDailyG: 147.7,          // 2025 양곡소비량조사(국가데이터처)
    mealFactor: { '하루 1끼': 1 / 3, '하루 2끼': 2 / 3, '하루 3끼': 1, '주말만': 2 / 7 }   // 집밥 보정(임시 — 대표 확정 전)
  },
  soy: {
    name: '선풍 콩',
    sizes: [],                       // kg 【대표: 단위·가격】 — 비어 있으면 양 칸과 담기 단추가 나오지 않는다
    price: {},
    cycles: [14, 28]
  }
};
