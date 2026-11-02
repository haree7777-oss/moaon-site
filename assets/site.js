// 폰 메뉴 열기·닫기, 스크롤 시 살짝 떠오르기
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.querySelector('nav.menu');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  var items = document.querySelectorAll('.rise');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('on'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  items.forEach(function (el) { io.observe(el); });
})();
