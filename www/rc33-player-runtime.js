/* RC33 / v6.10.39 — native iPhone viewport stabilization.
   Fixes the first-rotation WKWebView race before reinitializing hosted YouTube.
   Explicitly excludes iPad. */
(() => {
  const html=document.documentElement;
  const viewportMeta=document.querySelector('meta[name="viewport"]');
  let timer=0;
  let sequence=0;

  function isNativePhone(){
    return html.classList.contains("native-capacitor-shell") &&
      !html.classList.contains("native-ipad-shell");
  }

  function isLandscape(){
    return window.matchMedia?.("(orientation: landscape)")?.matches ||
      window.innerWidth>window.innerHeight;
  }

  function viewportSnapshot(){
    const vv=window.visualViewport;
    return {
      iw:Math.round(window.innerWidth||0),
      ih:Math.round(window.innerHeight||0),
      vw:Math.round(vv?.width||0),
      vh:Math.round(vv?.height||0),
      scale:Number(vv?.scale||1)
    };
  }

  function landscapeIsUsable(s){
    const w=s.vw||s.iw, h=s.vh||s.ih;
    return w>h && w>500 && h<700 && s.scale>0.95 && s.scale<1.05;
  }

  function nudgeViewport(){
    if(!viewportMeta) return;
    const base="width=device-width, initial-scale=1, viewport-fit=cover";
    /* Changing the meta viewport for one frame forces WKWebView to discard the
       stale portrait layout viewport seen on the first landscape rotation. */
    viewportMeta.setAttribute("content",base+", maximum-scale=1.0001");
    requestAnimationFrame(()=>{
      viewportMeta.setAttribute("content",base);
    });
  }

  function recreateBridgeAtStableViewport(){
    if(!document.body.classList.contains("player-active")) return;
    if(typeof hostedYoutubeFrame!=="function" ||
       typeof stopHostedYoutubeBridge!=="function" ||
       typeof loadHostedYoutubeBridge!=="function") return;
    const frame=hostedYoutubeFrame();
    if(!frame) return;
    const id=typeof hostedYoutubeVideoId!=="undefined" ? hostedYoutubeVideoId : "";
    if(!id) return;

    stopHostedYoutubeBridge();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      loadHostedYoutubeBridge(id);
      if(typeof scheduleGymAudioForYouTube==="function") scheduleGymAudioForYouTube();
    }));
  }

  function stabilizeRotation(){
    if(!isNativePhone()) return;
    const mySeq=++sequence;
    clearTimeout(timer);
    nudgeViewport();

    const started=performance.now();
    let previous=null;
    let stableCount=0;

    const poll=()=>{
      if(mySeq!==sequence) return;
      const s=viewportSnapshot();
      const same=previous &&
        Math.abs(s.iw-previous.iw)<=1 &&
        Math.abs(s.ih-previous.ih)<=1 &&
        Math.abs(s.vw-previous.vw)<=1 &&
        Math.abs(s.vh-previous.vh)<=1 &&
        Math.abs(s.scale-previous.scale)<0.01;

      stableCount=same ? stableCount+1 : 0;
      previous=s;

      if(isLandscape()){
        if(landscapeIsUsable(s) && stableCount>=2){
          recreateBridgeAtStableViewport();
          window.dispatchEvent(new Event("resize"));
          return;
        }
      }else if(stableCount>=1){
        window.dispatchEvent(new Event("resize"));
        return;
      }

      if(performance.now()-started<1800){
        timer=setTimeout(poll,90);
      }
    };

    timer=setTimeout(poll,70);
  }

  window.addEventListener("orientationchange",stabilizeRotation,{passive:true});
  /* Some iOS builds omit orientationchange but do update matchMedia. */
  try{
    const mq=matchMedia("(orientation: landscape)");
    mq.addEventListener?.("change",stabilizeRotation);
  }catch(_){}
})();
