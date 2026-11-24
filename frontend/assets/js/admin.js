

(function () {
  "use strict";

  var root = document.getElementById("admin-root");
  var toastEl = document.getElementById("toast");

  var CATEGORIES = [
    { id: "tshirt", title: "تیشرت" },
    { id: "polo", title: "پولوشرت" },
    { id: "shirt", title: "پیراهن" },
    { id: "knit", title: "بافت و کاردیگان" },
    { id: "sweat", title: "سویشرت و هودی" },
    { id: "pants", title: "شلوار" },
    { id: "outer", title: "پالتو و کاپشن" },
    { id: "accessory", title: "اکسسوری" }
  ];

  var STATUSES = {
    pending: "در انتظار",
    processing: "در حال پردازش",
    shipped: "ارسال شده",
    delivered: "تحویل شده",
    cancelled: "لغو شده"
  };

  var NAV = [
    ["dashboard", "📊", "داشبورد"],
    ["products", "🛍️", "محصولات"],
    ["orders", "📦", "سفارش‌ها"],
    ["settings", "⚙️", "تنظیمات"]
  ];

  var state = {
    user: null,
    page: "dashboard",
    stats: null,
    recent: [],
    products: [],
    orders: [],
    settings: null,
    loading: false,
    orderFilter: { q: "", status: "" },
    productFilter: { q: "", category: "" }
  };

  

  function $(selector, scope) {
    return (scope || document).querySelector(selector);
  }

  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  var ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function esc(value) {
    return String(value === undefined || value === null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ESCAPES[ch];
    });
  }

  function money(value) {
    return Number(value || 0).toLocaleString("fa-IR");
  }

  function dateFa(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
  }

  var toastTimer;
  function toast(message, isError) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle("err", !!isError);
    toastEl.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("on");
    }, 2800);
  }

  function categoryTitle(id) {
    var found = CATEGORIES.filter(function (c) {
      return c.id === id;
    })[0];
    return found ? found.title : id;
  }

  

  function cookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  async function primeCsrf() {
    try {
      await fetch("/api/csrf", { credentials: "same-origin" });
    } catch (error) {
      
    }
  }

  async function api(path, options) {
    var settings = options || {};
    var method = settings.method || "GET";
    var init = { method: method, credentials: "same-origin", headers: {} };

    if (settings.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(settings.body);
    }
    if (method !== "GET") {
      if (!cookie("csrf_token")) await primeCsrf();
      init.headers["X-CSRF-Token"] = cookie("csrf_token");
    }

    var response;
    try {
      response = await fetch(path, init);
    } catch (error) {
      return { ok: false, status: 0, data: { error: "به سرور وصل نشد" } };
    }

    var data = {};
    try {
      data = await response.json();
    } catch (error) {}

    if (response.status === 401 && state.user) {
      state.user = null;
      renderLogin("نشست شما منقضی شد؛ دوباره وارد شوید.");
    }
    return { ok: response.ok, status: response.status, data: data };
  }

  

  function renderLogin(message) {
    root.innerHTML =
      '<div class="adm-login">' +
      '<form class="adm-login__card" id="loginForm" autocomplete="on">' +
      '<p class="adm-login__brand">CODELAINE</p>' +
      "<h1>پنل مدیریت فروشگاه</h1>" +
      '<p class="muted">برای مدیریت محصول‌ها، سفارش‌ها و تنظیمات وارد شوید.</p>' +
      '<label class="adm-field"><span>نام کاربری</span>' +
      '<input class="adm-input" id="admUser" name="username" autocomplete="username" required></label>' +
      '<label class="adm-field"><span>رمز عبور</span>' +
      '<input class="adm-input" id="admPass" name="password" type="password" autocomplete="current-password" required></label>' +
      '<p class="adm-error" id="loginError">' +
      esc(message || "") +
      "</p>" +
      '<button class="adm-btn adm-btn--full" type="submit" id="loginBtn">ورود</button>' +
      '<a class="back" href="index.html">← بازگشت به فروشگاه</a>' +
      "</form></div>";

    var form = $("#loginForm");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      doLogin();
    });
    var user = $("#admUser");
    if (user) user.focus();
  }

  async function doLogin() {
    var username = ($("#admUser") || {}).value || "";
    var password = ($("#admPass") || {}).value || "";
    var errorEl = $("#loginError");
    var button = $("#loginBtn");

    if (!username.trim() || !password) {
      if (errorEl) errorEl.textContent = "نام کاربری و رمز عبور را وارد کنید.";
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "در حال ورود…";
    }

    var result = await api("/api/auth/login", {
      method: "POST",
      body: { username: username.trim(), password: password }
    });

    if (!result.ok) {
      if (button) {
        button.disabled = false;
        button.textContent = "ورود";
      }
      if (errorEl) errorEl.textContent = result.data.error || "ورود انجام نشد.";
      return;
    }

    state.user = result.data.user;
    state.page = "dashboard";
    await loadDashboard();
    renderShell();
    toast("خوش آمدید " + (state.user.username || ""));
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.products = [];
    state.orders = [];
    state.stats = null;
    renderLogin();
  }

  

  async function loadDashboard() {
    var result = await api("/api/admin/stats");
    if (!result.ok) {
      toast(result.data.error || "آمار خوانده نشد", true);
      return;
    }
    state.stats = result.data.stats || null;
    state.recent = result.data.recent || [];
  }

  async function loadProducts() {
    var result = await api("/api/admin/products");
    if (!result.ok) {
      toast(result.data.error || "محصول‌ها خوانده نشدند", true);
      return;
    }
    state.products = result.data.products || [];
  }

  async function loadOrders() {
    var params = new URLSearchParams();
    if (state.orderFilter.q) params.set("q", state.orderFilter.q);
    if (state.orderFilter.status) params.set("status", state.orderFilter.status);
    var result = await api("/api/admin/orders" + (params.toString() ? "?" + params : ""));
    if (!result.ok) {
      toast(result.data.error || "سفارش‌ها خوانده نشدند", true);
      return;
    }
    state.orders = result.data.orders || [];
  }

  async function loadSettings() {
    var result = await api("/api/admin/settings");
    if (!result.ok) {
      toast(result.data.error || "تنظیمات خوانده نشد", true);
      return;
    }
    state.settings = result.data.settings || { shippingCost: 0, freeShippingFrom: 0, coupons: {} };
  }

  

  function renderShell() {
    var navHtml = NAV.map(function (item) {
      return (
        '<button type="button" data-act="nav" data-page="' +
        item[0] +
        '" class="' +
        (state.page === item[0] ? "on" : "") +
        '"><span>' +
        item[1] +
        "</span><span>" +
        item[2] +
        "</span></button>"
      );
    }).join("");

    root.innerHTML =
      '<div class="adm-shell">' +
      '<aside class="adm-side">' +
      '<div class="adm-side__brand">CODELAINE</div>' +
      '<div class="adm-side__user">' +
      esc((state.user && state.user.title) || "مدیر فروشگاه") +
      "</div>" +
      '<nav class="adm-nav">' +
      navHtml +
      "</nav>" +
      '<div class="adm-side__foot">' +
      '<a href="index.html">🏬 دیدن فروشگاه</a>' +
      '<button type="button" data-act="logout">🚪 خروج</button>' +
      "</div>" +
      "</aside>" +
      '<main class="adm-main" id="admMain"></main>' +
      "</div>";

    renderPage();
  }

  function renderPage() {
    var main = $("#admMain");
    if (!main) return;
    if (state.page === "products") main.innerHTML = productsHTML();
    else if (state.page === "orders") main.innerHTML = ordersHTML();
    else if (state.page === "settings") main.innerHTML = settingsHTML();
    else main.innerHTML = dashboardHTML();
  }

  function headerHTML(title, subtitle, actions) {
    return (
      '<div class="adm-top"><div><h1>' +
      esc(title) +
      "</h1><p>" +
      esc(subtitle || "") +
      "</p></div><div>" +
      (actions || "") +
      "</div></div>"
    );
  }

  

  function dashboardHTML() {
    var stats = state.stats || {};
    var byStatus = stats.byStatus || {};
    var cards = [
      ["محصول‌های فعال", money(stats.products)],
      ["سفارش‌ها", money(stats.orders)],
      ["فروش (تومان)", money(stats.revenue)],
      ["در انتظار بررسی", money(byStatus.pending)]
    ];

    var cardsHtml = cards
      .map(function (card) {
        return '<div class="adm-card"><span>' + card[0] + "</span><b>" + card[1] + "</b></div>";
      })
      .join("");

    var rows = (state.recent || [])
      .map(function (order) {
        return (
          "<tr><td>" +
          esc(order.code) +
          "</td><td>" +
          dateFa(order.createdAt) +
          "</td><td>" +
          esc(order.name) +
          "</td><td>" +
          money(order.total) +
          "</td><td>" +
          statusTag(order.status) +
          "</td></tr>"
        );
      })
      .join("");

    return (
      headerHTML("داشبورد", "خلاصهٔ وضعیت فروشگاه") +
      '<div class="adm-cards">' +
      cardsHtml +
      "</div>" +
      '<section class="adm-panel"><h2>آخرین سفارش‌ها</h2><div class="adm-table-wrap">' +
      '<table class="adm-table"><thead><tr><th>کد</th><th>تاریخ</th><th>مشتری</th><th>مبلغ (تومان)</th><th>وضعیت</th></tr></thead>' +
      "<tbody>" +
      (rows || '<tr><td class="empty" colspan="5">هنوز سفارشی ثبت نشده است.</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  function statusTag(status) {
    return '<span class="adm-tag adm-tag--' + esc(status) + '">' + esc(STATUSES[status] || status) + "</span>";
  }

  

  function filteredProducts() {
    var term = (state.productFilter.q || "").trim();
    return state.products.filter(function (product) {
      var matchTerm = !term || (product.name + " " + product.id).indexOf(term) > -1;
      var matchCategory = !state.productFilter.category || product.category === state.productFilter.category;
      return matchTerm && matchCategory;
    });
  }

  function productsHTML() {
    var options = CATEGORIES.map(function (c) {
      return (
        '<option value="' +
        c.id +
        '"' +
        (state.productFilter.category === c.id ? " selected" : "") +
        ">" +
        esc(c.title) +
        "</option>"
      );
    }).join("");

    var rows = filteredProducts()
      .map(function (product) {
        return (
          "<tr><td>" +
          (product.images && product.images[0]
            ? '<img src="' + esc(product.images[0]) + '" alt="">'
            : "—") +
          "</td><td>" +
          esc(product.name) +
          '<div class="adm-muted">' +
          esc(product.id) +
          "</div></td><td>" +
          esc(categoryTitle(product.category)) +
          "</td><td>" +
          money(product.price) +
          "</td><td>" +
          (product.oldPrice ? money(product.oldPrice) : "—") +
          "</td><td>" +
          (product.active ? "فعال" : "غیرفعال") +
          '</td><td><div class="actions">' +
          '<button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-act="editProduct" data-id="' +
          esc(product.id) +
          '">ویرایش</button>' +
          (product.active
            ? '<button class="adm-btn adm-btn--warn adm-btn--sm" type="button" data-act="deleteProduct" data-id="' +
              esc(product.id) +
              '">حذف</button>'
            : "") +
          "</div></td></tr>"
        );
      })
      .join("");

    return (
      headerHTML(
        "محصولات",
        "قیمت، موجودی و اطلاعات کاتالوگ را مدیریت کنید",
        '<button class="adm-btn" type="button" data-act="newProduct">+ محصول جدید</button>'
      ) +
      '<div class="adm-toolbar">' +
      '<input class="adm-input grow" id="productSearch" placeholder="جستجوی نام یا شناسه…" value="' +
      esc(state.productFilter.q) +
      '">' +
      '<select class="adm-input" id="productCategory"><option value="">همهٔ دسته‌ها</option>' +
      options +
      "</select></div>" +
      '<section class="adm-panel"><div class="adm-table-wrap"><table class="adm-table">' +
      "<thead><tr><th></th><th>نام</th><th>دسته</th><th>قیمت (تومان)</th><th>قیمت قبل</th><th>وضعیت</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td class="empty" colspan="7">محصولی پیدا نشد.</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  function productFormHTML(product) {
    var isNew = !product;
    var p = product || {
      id: "",
      name: "",
      category: CATEGORIES[0].id,
      price: 0,
      oldPrice: 0,
      images: [],
      colors: [],
      sizes: [],
      rating: 0,
      reviews: 0,
      sales: 0,
      addedAt: "",
      material: "",
      fit: "",
      desc: "",
      active: true
    };

    var categoryOptions = CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '"' + (p.category === c.id ? " selected" : "") + ">" + esc(c.title) + "</option>";
    }).join("");

    return (
      '<div class="adm-modal-bg" data-modal><div class="adm-modal">' +
      "<h3>" +
      (isNew ? "محصول جدید" : "ویرایش محصول") +
      "</h3>" +
      '<div class="adm-grid">' +
      '<label class="adm-field"><span>شناسه (حروف کوچک انگلیسی و خط تیره)</span>' +
      '<input class="adm-input" id="pId" value="' +
      esc(p.id) +
      '"' +
      (isNew ? "" : " disabled") +
      "></label>" +
      '<label class="adm-field"><span>نام محصول</span><input class="adm-input" id="pName" value="' +
      esc(p.name) +
      '"></label>' +
      '<label class="adm-field"><span>دسته</span><select class="adm-input" id="pCategory">' +
      categoryOptions +
      "</select></label>" +
      '<label class="adm-field"><span>قیمت (تومان)</span><input class="adm-input" id="pPrice" type="number" min="0" value="' +
      esc(p.price) +
      '"></label>' +
      '<label class="adm-field"><span>قیمت قبل از تخفیف (۰ = بدون تخفیف)</span><input class="adm-input" id="pOldPrice" type="number" min="0" value="' +
      esc(p.oldPrice) +
      '"></label>' +
      '<label class="adm-field"><span>امتیاز (۰ تا ۵)</span><input class="adm-input" id="pRating" type="number" step="0.1" min="0" max="5" value="' +
      esc(p.rating) +
      '"></label>' +
      '<label class="adm-field"><span>تعداد نظرات</span><input class="adm-input" id="pReviews" type="number" min="0" value="' +
      esc(p.reviews) +
      '"></label>' +
      '<label class="adm-field"><span>تعداد فروش</span><input class="adm-input" id="pSales" type="number" min="0" value="' +
      esc(p.sales) +
      '"></label>' +
      '<label class="adm-field wide"><span>تصاویر (با کاما جدا کنید)</span><input class="adm-input" id="pImages" value="' +
      esc((p.images || []).join(", ")) +
      '"></label>' +
      '<label class="adm-field"><span>رنگ‌ها (کدها)</span><input class="adm-input" id="pColors" value="' +
      esc((p.colors || []).join(", ")) +
      '"></label>' +
      '<label class="adm-field"><span>سایزها</span><input class="adm-input" id="pSizes" value="' +
      esc((p.sizes || []).join(", ")) +
      '"></label>' +
      '<label class="adm-field"><span>جنس</span><input class="adm-input" id="pMaterial" value="' +
      esc(p.material) +
      '"></label>' +
      '<label class="adm-field"><span>فرم/برش</span><input class="adm-input" id="pFit" value="' +
      esc(p.fit) +
      '"></label>' +
      '<label class="adm-field wide"><span>توضیحات</span><textarea class="adm-input" id="pDesc">' +
      esc(p.desc) +
      "</textarea></label>" +
      "</div>" +
      '<label class="adm-field"><span><input type="checkbox" id="pActive"' +
      (p.active ? " checked" : "") +
      "> نمایش در فروشگاه</span></label>" +
      '<div class="adm-modal__actions">' +
      '<button class="adm-btn adm-btn--ghost" type="button" data-act="closeModal">انصراف</button>' +
      '<button class="adm-btn" type="button" data-act="saveProduct" data-id="' +
      esc(isNew ? "" : p.id) +
      '">ذخیره</button>' +
      "</div></div></div>"
    );
  }

  async function saveProduct(id) {
    var payload = {
      name: ($("#pName") || {}).value || "",
      category: ($("#pCategory") || {}).value || "",
      price: Number(($("#pPrice") || {}).value || 0),
      oldPrice: Number(($("#pOldPrice") || {}).value || 0),
      rating: Number(($("#pRating") || {}).value || 0),
      reviews: Number(($("#pReviews") || {}).value || 0),
      sales: Number(($("#pSales") || {}).value || 0),
      images: ($("#pImages") || {}).value || "",
      colors: ($("#pColors") || {}).value || "",
      sizes: ($("#pSizes") || {}).value || "",
      material: ($("#pMaterial") || {}).value || "",
      fit: ($("#pFit") || {}).value || "",
      desc: ($("#pDesc") || {}).value || "",
      active: !!($("#pActive") || {}).checked
    };
    if (!id) payload.id = (($("#pId") || {}).value || "").trim().toLowerCase();

    var result = id
      ? await api("/api/admin/products/" + encodeURIComponent(id), { method: "PUT", body: payload })
      : await api("/api/admin/products", { method: "POST", body: payload });

    if (!result.ok) {
      toast(result.data.error || "ذخیره نشد", true);
      return;
    }

    closeModal();
    await loadProducts();
    renderPage();
    toast("محصول ذخیره شد ✓");
  }

  async function deleteProduct(id) {
    if (!confirm("این محصول از فروشگاه حذف شود؟ (سفارش‌های قبلی دست‌نخورده می‌مانند)")) return;
    var result = await api("/api/admin/products/" + encodeURIComponent(id), { method: "DELETE" });
    if (!result.ok) {
      toast(result.data.error || "حذف نشد", true);
      return;
    }
    await loadProducts();
    renderPage();
    toast("محصول حذف شد");
  }

  

  function ordersHTML() {
    var statusOptions = Object.keys(STATUSES)
      .map(function (key) {
        return (
          '<option value="' + key + '"' + (state.orderFilter.status === key ? " selected" : "") + ">" + STATUSES[key] + "</option>"
        );
      })
      .join("");

    var rows = state.orders
      .map(function (order) {
        var count = (order.items || []).reduce(function (sum, item) {
          return sum + Number(item.qty || 0);
        }, 0);
        var select = Object.keys(STATUSES)
          .map(function (key) {
            return '<option value="' + key + '"' + (order.status === key ? " selected" : "") + ">" + STATUSES[key] + "</option>";
          })
          .join("");

        return (
          "<tr><td>" +
          esc(order.code) +
          "</td><td>" +
          dateFa(order.createdAt) +
          "</td><td>" +
          esc(order.name) +
          '<div class="adm-muted">' +
          esc(order.phone) +
          "</div></td><td>" +
          money(count) +
          "</td><td>" +
          money(order.total) +
          "</td><td>" +
          '<select class="adm-input" data-order-status="' +
          esc(order.code) +
          '">' +
          select +
          "</select></td><td>" +
          '<button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-act="orderDetail" data-code="' +
          esc(order.code) +
          '">جزئیات</button>' +
          "</td></tr>"
        );
      })
      .join("");

    return (
      headerHTML("سفارش‌ها", "وضعیت سفارش‌ها را به‌روز کنید و جزئیات را ببینید") +
      '<div class="adm-toolbar">' +
      '<input class="adm-input grow" id="orderSearch" placeholder="جستجوی کد، نام یا موبایل…" value="' +
      esc(state.orderFilter.q) +
      '">' +
      '<select class="adm-input" id="orderStatus"><option value="">همهٔ وضعیت‌ها</option>' +
      statusOptions +
      "</select></div>" +
      '<section class="adm-panel"><div class="adm-table-wrap"><table class="adm-table">' +
      "<thead><tr><th>کد</th><th>تاریخ</th><th>مشتری</th><th>تعداد</th><th>مبلغ (تومان)</th><th>وضعیت</th><th></th></tr></thead><tbody>" +
      (rows || '<tr><td class="empty" colspan="7">سفارشی با این فیلتر پیدا نشد.</td></tr>') +
      "</tbody></table></div></section>"
    );
  }

  async function openOrderDetail(code) {
    var result = await api("/api/admin/orders/" + encodeURIComponent(code));
    if (!result.ok) {
      toast(result.data.error || "سفارش خوانده نشد", true);
      return;
    }
    var order = result.data.order;
    var items = (order.items || [])
      .map(function (item) {
        return (
          "<tr><td>" +
          esc(item.name) +
          "</td><td>" +
          esc(item.size) +
          "</td><td>" +
          esc(item.color || "—") +
          "</td><td>" +
          money(item.qty) +
          "</td><td>" +
          money(item.price * item.qty) +
          "</td></tr>"
        );
      })
      .join("");

    openModal(
      '<div class="adm-modal-bg" data-modal><div class="adm-modal">' +
        "<h3>سفارش " +
        esc(order.code) +
        "</h3>" +
        '<p class="adm-muted">' +
        dateFa(order.createdAt) +
        " — " +
        esc(order.name) +
        " — " +
        esc(order.phone) +
        " — " +
        esc(order.city) +
        "</p>" +
        '<p class="adm-muted">' +
        esc(order.address) +
        "</p>" +
        '<table class="adm-items"><thead><tr><th>کالا</th><th>سایز</th><th>رنگ</th><th>تعداد</th><th>مبلغ</th></tr></thead><tbody>' +
        items +
        "</tbody></table>" +
        '<div class="adm-summary"><span>جمع کالاها</span><span>' +
        money(order.subtotal) +
        " تومان</span></div>" +
        (order.discount
          ? '<div class="adm-summary"><span>تخفیف' +
            (order.coupon ? " (" + esc(order.coupon) + ")" : "") +
            "</span><span>" +
            money(order.discount) +
            "− تومان</span></div>"
          : "") +
        '<div class="adm-summary"><span>ارسال</span><span>' +
        (order.shipping ? money(order.shipping) + " تومان" : "رایگان") +
        "</span></div>" +
        '<div class="adm-summary total"><span>قابل پرداخت</span><span>' +
        money(order.total) +
        " تومان</span></div>" +
        '<div class="adm-modal__actions"><button class="adm-btn" type="button" data-act="closeModal">بستن</button></div>' +
        "</div></div>"
    );
  }

  async function updateOrderStatus(code, status) {
    var result = await api("/api/admin/orders/" + encodeURIComponent(code), {
      method: "PUT",
      body: { status: status }
    });
    if (!result.ok) {
      toast(result.data.error || "وضعیت ذخیره نشد", true);
      return;
    }
    var order = state.orders.filter(function (item) {
      return item.code === code;
    })[0];
    if (order) order.status = status;
    toast("وضعیت سفارش به‌روز شد ✓");
    if (state.page === "dashboard") {
      await loadDashboard();
      renderPage();
    }
  }

  

  function couponRows(coupons) {
    var rows = Object.keys(coupons || {})
      .map(function (code) {
        var coupon = coupons[code] || {};
        return couponRowHTML(code, coupon.percent, coupon.label);
      })
      .join("");
    return rows || couponRowHTML("", "", "");
  }

  function couponRowHTML(code, percent, label) {
    return (
      '<div class="adm-coupon-row" data-coupon>' +
      '<input class="adm-input" data-coupon-code placeholder="کد (مثل CODE10)" value="' +
      esc(code) +
      '">' +
      '<input class="adm-input" data-coupon-percent type="number" min="1" max="90" placeholder="٪" value="' +
      esc(percent) +
      '">' +
      '<input class="adm-input" data-coupon-label placeholder="توضیح کد" value="' +
      esc(label) +
      '">' +
      '<button class="adm-btn adm-btn--warn adm-btn--sm" type="button" data-act="removeCoupon">حذف</button>' +
      "</div>"
    );
  }

  function settingsHTML() {
    if (!state.settings) {
      return headerHTML("تنظیمات", "در حال بارگذاری…");
    }
    return (
      headerHTML("تنظیمات", "هزینهٔ ارسال، سقف ارسال رایگان و کدهای تخفیف") +
      '<section class="adm-panel"><h2>ارسال</h2>' +
      '<div class="adm-grid">' +
      '<label class="adm-field"><span>هزینهٔ ارسال (تومان)</span><input class="adm-input" id="setShipping" type="number" min="0" value="' +
      esc(state.settings.shippingCost) +
      '"></label>' +
      '<label class="adm-field"><span>ارسال رایگان از (تومان)</span><input class="adm-input" id="setFreeFrom" type="number" min="0" value="' +
      esc(state.settings.freeShippingFrom) +
      '"></label>' +
      "</div></section>" +
      '<section class="adm-panel"><h2>کدهای تخفیف</h2>' +
      '<div id="couponList">' +
      couponRows(state.settings.coupons) +
      "</div>" +
      '<button class="adm-btn adm-btn--ghost adm-btn--sm" type="button" data-act="addCoupon">+ افزودن کد</button>' +
      "</section>" +
      '<button class="adm-btn" type="button" data-act="saveSettings">ذخیرهٔ تنظیمات</button>'
    );
  }

  async function saveSettings() {
    var coupons = {};
    $$("[data-coupon]").forEach(function (row) {
      var code = (($("[data-coupon-code]", row) || {}).value || "").trim().toUpperCase();
      var percent = Number((($("[data-coupon-percent]", row) || {}).value || 0));
      var label = (($("[data-coupon-label]", row) || {}).value || "").trim();
      if (!code) return;
      coupons[code] = { percent: percent, label: label };
    });

    var result = await api("/api/admin/settings", {
      method: "PUT",
      body: {
        shippingCost: Number(($("#setShipping") || {}).value || 0),
        freeShippingFrom: Number(($("#setFreeFrom") || {}).value || 0),
        coupons: coupons
      }
    });

    if (!result.ok) {
      toast(result.data.error || "تنظیمات ذخیره نشد", true);
      return;
    }
    state.settings = result.data.settings;
    renderPage();
    toast("تنظیمات ذخیره شد ✓");
  }

  

  function openModal(html) {
    closeModal();
    document.body.insertAdjacentHTML("beforeend", html);
  }

  function closeModal() {
    $$("[data-modal]").forEach(function (element) {
      element.remove();
    });
  }

  

  async function go(page) {
    state.page = page;
    if (page === "dashboard") await loadDashboard();
    if (page === "products") await loadProducts();
    if (page === "orders") await loadOrders();
    if (page === "settings") await loadSettings();
    renderShell();
  }

  var actions = {
    nav: function (el) {
      go(el.dataset.page);
    },
    logout: logout,
    closeModal: closeModal,
    newProduct: function () {
      openModal(productFormHTML(null));
    },
    editProduct: function (el) {
      var product = state.products.filter(function (item) {
        return item.id === el.dataset.id;
      })[0];
      if (product) openModal(productFormHTML(product));
    },
    saveProduct: function (el) {
      saveProduct(el.dataset.id || "");
    },
    deleteProduct: function (el) {
      deleteProduct(el.dataset.id);
    },
    orderDetail: function (el) {
      openOrderDetail(el.dataset.code);
    },
    saveSettings: saveSettings,
    addCoupon: function () {
      var list = $("#couponList");
      if (list) list.insertAdjacentHTML("beforeend", couponRowHTML("", "", ""));
    },
    removeCoupon: function (el) {
      var row = el.closest("[data-coupon]");
      if (row) row.remove();
    }
  };

  document.addEventListener("click", function (event) {
    if (event.target.classList && event.target.classList.contains("adm-modal-bg")) {
      closeModal();
      return;
    }
    var el = event.target.closest("[data-act]");
    if (!el) return;
    var handler = actions[el.dataset.act];
    if (!handler) return;
    try {
      var result = handler(el, event);
      if (result && typeof result.catch === "function") {
        result.catch(function () {
          toast("خطا در انجام عملیات", true);
        });
      }
    } catch (error) {
      toast("خطا در انجام عملیات", true);
    }
  });

  document.addEventListener("input", function (event) {
    if (event.target.id === "productSearch") {
      state.productFilter.q = event.target.value;
      var main = $("#admMain");
      if (main) main.innerHTML = productsHTML();
      var input = $("#productSearch");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
    if (event.target.id === "orderSearch") {
      state.orderFilter.q = event.target.value;
      clearTimeout(actions._orderTimer);
      actions._orderTimer = setTimeout(async function () {
        await loadOrders();
        var main = $("#admMain");
        if (main) main.innerHTML = ordersHTML();
      }, 350);
    }
  });

  document.addEventListener("change", function (event) {
    if (event.target.id === "productCategory") {
      state.productFilter.category = event.target.value;
      var main = $("#admMain");
      if (main) main.innerHTML = productsHTML();
    }
    if (event.target.id === "orderStatus") {
      state.orderFilter.status = event.target.value;
      loadOrders().then(function () {
        var main = $("#admMain");
        if (main) main.innerHTML = ordersHTML();
      });
    }
    var code = event.target.dataset ? event.target.dataset.orderStatus : "";
    if (code) updateOrderStatus(code, event.target.value);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeModal();
  });

  

  async function boot() {
    await primeCsrf();
    var me = await api("/api/auth/me");
    if (!me.ok) {
      renderLogin(me.status === 0 ? "به سرور وصل نشد؛ بک‌اند را اجرا کنید." : "");
      return;
    }
    state.user = me.data.user;
    await loadDashboard();
    renderShell();
  }

  boot();
})();
