/* Build 49 — temporary iPhone Player diagnostics. No interaction changes. */
(() => {
  const $ = s => document.querySelector(s);
  const fmt = el => {
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    return Math.round(r.width) + "x" + Math.round(r.height) + "@" + Math.round(r.left) + "," + Math.round(r.top);
  };
  let box;
  function labelAt(x,y) {
    const el = document.elementFromPoint(x,y);
    if (!el) return "none";
    if (el.matches?.("iframe[data-kinetosphere-youtube-bridge]")) return "bridge";
    if (el.closest?.("#ytFrame")) return "host/" + el.tagName.toLowerCase();
    if (el.closest?.(".video-card")) return "card/" + el.tagName.toLowerCase();
    return (el.id || el.className?.toString?.().split(" ")[0] || el.tagName).slice(0,22);
  }
  function tick() {
    const view = $("#playerView");
    if (!view || view.classList.contains("hidden") || !document.body.classList.contains("player-active")) {
      if (box) box.style.display = "none";
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "ks49-frame-diagnostics";
      box.style.cssText = "position:fixed!important;top:calc(1px + env(safe-area-inset-top))!important;left:50%!important;transform:translateX(-50%)!important;max-width:94vw!important;width:max-content!important;z-index:2147483647!important;pointer-events:none!important;background:rgba(255,255,210,.92)!important;color:#111!important;font:600 9px/1.25 monospace!important;padding:3px 5px!important;border:1px solid #000!important;border-radius:3px!important;white-space:normal!important;text-align:center!important;";
      document.body.appendChild(box);
    }
    box.style.display = "block";
    const card = $("#playerView .video-card");
    const host = $("#ytFrame");
    const frame = $("#ytFrame iframe[data-kinetosphere-youtube-bridge]");
    const vv = window.visualViewport;
    const h = host?.getBoundingClientRect();
    const hit = h ? [0.15,0.5,0.85].map(v => labelAt(h.left+h.width*v,h.top+h.height*0.8)).join("/") : "-";
    const frameStyle = frame ? getComputedStyle(frame) : null;
    box.textContent = "KS49 | inner " + innerWidth + "x" + innerHeight
      + " visual " + (vv ? Math.round(vv.width) + "x" + Math.round(vv.height) + " s" + vv.scale.toFixed(2) : "-")
      + " doc " + document.documentElement.scrollWidth
      + " | card " + fmt(card) + " host " + fmt(host)
      + " frame " + fmt(frame) + " | hit " + hit
      + " pointer " + (frameStyle?.pointerEvents || "-");
  }
  setInterval(tick, 850);
  window.addEventListener("resize", tick, {passive:true});
  window.addEventListener("orientationchange", tick, {passive:true});
  document.addEventListener("visibilitychange", tick, {passive:true});
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", tick, {once:true});
  else tick();
})();
