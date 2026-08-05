(function () {
  var COPY_ICON =
    '<svg class="copy-icon-copy" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1"/></svg>';
  var CHECK_ICON =
    '<svg class="copy-icon-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7"/></svg>';

  function getCodeText(pre) {
    var code = pre.querySelector('code');
    if (!code) return pre.textContent.replace(/\n$/, '');
    var lines = [];
    for (var i = 0; i < code.children.length; i++) {
      var child = code.children[i];
      if (child.tagName === 'SPAN') lines.push(child.textContent);
    }
    if (lines.length) return lines.join('\n');
    return code.textContent.replace(/\n$/, '');
  }

  function makeButton(pre) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-code-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.innerHTML = COPY_ICON + CHECK_ICON;
    btn.addEventListener('click', function () {
      var text = getCodeText(pre);
      navigator.clipboard.writeText(text).then(function () {
        btn.classList.add('copied');
        btn.setAttribute('aria-label', 'Copied!');
        clearTimeout(btn._resetTimer);
        btn._resetTimer = setTimeout(function () {
          btn.classList.remove('copied');
          btn.setAttribute('aria-label', 'Copy code');
        }, 1500);
      });
    });
    return btn;
  }

  document.querySelectorAll('pre').forEach(function (pre) {
    if (pre.querySelector('.copy-code-btn')) return;
    pre.appendChild(makeButton(pre));
  });
})();
