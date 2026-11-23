/* ============================================
   اتصال اختیاری به بک‌اند (backend/)
   اگر بک‌اند در حال اجرا باشد، کاتالوگ، تنظیمات، کدهای تخفیف و ثبت سفارش
   از API خوانده می‌شوند. اگر نباشد (مثل نسخهٔ GitHub Pages) هیچ کاری نمی‌کند
   و سایت با همان دادهٔ محلی کار می‌کند.
   ============================================ */

(function () {
  "use strict";

  var API_ROOT = "api";
  window.API_AVAILABLE = false;

  function readJson(response) {
    return response
      .json()
      .catch(function () {
        return {};
      });
  }

  function looksJson(response) {
    var type = response.headers.get("content-type") || "";
    return response.ok && type.indexOf("application/json") > -1;
  }

  async function loadFromBackend() {
    try {
      var health = await fetch(API_ROOT + "/health", {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      if (!looksJson(health)) return false;

      var catalog = await fetch(API_ROOT + "/products", {
        headers: { Accept: "application/json" },
        credentials: "same-origin"
      });
      if (!looksJson(catalog)) return false;
      var catalogData = await readJson(catalog);
      if (!Array.isArray(catalogData.products) || !catalogData.products.length) return false;

      PRODUCTS.splice.apply(PRODUCTS, [0, PRODUCTS.length].concat(catalogData.products));

      try {
        var settingsResponse = await fetch(API_ROOT + "/settings", {
          headers: { Accept: "application/json" },
          credentials: "same-origin"
        });
        if (looksJson(settingsResponse)) {
          var settingsData = await readJson(settingsResponse);
          var settings = settingsData.settings || {};
          if (typeof settings.shippingCost === "number") SHIPPING_COST = settings.shippingCost;
          if (typeof settings.freeShippingFrom === "number") FREE_SHIPPING_FROM = settings.freeShippingFrom;
          if (settings.coupons && typeof settings.coupons === "object") {
            Object.keys(COUPONS).forEach(function (code) {
              delete COUPONS[code];
            });
            Object.keys(settings.coupons).forEach(function (code) {
              COUPONS[code] = settings.coupons[code];
            });
          }
        }
      } catch (error) {
        /* تنظیمات اختیاری است؛ مقادیر محلی می‌مانند */
      }

      window.API_AVAILABLE = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  window.CATALOG_READY = loadFromBackend();

  window.ShopAPI = {
    available: function () {
      return window.API_AVAILABLE === true;
    },

    placeOrder: async function (payload) {
      try {
        var response = await fetch(API_ROOT + "/orders", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload)
        });
        var data = await readJson(response);
        if (response.ok && data.order) return { ok: true, order: data.order };
        return { ok: false, error: data.error || "ثبت سفارش انجام نشد" };
      } catch (error) {
        return { ok: false, error: "اتصال به سرور برقرار نیست" };
      }
    },

    trackOrder: async function (code, phone) {
      var params = new URLSearchParams({ code: String(code || "").trim().toUpperCase() });
      if (phone) params.set("phone", String(phone).trim());
      try {
        var response = await fetch(API_ROOT + "/orders/track?" + params.toString(), {
          headers: { Accept: "application/json" },
          credentials: "same-origin"
        });
        var data = await readJson(response);
        if (response.ok && data.order) return { ok: true, order: data.order };
        return { ok: false, error: data.error || "سفارشی با این کد پیدا نشد" };
      } catch (error) {
        return { ok: false, error: "اتصال به سرور برقرار نیست" };
      }
    }
  };
})();
