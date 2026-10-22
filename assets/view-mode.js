(function () {
  "use strict";

  const STORAGE_KEY = "aiNewsRadarViewV2";
  const LEGACY_STORAGE_KEY = "aiNewsRadarView";
  const MOBILE_OVERRIDE_KEY = "aiNewsRadarMobileViewOnce";
  const MOBILE_BREAKPOINT = "(max-width: 760px)";
  const VALID_VIEWS = new Set(["mobile", "classic"]);
  const script = document.currentScript;
  const rootHint = script?.dataset.root || "./";
  const rootUrl = new URL(rootHint, window.location.href);
  // 英文版只有手机版一个视角：经典版暂无英文，不渲染入口，也不读取/写入视角偏好。
  // 判据用页面语言（<html lang>），不依赖 data-root 的写法——data-root 既可能是
  // 独占域名下的 "/en/"，也可能是子路径部署下的 "../"，两种都要认成英文版。
  const isEnglishPage = /^en/i.test(document.documentElement?.lang || "");
  const classicAvailable = !isEnglishPage;
  const currentView = document.documentElement.dataset.radarView || "mobile";
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view") || "";
  const isMobileViewport = window.matchMedia(MOBILE_BREAKPOINT).matches;

  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private or hardened browser contexts.
  }

  function readPreference() {
    try {
      const value = window.localStorage.getItem(STORAGE_KEY) || "";
      return VALID_VIEWS.has(value) ? value : "";
    } catch {
      return "";
    }
  }

  function writePreference(view) {
    try {
      if (VALID_VIEWS.has(view)) {
        window.localStorage.setItem(STORAGE_KEY, view);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage can be unavailable in private or hardened browser contexts.
    }
  }

  function readMobileOverride() {
    try {
      const value = window.sessionStorage.getItem(MOBILE_OVERRIDE_KEY) || "";
      window.sessionStorage.removeItem(MOBILE_OVERRIDE_KEY);
      return VALID_VIEWS.has(value) ? value : "";
    } catch {
      return "";
    }
  }

  function writeMobileOverride(view) {
    try {
      if (VALID_VIEWS.has(view)) {
        window.sessionStorage.setItem(MOBILE_OVERRIDE_KEY, view);
      } else {
        window.sessionStorage.removeItem(MOBILE_OVERRIDE_KEY);
      }
    } catch {
      // Storage can be unavailable in private or hardened browser contexts.
    }
  }

  if (!classicAvailable) {
    // 英文版：忽略 ?view= 与已存偏好，不动 localStorage 里中文站的视角选择
  } else if (requestedView === "auto") {
    writePreference("");
    writeMobileOverride("");
  } else if (!isMobileViewport && VALID_VIEWS.has(requestedView)) {
    writePreference(requestedView);
  }

  const mobileOverride = isMobileViewport ? readMobileOverride() : "";
  const preference = isMobileViewport
    ? mobileOverride
    : (requestedView === "auto"
      ? ""
      : (VALID_VIEWS.has(requestedView) ? requestedView : readPreference()));
  const deviceDefault = "mobile";
  const targetView = classicAvailable ? (preference || deviceDefault) : deviceDefault;

  function destination(view) {
    // 英文版只有手机版一个视角，永远停在当前页面。
    if (!classicAvailable) return new URL(".", window.location.href);
    const url = new URL(view === "classic" ? "classic/" : "./", rootUrl);
    const passthrough = new URLSearchParams(window.location.search);
    passthrough.delete("view");
    url.search = passthrough.toString();
    url.hash = window.location.hash;
    return url;
  }

  function cleanViewQuery() {
    if (!requestedView) return;
    const cleanUrl = destination(currentView);
    window.history.replaceState(null, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }

  function chooseView(view) {
    if (!VALID_VIEWS.has(view) || !classicAvailable) return;
    if (isMobileViewport) writeMobileOverride(view);
    else writePreference(view);
    if (view === currentView) return;
    window.location.assign(destination(view).href);
  }

  if (targetView !== currentView) {
    window.location.replace(destination(targetView).href);
    return;
  }

  cleanViewQuery();

  function mountSwitches() {
    document.querySelectorAll("[data-radar-view-target]").forEach((button) => {
      const view = button.dataset.radarViewTarget || "";
      const active = view === currentView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      button.addEventListener("click", () => chooseView(view));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountSwitches, { once: true });
  } else {
    mountSwitches();
  }

  window.AINewsRadarView = {
    current: currentView,
    preference: preference || "auto",
    choose: chooseView,
    reset() {
      writePreference("");
      writeMobileOverride("");
      window.location.replace(destination(deviceDefault).href);
    },
  };
})();
