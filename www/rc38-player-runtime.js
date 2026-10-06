/* RC38 / v6.10.44 — state integrity + iPhone landscape reflow.
   Keeps RC37 viewport containment frozen. */
(() => {
  const CLEAR_KEY="kinetosphereActiveCircuitExplicitlyCleared";

  const wasExplicitlyCleared=()=>{
    try{return localStorage.getItem(CLEAR_KEY)==="1";}catch(_){return false;}
  };
  const markExplicitlyCleared=()=>{
    try{localStorage.setItem(CLEAR_KEY,"1");}catch(_){}
  };
  const clearExplicitMarker=()=>{
    try{localStorage.removeItem(CLEAR_KEY);}catch(_){}
  };

  async function hardClearActiveCircuit(){
    activeCircuit=null;
    workingCircuit=[];
    workingProgramContext=null;
    programIntroPending=false;

    try{
      if(typeof del==="function") await del("settings","activeCircuit");
    }catch(err){
      console.warn("RC38 local activeCircuit clear warning",err);
    }

    try{
      if(cloudUser && typeof supabaseClient!=="undefined" && typeof CLOUD_TABLES!=="undefined"){
        const {error}=await supabaseClient
          .from(CLOUD_TABLES.settings)
          .delete()
          .eq("user_id",cloudUser.id)
          .eq("record_id","activeCircuit");
        if(error) throw error;
        pendingCloudChanges?.settings?.delete?.("activeCircuit");
      }
    }catch(err){
      console.warn("RC38 cloud activeCircuit clear warning",err);
      return false;
    }

    try{
      renderCircuit();
      renderPlayer();
    }catch(_){}
    return true;
  }

  if(typeof clearCircuit==="function"){
    const originalClear=clearCircuit;
    clearCircuit=async function(...args){
      markExplicitlyCleared();
      let result;
      try{
        result=await originalClear.apply(this,args);
      }finally{
        const cleared=await hardClearActiveCircuit();
        if(cleared) clearExplicitMarker();
      }
      return result;
    };
  }

  if(typeof prepareCurrentBuilderCircuitForPlayer==="function"){
    const originalPrepare=prepareCurrentBuilderCircuitForPlayer;
    prepareCurrentBuilderCircuitForPlayer=function(...args){
      const ok=originalPrepare.apply(this,args);
      if(ok) clearExplicitMarker();
      return ok;
    };
  }

  if(typeof pullLatestCloud==="function"){
    const originalPull=pullLatestCloud;
    pullLatestCloud=async function(...args){
      const keepCleared=wasExplicitlyCleared();
      const result=await originalPull.apply(this,args);
      if(keepCleared){
        const cleared=await hardClearActiveCircuit();
        if(cleared) clearExplicitMarker();
      }
      return result;
    };
  }

  function fitLandscapeInfo(){
    const html=document.documentElement;
    if(!html.classList.contains("native-capacitor-shell") ||
       html.classList.contains("native-ipad-shell") ||
       !document.body.classList.contains("player-active") ||
       !matchMedia("(orientation: landscape) and (max-width: 950px) and (max-height: 600px)").matches) return;

    const row=document.getElementById("prescriptionTimerRow");
    const timer=document.getElementById("timer");
    const muscleText=document.getElementById("muscleMapText");

    if(row&&timer&&row.clientWidth>20){
      let size=Math.min(38,Math.max(22,Math.floor(row.clientWidth/4.3)));
      timer.style.setProperty("font-size",size+"px","important");
      timer.style.setProperty("line-height",".92","important");
      timer.style.setProperty("max-width","100%","important");
      timer.style.setProperty("width","100%","important");
      timer.style.setProperty("white-space","nowrap","important");
      while(size>18 && timer.scrollWidth>row.clientWidth-4){
        size-=1;
        timer.style.setProperty("font-size",size+"px","important");
      }
    }

    if(muscleText){
      muscleText.style.setProperty("font-size","10px","important");
      muscleText.style.setProperty("line-height","1.05","important");
      muscleText.style.setProperty("white-space","normal","important");
      muscleText.style.setProperty("overflow-wrap","anywhere","important");
      muscleText.style.setProperty("max-width","100%","important");
    }
  }

  function scheduleLandscapeInfoFit(){
    requestAnimationFrame(()=>{
      fitLandscapeInfo();
      requestAnimationFrame(fitLandscapeInfo);
    });
    [80,180,350].forEach(ms=>setTimeout(fitLandscapeInfo,ms));
  }

  window.addEventListener("resize",scheduleLandscapeInfoFit,{passive:true});
  window.addEventListener("orientationchange",scheduleLandscapeInfoFit,{passive:true});
  window.visualViewport?.addEventListener("resize",scheduleLandscapeInfoFit,{passive:true});

  const info=document.getElementById("infoCard");
  if(info&&"ResizeObserver" in window){
    const ro=new ResizeObserver(scheduleLandscapeInfoFit);
    ro.observe(info);
  }

  if(typeof renderPlayer==="function"){
    const originalRender=renderPlayer;
    renderPlayer=function(...args){
      const result=originalRender.apply(this,args);
      scheduleLandscapeInfoFit();
      return result;
    };
  }

  scheduleLandscapeInfoFit();
})();