/* RC31 / v6.10.37 — hosted YouTube bridge lifecycle correction.
   On native iPhone rotation/viewport changes, wait for the Player stage to settle,
   then recreate the HTTPS YouTube bridge at the final landscape dimensions.
   This replaces crop/scale compensation with a clean lifecycle reset. */
(() => {
  let refreshTimer=0;
  let settleStartedAt=0;
  let lastSize="";

  function isNativePhoneLandscapePlayer(){
    try{
      return document.documentElement.classList.contains("native-capacitor-shell") &&
        !document.documentElement.classList.contains("native-ipad-shell") &&
        document.body.classList.contains("player-active") &&
        matchMedia("(orientation: landscape) and (max-width: 950px) and (max-height: 600px)").matches;
    }catch(_){ return false; }
  }

  function stageSize(){
    const host=document.getElementById("ytFrame");
    if(!host) return "";
    const r=host.getBoundingClientRect();
    return Math.round(r.width)+"x"+Math.round(r.height);
  }

  function recreateHostedBridge(){
    if(!isNativePhoneLandscapePlayer()) return;
    if(typeof hostedYoutubeFrame!=="function" || typeof stopHostedYoutubeBridge!=="function" || typeof loadHostedYoutubeBridge!=="function") return;
    const frame=hostedYoutubeFrame();
    if(!frame) return;
    const videoId=typeof hostedYoutubeVideoId!=="undefined" ? hostedYoutubeVideoId : "";
    if(!videoId) return;

    stopHostedYoutubeBridge();
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        loadHostedYoutubeBridge(videoId);
        if(typeof scheduleGymAudioForYouTube==="function") scheduleGymAudioForYouTube();
      });
    });
  }

  function settleAndRefresh(){
    if(!isNativePhoneLandscapePlayer()) return;
    const now=performance.now();
    if(!settleStartedAt) settleStartedAt=now;
    const size=stageSize();

    if(!size){
      refreshTimer=setTimeout(settleAndRefresh,120);
      return;
    }

    if(size!==lastSize && now-settleStartedAt<900){
      lastSize=size;
      refreshTimer=setTimeout(settleAndRefresh,140);
      return;
    }

    settleStartedAt=0;
    lastSize="";
    recreateHostedBridge();
  }

  function scheduleRefresh(){
    clearTimeout(refreshTimer);
    settleStartedAt=0;
    lastSize="";
    refreshTimer=setTimeout(settleAndRefresh,140);
  }

  window.addEventListener("orientationchange",scheduleRefresh,{passive:true});
  window.addEventListener("resize",scheduleRefresh,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize",scheduleRefresh,{passive:true});
  }

  const host=document.getElementById("ytFrame");
  if(host && "ResizeObserver" in window){
    const observer=new ResizeObserver(()=>{
      if(isNativePhoneLandscapePlayer() && typeof hostedYoutubeFrame==='function' && hostedYoutubeFrame()) scheduleRefresh();
    });
    observer.observe(host);
  }
})();
