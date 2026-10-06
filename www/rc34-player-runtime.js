/* RC34 / v6.10.40 — native-settled bridge refresh.
   Native iPhone only: UIKit tells the web layer when rotation is complete.
   At that point, recreate the hosted YouTube bridge once against the final viewport.
   iPad remains excluded by the native controller and by this guard. */
(() => {
  function isNativePhonePlayer(){
    const html=document.documentElement;
    return html.classList.contains("native-capacitor-shell") &&
      !html.classList.contains("native-ipad-shell") &&
      document.body.classList.contains("player-active");
  }

  function refreshHostedYoutube(){
    if(!isNativePhonePlayer()) return;
    if(typeof hostedYoutubeFrame!=="function" ||
       typeof stopHostedYoutubeBridge!=="function" ||
       typeof loadHostedYoutubeBridge!=="function") return;

    const frame=hostedYoutubeFrame();
    if(!frame) return;

    const id=typeof hostedYoutubeVideoId!=="undefined" ? hostedYoutubeVideoId : "";
    if(!id) return;

    stopHostedYoutubeBridge();

    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        loadHostedYoutubeBridge(id);
        if(typeof scheduleGymAudioForYouTube==="function") scheduleGymAudioForYouTube();
        if(typeof syncPlayerCardHeights==="function") syncPlayerCardHeights();
      });
    });
  }

  window.addEventListener("kinetosphere:native-rotation-settled", refreshHostedYoutube);
})();