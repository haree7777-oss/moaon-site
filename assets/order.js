// 알림 신청: 입력을 저장하지 않고 문자(폰) 또는 복사 + 이메일(PC)로 넘긴다
(function () {
  var PHONE = '01046898106';
  var MAIL = 'haree7777@gmail.com';
  var SUBJECT = '두두 곡식 알림 신청';
  var form = document.getElementById('order-form');
  var done = document.getElementById('order-done');
  var copyBtn = document.getElementById('order-copy');
  var mailLink = document.getElementById('order-mail');
  var body = '';

  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(body).catch(function () {});
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var picked = [].map.call(form.querySelectorAll('input[name=grain]:checked'), function (el) { return el.value; });
    body = SUBJECT + '\n이름: ' + form.name.value.trim() + '\n연락처: ' + form.tel.value.trim();
    if (picked.length) body += '\n관심 곡식: ' + picked.join(', ');
    var mailto = 'mailto:' + MAIL + '?subject=' + encodeURIComponent(SUBJECT) + '&body=' + encodeURIComponent(body);
    mailLink.href = mailto;
    done.hidden = false;
    if (window.matchMedia('(pointer: coarse)').matches) {
      location.href = 'sms:' + PHONE + '?&body=' + encodeURIComponent(body);
    } else {
      copy();
      location.href = mailto;
    }
  });
  copyBtn.addEventListener('click', copy);
})();
