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
  // 공고기간이 끝난 공고를 「지난 공고」로 내린다. 게시 파일은 건드리지 않는다
  var past = document.getElementById('past-notices');
  if (past) {
    var d = new Date();
    var today = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    document.querySelectorAll('#notices .notice-item').forEach(function (el) {
      if (el.dataset.end && el.dataset.end < today) {
        past.querySelector('.notice-items').appendChild(el);
        past.hidden = false;
      }
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
