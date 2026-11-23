/* ============================================
   هدر، جستجو و فوتر مشترک تمام صفحات
   برند: کدلاین — با لوگوی رسمی مجموعه
   ============================================ */

const NAV_LINKS = [
  { href: "index.html", label: "خانه", page: "home" },
  { href: "shop.html", label: "فروشگاه", page: "shop" },
  { href: "shop.html?cat=women", label: "زنانه", page: "women" },
  { href: "shop.html?cat=kids", label: "بچگانه", page: "kids" },
  { href: "shop.html?cat=tshirt", label: "تیشرت", page: "tshirt" },
  { href: "shop.html?cat=polo", label: "پولوشرت", page: "polo" },
  { href: "shop.html?cat=shirt", label: "پیراهن", page: "shirt" },
  { href: "shop.html?cat=knit", label: "بافت", page: "knit" },
  { href: "shop.html?cat=sweat", label: "سویشرت", page: "sweat" },
  { href: "shop.html?cat=pants", label: "شلوار", page: "pants" },
  { href: "shop.html?cat=outer", label: "پالتو", page: "outer" },
  { href: "shop.html?cat=accessory", label: "اکسسوری", page: "accessory" },
  { href: "contact.html", label: "تماس", page: "contact" }
];

const LOGO_MARK =
  '<img src="assets/img/codelaine-logo.webp" alt="لوگوی کدلاین" width="46" height="46">' +
  '<span class="logo__text">CODELAINE<small>توسعهٔ وب و ربات</small></span>';

const HEADER_HTML =
  '<div class="topbar">ارسال رایگان برای خرید بالای ۵ میلیون تومان — کد تخفیف اولین خرید <b>CODE10</b></div>' +
  '<header class="header">' +
  '<div class="container header__inner">' +
  '<a class="logo" href="index.html" aria-label="کدلاین، صفحه اصلی">' + LOGO_MARK + "</a>" +
  '<nav class="mainnav" aria-label="منوی اصلی">' +
  '<ul class="mainnav__list">' +
  NAV_LINKS.map(function (link) {
    return '<li><a href="' + link.href + '" data-nav="' + link.page + '">' + link.label + "</a></li>";
  }).join("") +
  "</ul></nav>" +
  '<div class="header__side header__side--end">' +
  '<button class="icon-btn" data-search-toggle aria-label="جستجو" title="جستجو">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg>' +
  "</button>" +
  '<button class="header__account" type="button" data-account-open aria-label="ورود یا ثبت نام">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="3.8"/><path d="M4.8 20.5a7.4 7.4 0 0 1 14.4 0"/></svg>' +
  '<span data-account-label>ورود / عضویت</span></button>' +
  '<a class="icon-btn" href="cart.html" aria-label="سبد خرید" title="سبد خرید">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7.5h12l1 12H5l1-12Z"/><path d="M9 10.5V6a3 3 0 0 1 6 0v4.5"/></svg>' +
  '<span class="cart-count" data-cart-count>۰</span></a>' +
  '<button class="burger" data-menu-toggle aria-expanded="false" aria-label="منو">' +
  "<span></span></button>" +
  "</div>" +
  "</div></header>";

const SEARCH_HTML =
  '<div class="search" data-search>' +
  '<div class="search__panel" role="dialog" aria-label="جستجوی محصولات">' +
  '<div class="search__head">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-3.6-3.6"/></svg>' +
  '<input class="search__input" type="search" placeholder="جستجو در محصولات کدلاین…" aria-label="عبارت جستجو">' +
  '<button class="search__close" type="button">بستن (Esc)</button>' +
  "</div>" +
  '<div class="search__results"></div>' +
  "</div></div>";

const ACCOUNT_MODAL_HTML =
  '<div class="modal account-modal" data-login-modal>' +
  '<div class="modal__box account-box" role="dialog" aria-modal="true" aria-labelledby="accountTitle">' +
  '<div class="modal__head"><h2 id="accountTitle">ورود | ثبت نام</h2>' +
  '<button class="modal__close" type="button" data-login-close aria-label="بستن">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
  "</button></div>" +
  '<form class="account-form" data-login-form novalidate>' +
  '<p class="account-note">برای ورود به حساب کاربری، شمارهٔ موبایل خود را وارد کنید.</p>' +
  '<div class="field">' +
  '<label for="accountPhone">شمارهٔ موبایل</label>' +
  '<input id="accountPhone" name="phone" type="tel" inputmode="numeric" dir="ltr" maxlength="11" placeholder="09121234567" autocomplete="tel">' +
  '<span class="error">شمارهٔ موبایل باید ۱۱ رقم و با ۰۹ شروع شود.</span>' +
  "</div>" +
  '<p class="account-error" data-login-error role="alert"></p>' +
  '<button class="btn btn--primary btn--block" type="submit">ورود</button>' +
  '<p class="account-demo">این یک نمونه‌کار است؛ پیامکی ارسال نمی‌شود و حسابی ساخته نمی‌شود.</p>' +
  "</form></div></div>";

const FOOTER_HTML =
  '<footer class="footer">' +
  '<div class="container">' +
  '<div class="footer__grid">' +
  "<div>" +
  '<a class="logo" href="index.html" aria-label="کدلاین">' + LOGO_MARK + "</a>" +
  '<p class="footer__about">کدلاین یک استودیوی برنامه‌نویسی است که ربات و سایت اختصاصی می‌سازد. این فروشگاه هم فقط به‌عنوان نمونه‌کار طراحی و توسعهٔ وب ساخته شده است.</p>' +
  '<div class="socials">' +
  '<a href="https://instagram.com/codelaine_dev" target="_blank" rel="noopener" aria-label="اینستاگرام کدلاین"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg></a>' +
  '<a href="https://t.me/TiTi_02460_bot" target="_blank" rel="noopener" aria-label="ربات تلگرام کدلاین"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4.5 2.9 11.2c-.8.3-.8 1.4 0 1.7l4.6 1.5 1.7 5.2c.2.7 1.1.8 1.6.3l2.4-2.4 4.5 3.3c.6.4 1.4.1 1.6-.6l3-14.2c.2-.8-.6-1.5-1.3-1.5Z"/><path d="m7.5 14.4 10-7.4-7.3 8.1"/></svg></a>' +
  "</div>" +
  "</div>" +
  "<div>" +
  '<h3 class="footer__title">دسترسی سریع</h3>' +
  '<ul class="footer__list">' +
  '<li><a href="index.html">صفحه اصلی</a></li>' +
  '<li><a href="shop.html">همهٔ محصولات</a></li>' +
  '<li><a href="shop.html?cat=women">زنانه</a></li>' +
  '<li><a href="shop.html?cat=kids">بچگانه</a></li>' +
  '<li><a href="shop.html?cat=polo">پولوشرت</a></li>' +
  '<li><a href="shop.html?cat=shirt">پیراهن</a></li>' +
  '<li><a href="shop.html?cat=outer">پالتو و کاپشن</a></li>' +
  '<li><a href="about.html">دربارهٔ نمونه‌کار</a></li>' +
  "</ul>" +
  "</div>" +
  "<div>" +
  '<h3 class="footer__title">خدمات مشتریان</h3>' +
  '<ul class="footer__list">' +
  '<li><a href="help.html">راهنمای خرید</a></li>' +
  '<li><a href="contact.html">تماس با ما</a></li>' +
  '<li><a href="help.html#size">راهنمای سایز</a></li>' +
  '<li><a href="cart.html">سبد خرید</a></li>' +
  '<li><a href="help.html#returns">شرایط بازگشت کالا</a></li>' +
  '<li><a href="help.html#faq">سوالات متداول</a></li>' +
  '<li><a href="help.html#privacy">حریم خصوصی</a></li>' +
  "</ul>" +
  "</div>" +
  "<div>" +
  '<h3 class="footer__title">ارتباط با ما</h3>' +
  '<p class="footer__about" style="margin-top:0">سفارش، هماهنگی و پاسخ به سؤال‌ها فقط از طریق پیج اینستاگرام یا ربات تلگرام انجام می‌شود.</p>' +
  '<a class="footer__insta" href="https://instagram.com/codelaine_dev" target="_blank" rel="noopener">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/></svg>' +
  '<span dir="ltr">@codelaine_dev</span>' +
  "</a>" +
  '<a class="footer__insta" href="https://t.me/TiTi_02460_bot" target="_blank" rel="noopener">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4.5 2.9 11.2c-.8.3-.8 1.4 0 1.7l4.6 1.5 1.7 5.2c.2.7 1.1.8 1.6.3l2.4-2.4 4.5 3.3c.6.4 1.4.1 1.6-.6l3-14.2c.2-.8-.6-1.5-1.3-1.5Z"/><path d="m7.5 14.4 10-7.4-7.3 8.1"/></svg>' +
  '<span dir="ltr">@TiTi_02460_bot</span>' +
  "</a>" +
  "</div>" +
  "</div>" +
  '<div class="credit">' +
  '<img class="credit__logo" src="assets/img/codelaine-logo.webp" alt="لوگوی کدلاین" width="52" height="52" loading="lazy">' +
  '<div class="credit__text">' +
  "<strong>طراحی و توسعه: کدلاین</strong>" +
  "<span>اگر به ساخت فروشگاه یا سایت اختصاصی نیاز دارید، از طریق پیج اینستاگرام یا ربات تلگرام با ما در تماس باشید.</span>" +
  "</div>" +
  '<a class="credit__btn" href="https://instagram.com/codelaine_dev" target="_blank" rel="noopener">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/></svg>' +
  "صفحهٔ کدلاین در اینستاگرام</a>" +
  '<a class="credit__btn" href="https://t.me/TiTi_02460_bot" target="_blank" rel="noopener">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 4.5 2.9 11.2c-.8.3-.8 1.4 0 1.7l4.6 1.5 1.7 5.2c.2.7 1.1.8 1.6.3l2.4-2.4 4.5 3.3c.6.4 1.4.1 1.6-.6l3-14.2c.2-.8-.6-1.5-1.3-1.5Z"/><path d="m7.5 14.4 10-7.4-7.3 8.1"/></svg>' +
  "ربات کدلاین در تلگرام</a>" +
  "</div>" +
  '<div class="footer__bottom">' +
  "<span>© ۱۴۰۵ کدلاین. تمامی حقوق محفوظ است · این سایت نمونه‌کار کدلاین است.</span>" +
  '<div class="footer__pay"><span>پرداخت آنلاین</span><span>ارسال سراسر کشور</span><span>ضمانت اصالت کالا</span></div>' +
  "</div>" +
  "</div></footer>";

/* تزریق هدر و فوتر مشترک */
(function injectLayout() {
  const headerSlot = document.querySelector("[data-site-header]");
  const footerSlot = document.querySelector("[data-site-footer]");

  if (headerSlot) headerSlot.innerHTML = HEADER_HTML + SEARCH_HTML + ACCOUNT_MODAL_HTML;
  if (footerSlot) footerSlot.innerHTML = FOOTER_HTML;

  const page = document.body.getAttribute("data-page");
  const active = document.querySelector('[data-nav="' + page + '"]');
  if (active) active.classList.add("is-active");
})();
