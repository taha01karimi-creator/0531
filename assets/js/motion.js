
(function () {
  "use strict";

  var root = document.documentElement;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }
  if (!("IntersectionObserver" in window)) {
    return;
  }

  root.classList.add("motion-on");

  var REVEAL = [
    ".pcard",
    ".cat",
    ".section__head",
    ".feature",
    ".summary",
    ".cart-row",
    ".gallery",
    ".tabs-line",
    ".product__perks",
    ".order-success"
  ].join(",");

  var MEDIA = [
    ".pcard__media",
    ".cat",
    ".hero__media",
    ".gallery__main",
    ".gallery__thumb",
    ".cart-row__img",
    ".search__item"
  ].join(",");

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
  );

  function collect(root, selector) {
    var out = [];
    if (root.matches && root.matches(selector)) out.push(root);
    var found = root.querySelectorAll(selector);
    for (var i = 0; i < found.length; i++) out.push(found[i]);
    return out;
  }

  function markReveal(scope) {
    var nodes = collect(scope, REVEAL);
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.hasAttribute("data-reveal")) continue;
      el.setAttribute("data-reveal", "");
      var order = 0;
      var prev = el.previousElementSibling;
      while (prev) {
        if (prev.hasAttribute("data-reveal")) order++;
        prev = prev.previousElementSibling;
      }
      el.style.setProperty("--reveal-delay", Math.min(order % 8, 7) * 70 + "ms");
      observer.observe(el);
    }
  }

  function markImages(scope) {
    var imgs = collect(scope, "img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.hasAttribute("data-media-anim")) continue;
      img.setAttribute("data-media-anim", "");

      var media = img.closest ? img.closest(MEDIA) : null;
      if (!media) continue;
      media.classList.add("media-anim");

      (function (target) {
        var done = false;
        function ready() {
          if (done) return;
          done = true;
          setTimeout(function () {
            target.classList.add("is-ready");
          }, 20);
        }
        if (img.complete && img.naturalWidth > 0) {
          ready();
        } else {
          img.addEventListener("load", ready, { once: true });
          img.addEventListener("error", ready, { once: true });
        }
        
        setTimeout(ready, 2500);
      })(media);
    }
  }

  function scan(scope) {
    if (!scope || scope.nodeType !== 1) return;
    markReveal(scope);
    markImages(scope);
  }

  scan(document.body);

  var pending = false;
  var changed = [];
  var mo = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var added = records[i].addedNodes;
      for (var j = 0; j < added.length; j++) {
        if (added[j].nodeType === 1) changed.push(added[j]);
      }
    }
    if (!changed.length || pending) return;
    pending = true;
    setTimeout(function () {
      pending = false;
      var list = changed;
      changed = [];
      list.forEach(scan);
    }, 16);
  });

  mo.observe(document.body, { childList: true, subtree: true });
})();
