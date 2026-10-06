/* RC36 diagnostic-only viewport probe.
   No Player geometry changes. Temporarily surfaces native iPhone rotation metrics
   so the first-landscape failure can be measured instead of guessed. */
(() => {
  const html=document.documentElement;
  if(!html.classList.contains("native-capacitor-shell") || html.classList.contains("native-ipad-shell")) return;

  const style=document.createElement("style");
  style.textContent=`
    #ksViewportDiag{
      position:fixed;left:4px;bottom:4px;z-index:2147483647;
      max-width:96vw;padding:4px 6px;border-radius:6px;
      background:rgba(0,0,0,.78);color:#fff;
      font:10px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace;
      white-space:pre-wrap;pointer-events:none;
    }
    @media (orientation:portrait){#ksViewportDiag{font-size:9px}}
  `;
  document.head.appendChild(style);

  const box=document.createElement("div");
  box.id="ksViewportDiag";
  document.documentElement.appendChild(box);

  function safeInset(side){
    const probe=document.createElement("div");
    probe.style.cssText=`position:fixed;${side}:0;visibility:hidden;padding-${side}:env(safe-area-inset-${side});`;
    document.body.appendChild(probe);
    const v=parseFloat(getComputedStyle(probe)[`padding${side[0].toUpperCase()+side.slice(1)}`])||0;
    probe.remove();
    return Math.round(v);
  }

  function rect(el){ if(!el) return "-"; const r=el.getBoundingClientRect(); return Math.round(r.width)+"x"+Math.round(r.height); }

  function render(label=""){
    const vv=window.visualViewport;
    const app=document.querySelector(".app");
    const player=document.getElementById("playerView");
    const shell=document.querySelector("#playerView .workout-shell");
    const lines=[
      `RC36 DIAG ${label}`,
      `ori=${screen.orientation?.type||"?"} angle=${screen.orientation?.angle??"?"}`,
      `inner=${innerWidth}x${innerHeight} client=${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`,
      `vv=${Math.round(vv?.width||0)}x${Math.round(vv?.height||0)} scale=${Number(vv?.scale||1).toFixed(3)} off=${Math.round(vv?.offsetLeft||0)},${Math.round(vv?.offsetTop||0)}`,
      `screen=${screen.width}x${screen.height} dpr=${devicePixelRatio}`,
      `bodyScroll=${document.body.scrollWidth}x${document.body.scrollHeight}`,
      `app=${rect(app)} player=${rect(player)} shell=${rect(shell)}`,
      `safe L/R/T/B=${safeInset("left")}/${safeInset("right")}/${safeInset("top")}/${safeInset("bottom")}`
    ];
    box.textContent=lines.join("\n");
  }

  let seq=0;
  function burst(label){
    const id=++seq;
    [0,50,100,200,400,800,1500,3000].forEach(ms=>setTimeout(()=>{ if(id===seq) render(label+" +"+ms+"ms"); },ms));
  }

  window.addEventListener("orientationchange",()=>burst("orientationchange"),{passive:true});
  window.addEventListener("resize",()=>render("resize"),{passive:true});
  window.visualViewport?.addEventListener("resize",()=>render("vv-resize"),{passive:true});
  screen.orientation?.addEventListener?.("change",()=>burst("screen-change"));
  burst("load");
})();