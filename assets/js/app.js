/* ============================================
   منطق مشترک سایت: سبد خرید، علاقه‌مندی،
   جستجو، منو و رندر کارت محصول
   ============================================ */

const CART_KEY = "rega_cart";
const WISH_KEY = "rega_wish";

/* ---------- ابزارهای عمومی ---------- */

/** تبدیل عدد به قالب فارسی با جداکننده هزارگان */
function faNum(value) {
  return Number(value).toLocaleString("fa-IR");
}

/** قیمت با واحد تومان */
function toman(value) {
  return faNum(value) + " تومان";
}

/** خواندن امن از localStorage */
function readStore(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStore(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    /* احتمال پر بودن حافظه یا حالت خصوصی مرورگر */
  }
}

function productById(id) {
  return PRODUCTS.find(function (item) {
    return item.id === id;
  });
}

/* یکسان‌سازی متن جستجو: حروف عربی، نیم‌فاصله، اعداد فارسی و علائم */
function searchNormalize(value) {
  var faDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value == null ? "" : value)
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإآ]/g, "ا")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .replace(/[\u200c\u200e\u200f\u0640]/g, " ")
    .replace(/[۰-۹]/g, function (d) { return String(faDigits.indexOf(d)); })
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/* جستجو روی نام، دسته، جنس پارچه، رنگ و توضیح محصول؛
   همهٔ کلمه‌های عبارت باید پیدا شوند. */
function matchesSearch(item, query) {
  var tokens = searchNormalize(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;

  var colorNames = (item.colors || [])
    .map(function (key) { return COLORS[key] ? COLORS[key].name : ""; })
    .join(" ");
  var text = searchNormalize(
    [item.name, categoryTitle(item.category), item.material, item.fit, item.desc, colorNames].join(" ")
  );
  return tokens.every(function (token) { return text.indexOf(token) !== -1; });
}

function categoryTitle(id) {
  const found = CATEGORIES.find(function (cat) {
    return cat.id === id;
  });
  return found ? found.title : "";
}

function percentOff(product) {
  if (!product.oldPrice || product.oldPrice <= product.price) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

/* ---------- سبد خرید ---------- */

function getCart() {
  const cart = readStore(CART_KEY, []);
  return Array.isArray(cart) ? cart : [];
}

function saveCart(cart) {
  writeStore(CART_KEY, cart);
  updateCartCount();
}

function cartLineKey(item) {
  return item.id + "::" + item.size + "::" + item.color;
}

function addToCart(id, size, color, qty) {
  const product = productById(id);
  if (!product) return;

  const cart = getCart();
  const line = {
    id: id,
    size: size || product.sizes[0],
    color: color || product.colors[0],
    qty: Math.max(1, Number(qty) || 1)
  };
  const key = cartLineKey(line);
  const existing = cart.find(function (item) {
    return cartLineKey(item) === key;
  });

  if (existing) {
    existing.qty += line.qty;
  } else {
    cart.push(line);
  }

  saveCart(cart);
  showToast("«" + product.name + "» به سبد خرید اضافه شد");
}

function setLineQty(key, qty) {
  const cart = getCart();
  const line = cart.find(function (item) {
    return cartLineKey(item) === key;
  });
  if (!line) return;

  line.qty = Math.max(1, qty);
  saveCart(cart);
}

function removeLine(key) {
  const cart = getCart().filter(function (item) {
    return cartLineKey(item) !== key;
  });
  saveCart(cart);
}

function cartCount() {
  return getCart().reduce(function (sum, item) {
    return sum + item.qty;
  }, 0);
}

/** تبدیل خطوط سبد به آیتم‌های کامل همراه محصول */
function cartDetailed() {
  const result = [];
  getCart().forEach(function (line) {
    const product = productById(line.id);
    if (!product) return;
    result.push({
      key: cartLineKey(line),
      line: line,
      product: product,
      total: product.price * line.qty
    });
  });
  return result;
}

function cartSubtotal() {
  return cartDetailed().reduce(function (sum, item) {
    return sum + item.total;
  }, 0);
}

function updateCartCount() {
  const count = cartCount();
  document.querySelectorAll("[data-cart-count]").forEach(function (el) {
    el.textContent = faNum(count);
    el.classList.toggle("is-visible", count > 0);
  });
}

/* ---------- علاقه‌مندی ---------- */

function getWishlist() {
  const list = readStore(WISH_KEY, []);
  return Array.isArray(list) ? list : [];
}

function isWished(id) {
  return getWishlist().indexOf(id) !== -1;
}

function toggleWish(id) {
  let list = getWishlist();
  const added = list.indexOf(id) === -1;

  if (added) {
    list.push(id);
    showToast("به علاقه‌مندی‌ها اضافه شد");
  } else {
    list = list.filter(function (item) {
      return item !== id;
    });
    showToast("از علاقه‌مندی‌ها حذف شد");
  }

  writeStore(WISH_KEY, list);
  return added;
}

/* ---------- توست ---------- */

function showToast(message) {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg>' +
    "<span></span>";
  toast.querySelector("span").textContent = message;
  wrap.appendChild(toast);

  setTimeout(function () {
    toast.classList.add("is-out");
    setTimeout(function () {
      toast.remove();
    }, 260);
  }, 2600);
}

/* ---------- ساخت قطعات HTML ---------- */

const ICON_HEART =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.7-7.7 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';

const ICON_ARROW =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>';

function starsHtml(rating) {
  return (
    '<span class="rating">' +
    '<svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>' +
    "<span>" + faNum(Number(rating.toFixed(1))) + "</span></span>"
  );
}

/** کارت محصول یکسان برای همه صفحات */
function productCard(product) {
  const off = percentOff(product);
  const badge = off
    ? '<span class="pcard__badge">٪' + faNum(off) + "</span>"
    : product.addedAt >= "2026-11-14"
    ? '<span class="pcard__badge pcard__badge--new">جدید</span>'
    : "";

  const swatches = product.colors
    .map(function (color) {
      const info = COLORS[color];
      return info
        ? '<span class="swatch" style="background:' + info.hex + '" title="' + info.name + '"></span>'
        : "";
    })
    .join("");

  const oldPrice = off
    ? '<span class="price-old">' + faNum(product.oldPrice) + "</span>"
    : "";

  return (
    '<article class="pcard" data-id="' + product.id + '">' +
    '<div class="pcard__media">' +
    '<a href="product.html?id=' + product.id + '" aria-label="' + product.name + '">' +
    '<img src="' + product.images[0] + '" alt="' + product.name + '" loading="lazy" width="640" height="800" decoding="async">' +
    "</a>" +
    badge +
    '<button class="pcard__wish' + (isWished(product.id) ? " is-active" : "") +
    '" data-wish="' + product.id + '" aria-label="افزودن به علاقه‌مندی">' +
    ICON_HEART +
    "</button>" +
    '<button class="pcard__add" data-add="' + product.id + '">افزودن به سبد</button>' +
    "</div>" +
    '<div class="pcard__body">' +
    '<h3 class="pcard__title"><a href="product.html?id=' + product.id + '">' + product.name + "</a>" +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 5-6"/></svg>' +
    "</h3>" +
    '<div class="pcard__colors">' + swatches + "</div>" +
    '<div class="pcard__prices">' + oldPrice +
    '<span class="price">' + faNum(product.price) + "<small>تومان</small></span>" +
    "</div>" +
    "</div>" +
    "</article>"
  );
}

/* ---------- هدر: منو، جستجو، شمارنده سبد ---------- */

function initHeader() {
  updateCartCount();

  const header = document.querySelector(".header");
  const burger = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector(".mainnav");

  /* منوی موبایل */
  if (burger && nav) {
    burger.addEventListener("click", function () {
      const open = nav.classList.toggle("is-open");
      burger.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", String(open));
    });

    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        nav.classList.remove("is-open");
        burger.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* سایه هدر هنگام اسکرول */
  if (header) {
    const onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 12);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* جستجوی سراسری */
  const search = document.querySelector("[data-search]");
  if (search) {
    const input = search.querySelector(".search__input");
    const results = search.querySelector(".search__results");
    const openers = document.querySelectorAll("[data-search-toggle]");
    const closer = search.querySelector(".search__close");

    const renderResults = function (query) {
      const term = query.trim();
      if (!term) {
        results.innerHTML =
          '<p class="search__empty">نام محصول یا دسته‌بندی را بنویسید…</p>';
        return;
      }

      const matches = PRODUCTS.filter(function (item) {
        return matchesSearch(item, term);
      });
      const shown = matches.slice(0, 6);

      if (!matches.length) {
        results.innerHTML =
          '<p class="search__empty">محصولی با این عبارت پیدا نشد. نام محصول یا دسته را جدا بنویسید؛ مثلاً «کاپشن» یا «شلوار جین».</p>';
        return;
      }

      results.innerHTML =
        shown
          .map(function (item) {
            return (
              '<a class="search__item" href="product.html?id=' + item.id + '">' +
              '<img src="' + item.images[0] + '" alt="' + item.name + '" width="40" height="50" decoding="async">' +
              "<div><strong>" + item.name + "</strong><span>" +
              categoryTitle(item.category) + " · " + toman(item.price) +
              "</span></div></a>"
            );
          })
          .join("") +
        (matches.length > shown.length
          ? '<a class="search__more" href="shop.html?q=' + encodeURIComponent(term) + '">مشاهدهٔ همهٔ ' +
            faNum(matches.length) + " نتیجه</a>"
          : "");
    };

    const openSearch = function () {
      search.classList.add("is-open");
      renderResults("");
      setTimeout(function () {
        input.focus();
      }, 120);
    };

    const closeSearch = function () {
      search.classList.remove("is-open");
    };

    openers.forEach(function (btn) {
      btn.addEventListener("click", openSearch);
    });

    if (closer) closer.addEventListener("click", closeSearch);

    search.addEventListener("click", function (event) {
      if (event.target === search) closeSearch();
    });

    input.addEventListener("input", function () {
      renderResults(input.value);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSearch();
    });
  }

  /* کلیک‌های عمومی روی کارت‌ها (افزودن به سبد و علاقه‌مندی) */
  document.addEventListener("click", function (event) {
    const addBtn = event.target.closest("[data-add]");
    if (addBtn) {
      const card = addBtn.closest("[data-id]");
      const id = addBtn.getAttribute("data-add");
      const product = productById(id);
      if (product) {
        addToCart(
          id,
          card && card.dataset.size ? card.dataset.size : product.sizes[0],
          card && card.dataset.color ? card.dataset.color : product.colors[0],
          1
        );
      }
      return;
    }

    const wishBtn = event.target.closest("[data-wish]");
    if (wishBtn) {
      const id = wishBtn.getAttribute("data-wish");
      const active = toggleWish(id);
      wishBtn.classList.toggle("is-active", active);
    }
  });

  /* ---------- ورود نمایشی با شمارهٔ موبایل ---------- */

  const ACCOUNT_KEY = "rega_account_phone";
  const loginModal = document.querySelector("[data-login-modal]");
  const loginForm = document.querySelector("[data-login-form]");
  const phoneInput = document.querySelector("#accountPhone");
  const loginError = document.querySelector("[data-login-error]");
  const accountLabels = document.querySelectorAll("[data-account-label]");

  function toLatinDigits(value) {
    const fa = "۰۱۲۳۴۵۶۷۸۹";
    const ar = "٠١٢٣٤٥٦٧٨٩";
    return String(value).replace(/[۰-۹٠-٩]/g, function (ch) {
      const index = fa.indexOf(ch);
      return index > -1 ? String(index) : String(ar.indexOf(ch));
    });
  }

  function phoneLabel(phone) {
    return phone.slice(0, 4) + "***" + phone.slice(-2);
  }

  function refreshAccount() {
    const saved = readStore(ACCOUNT_KEY, "");
    accountLabels.forEach(function (el) {
      el.textContent = saved ? phoneLabel(saved) : "ورود / عضویت";
    });
  }

  function openLogin() {
    if (!loginModal) return;
    loginModal.classList.add("is-open");
    document.body.style.overflow = "hidden";
    if (loginError) loginError.textContent = "";
    if (phoneInput) {
      phoneInput.value = readStore(ACCOUNT_KEY, "");
      setTimeout(function () {
        phoneInput.focus();
      }, 180);
    }
  }

  function closeLogin() {
    if (!loginModal) return;
    loginModal.classList.remove("is-open");
    document.body.style.overflow = "";
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-account-open]")) {
      openLogin();
      return;
    }
    if (event.target.closest("[data-login-close]")) {
      closeLogin();
    }
  });

  if (loginModal) {
    loginModal.addEventListener("click", function (event) {
      if (event.target === loginModal) closeLogin();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && loginModal && loginModal.classList.contains("is-open")) {
      closeLogin();
    }
  });

  if (phoneInput) {
    /* ارقام فارسی/عربی همان لحظه به رقم عادی تبدیل می‌شوند */
    phoneInput.addEventListener("input", function () {
      phoneInput.value = toLatinDigits(phoneInput.value).replace(/[^0-9]/g, "").slice(0, 11);
      if (loginError) loginError.textContent = "";
      phoneInput.closest(".field").classList.remove("has-error");
    });
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const phone = phoneInput ? phoneInput.value.trim() : "";
      const valid = /^09\d{9}$/.test(phone);
      if (phoneInput) phoneInput.closest(".field").classList.toggle("has-error", !valid);

      if (!valid) {
        if (loginError) loginError.textContent = "شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.";
        if (phoneInput) phoneInput.focus();
        return;
      }

      writeStore(ACCOUNT_KEY, phone);
      refreshAccount();
      closeLogin();
      showToast("خوش آمدید 👋");
    });
  }

  refreshAccount();
}

whenCatalogReady(initHeader);
