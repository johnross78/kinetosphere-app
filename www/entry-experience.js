(()=>{
  const ENTRY_SEEN_KEY="kinetosphereEntryPrimerSeen";
  let signedInAtEntry=false;
  let guestEntry=false;
  let splashAnimation=null;
  let targetLayer=null;
  let splashLayer=null;

  function el(id){return document.getElementById(id);}
  function systemDark(){return !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;}
  function entryLogoPath(){return systemDark()?"assets/brand/orbit-lockup-dark.svg":"assets/brand/orbit-lockup-light.svg";}

  function ensureHomeView(){
    if(el("homeView")) return;
    const app=document.querySelector(".app");
    if(!app) return;
    const section=document.createElement("section");
    section.id="homeView";
    section.className="hidden";
    section.innerHTML=`
      <div class="panel">
        <div class="ks-home-hero">
          <div><div class="eyebrow">Kinetosphere</div><h1 id="ksHomeTitle">Your movement, connected.</h1><div class="meta" id="ksHomeSubtitle">Build, discover, and train from one connected movement universe.</div></div>
          <div><span class="badge" id="ksHomeAccountBadge">Guest</span></div>
        </div>
        <div class="notice ks-home-primer" id="ksHomePrimer"><strong>Get started:</strong> Build your own workout, launch a provider program, or discover another movement source. Kinetosphere keeps provider content distinct while bringing it into one training experience.</div>
        <div class="ks-home-grid">
          <div class="ks-home-card"><div><h3>Build a Workout</h3><p>Create a circuit yourself or let Smart Randomize build from your filters and available equipment.</p></div><button class="btn primary" type="button" data-home-go="builder">Build Workout</button></div>
          <div class="ks-home-card"><div><h3>Programs & Flows</h3><p>Browse structured content from the providers available to your account.</p></div><button class="btn secondary" type="button" data-home-go="programs">Explore Programs</button></div>
          <div class="ks-home-card"><div><h3>Discover Providers</h3><p>Explore provider pages, free samples, and new sources of training content.</p></div><button class="btn secondary" type="button" data-home-go="discover">Discover</button></div>
          <div class="ks-home-card" id="ksResumeCard"><div><h3>Resume Workout</h3><p id="ksResumeCopy">Continue the workout currently loaded in your Player.</p></div><button class="btn good" type="button" data-home-go="player">Resume</button></div>
          <div class="ks-home-card hidden" id="ksProviderAdminCard"><div><h3>Provider Admin</h3><p>Manage your provider page, team, and recognized provider content.</p></div><button class="btn secondary" type="button" data-home-go="providerAdmin">Open Provider Admin</button></div>
        </div>
      </div>`;
    const firstSection=app.querySelector("section");
    if(firstSection) app.insertBefore(section,firstSection); else app.appendChild(section);

    const tabs=document.querySelector(".topbar .tabs");
    if(tabs && !tabs.querySelector('[data-view="home"]')){
      const btn=document.createElement("button");
      btn.className="tab ks-home-tab";
      btn.dataset.view="home";
      btn.textContent="Home";
      tabs.insertBefore(btn,tabs.firstChild);
      btn.onclick=()=>showKinetosphereHome();
    }
    const logo=el("brandLogo");
    if(logo){
      logo.title="Home";
      logo.addEventListener("click",showKinetosphereHome);
    }
    section.querySelectorAll("[data-home-go]").forEach(btn=>btn.onclick=()=>{
      const view=btn.dataset.homeGo;
      if(typeof window.showView==="function") window.showView(view);
    });
  }

  function updateHome(){
    ensureHomeView();
    const user=window.cloudUser||null;
    const badge=el("ksHomeAccountBadge");
    if(badge) badge.textContent=user?(user.email||"Signed in"):"Guest";
    const resume=el("ksResumeCard");
    if(resume) resume.classList.toggle("hidden",!(window.activeCircuit?.items?.length));
    const provider=el("ksProviderAdminCard");
    if(provider) provider.classList.toggle("hidden",!(typeof window.canOpenProviderAdmin==="function" && window.canOpenProviderAdmin()));
    const primer=el("ksHomePrimer");
    const seen=localStorage.getItem(ENTRY_SEEN_KEY)==="1";
    if(primer) primer.classList.toggle("hidden",seen);
    if(!seen) localStorage.setItem(ENTRY_SEEN_KEY,"1");
  }

  window.showKinetosphereHome=function(){
    ensureHomeView();
    const home=el("homeView");
    if(!home) return;
    if(typeof window.teardownPlayerRuntime==="function" && document.body.classList.contains("player-active")){
      try{window.teardownPlayerRuntime({stopTimers:true});}catch(_){}
    }
    document.body.classList.remove("player-active");
    const known=["library","builder","programs","discover","providerDetail","account","preferences","profile","billing","support","about","providerAdmin","importer","player"];
    known.forEach(v=>el(v+"View")?.classList.add("hidden"));
    home.classList.remove("hidden");
    document.querySelectorAll(".tab[data-view]").forEach(n=>n.classList.toggle("active",n.dataset.view==="home"));
    document.querySelectorAll("[data-mobile-view]").forEach(n=>n.classList.remove("active"));
    if(el("subtitle")) el("subtitle").textContent="Home";
    updateHome();
    window.scrollTo({top:0,behavior:"instant"});
  };

  function buildWelcome(){
    targetLayer=document.createElement("div");
    targetLayer.className="ks-entry-layer ks-entry-target";
    targetLayer.innerHTML=`
      <div class="ks-welcome-card">
        <img class="ks-welcome-logo" src="${entryLogoPath()}" alt="Kinetosphere">
        <h1>Your movement, connected.</h1>
        <p>Sign in to sync your workouts, providers, favorites, and training history across devices.</p>
        <div class="ks-auth-field"><label>Email</label><input id="ksEntryEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
        <div class="ks-auth-field"><label>Password</label><input id="ksEntryPassword" type="password" autocomplete="current-password" placeholder="Password"></div>
        <div class="ks-auth-actions"><button class="ks-auth-primary" id="ksEntrySignIn" type="button">Sign In</button><button class="ks-auth-secondary" id="ksEntrySignUp" type="button">Create Account</button></div>
        <button class="ks-guest-button" id="ksEntryGuest" type="button">Explore as Guest</button>
        <div class="ks-entry-status" id="ksEntryStatus"></div>
      </div>`;
    document.body.appendChild(targetLayer);
    el("ksEntrySignIn").onclick=()=>entrySignIn(false);
    el("ksEntrySignUp").onclick=()=>entrySignIn(true);
    el("ksEntryGuest").onclick=()=>{guestEntry=true;finishEntryToHome();};
  }

  async function entrySignIn(create){
    const email=String(el("ksEntryEmail")?.value||"").trim();
    const password=String(el("ksEntryPassword")?.value||"");
    const status=el("ksEntryStatus");
    if(!email||!password){if(status)status.textContent="Enter your email and password.";return;}
    if(status) status.textContent=create?"Creating account…":"Signing in…";
    try{
      const result=create
        ? await window.supabaseClient.auth.signUp({email,password})
        : await window.supabaseClient.auth.signInWithPassword({email,password});
      if(result.error) throw result.error;
      if(create && !result.data?.session){
        if(status) status.textContent="Account created. Check your email to confirm it, then sign in.";
        return;
      }
      signedInAtEntry=true;
      if(typeof window.refreshCloudUser==="function") await window.refreshCloudUser();
      finishEntryToHome();
    }catch(err){
      if(status) status.textContent=(create?"Account could not be created: ":"Sign-in failed: ")+(err?.message||"Unknown error");
    }
  }

  function buildSplash(){
    splashLayer=document.createElement("div");
    splashLayer.className="ks-entry-layer ks-splash-layer";
    splashLayer.innerHTML='<div id="ksSplashPlayer" class="ks-splash-player" aria-label="Kinetosphere"></div>';
    document.body.appendChild(splashLayer);
    const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if(reduced){
      el("ksSplashPlayer").innerHTML='<img src="'+entryLogoPath()+'" alt="Kinetosphere" style="width:100%;height:100%;object-fit:contain;padding:18%;box-sizing:border-box">';
      return;
    }
    if(window.lottie){
      splashAnimation=window.lottie.loadAnimation({
        container:el("ksSplashPlayer"),
        renderer:"svg",
        loop:false,
        autoplay:true,
        path:systemDark()?"assets/splash/kinetosphere-splash-dark.json":"assets/splash/kinetosphere-splash-light.json"
      });
    }else{
      el("ksSplashPlayer").innerHTML='<img src="'+entryLogoPath()+'" alt="Kinetosphere" style="width:100%;height:100%;object-fit:contain;padding:18%;box-sizing:border-box">';
    }
  }

  async function resolveEntry(){
    try{
      const {data}=await window.supabaseClient.auth.getSession();
      signedInAtEntry=!!data?.session?.user;
    }catch(_){ signedInAtEntry=false; }
    const elapsed=performance.now()-entryStartedAt;
    const earliestExit=900;
    if(elapsed<earliestExit) await new Promise(r=>setTimeout(r,earliestExit-elapsed));
    if(splashAnimation){
      try{splashAnimation.goToAndPlay(324,true);}catch(_){}
    }
    revealTarget();
  }

  function revealTarget(){
    if(signedInAtEntry || guestEntry){
      finishEntryToHome();
      return;
    }
    buildWelcome();
    requestAnimationFrame(()=>targetLayer?.classList.add("is-visible"));
    setTimeout(removeSplash,720);
  }

  async function finishEntryToHome(){
    if(targetLayer){
      targetLayer.classList.remove("is-visible");
      setTimeout(()=>targetLayer?.remove(),250);
    }
    removeSplash();
    document.body.classList.remove("entry-booting");
    document.body.style.overflow="";
    ensureHomeView();
    if(signedInAtEntry && typeof window.refreshCloudUser==="function"){
      try{await window.refreshCloudUser();}catch(_){}
    }
    showKinetosphereHome();
  }

  function removeSplash(){
    if(!splashLayer) {
      document.body.classList.remove("entry-booting");
      return;
    }
    splashLayer.style.opacity="0";
    setTimeout(()=>{
      splashLayer?.remove();
      splashLayer=null;
      document.body.classList.remove("entry-booting");
    },720);
  }

  const entryStartedAt=performance.now();
  buildSplash();
  resolveEntry();

  // Keep Home current when auth changes after the entry screen.
  window.supabaseClient?.auth?.onAuthStateChange?.(()=>setTimeout(updateHome,0));
})();
