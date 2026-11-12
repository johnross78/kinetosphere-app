/* Build 50: inject native-only direct YouTube A/B, preserving hosted fallback. */
import fs from "node:fs";
const file="www/index.html";
let html=fs.readFileSync(file,"utf8");
if(html.includes("KINETOSPHERE_BUILD50_DIRECT_YOUTUBE")){console.log("Already patched");process.exit(0);}
const helper="/* KINETOSPHERE_BUILD50_DIRECT_YOUTUBE: iPhone-only test with bridge fallback */\nlet ks50VideoId=\"\";\nlet ks50Mode=\"direct\";\nfunction ks50IPhone(){\n  return KINETOSPHERE_NATIVE && document.documentElement.classList.contains(\"native-capacitor-shell\") && !document.documentElement.classList.contains(\"native-ipad-shell\");\n}\nfunction ks50ModeButton(){\n  const card=document.querySelector(\"#playerView .video-card\");\n  if(!card)return;\n  let btn=document.getElementById(\"ks50ModeButton\");\n  if(!btn){\n    btn=document.createElement(\"button\");\n    btn.id=\"ks50ModeButton\";\n    btn.type=\"button\";\n    btn.style.cssText=\"position:absolute!important;top:5px!important;left:50%!important;transform:translateX(-50%)!important;z-index:30!important;padding:4px 7px!important;border-radius:4px!important;border:1px solid white!important;background:rgba(14,18,28,.85)!important;color:white!important;font:600 10px sans-serif!important;pointer-events:auto!important;white-space:nowrap!important;\";\n    card.style.position=\"relative\";\n    card.appendChild(btn);\n    btn.addEventListener(\"click\",()=>{\n      ks50Mode=ks50Mode===\"direct\"?\"bridge\":\"direct\";\n      if(ks50VideoId)showYouTubeMovementVideo(ks50VideoId);\n    });\n  }\n  btn.textContent=ks50Mode===\"direct\"?\"Direct test · Use Bridge\":\"Bridge test · Use Direct\";\n}\nfunction ks50Play(videoId){\n  if(!ks50IPhone() || !/^[A-Za-z0-9_-]{6,20}$/.test(String(videoId||\"\")))return false;\n  const host=el(\"ytFrame\");\n  if(!host)return false;\n  ks50VideoId=videoId;\n  ks50ModeButton();\n  if(ks50Mode===\"bridge\"){\n    if(host.querySelector(\"iframe[data-ks50-direct]\"))host.innerHTML=\"\";\n    hostedYoutubeVideoId=\"\";\n    return loadHostedYoutubeBridge(videoId);\n  }\n  const muted=gymVideoAudioMuted?\"1\":\"0\";\n  const frame=host.querySelector(\"iframe[data-ks50-direct]\");\n  if(!frame || frame.dataset.videoId!==videoId || frame.dataset.muted!==muted){\n    host.innerHTML=\"\";\n    hostedYoutubeVideoId=\"\";\n    const iframe=document.createElement(\"iframe\");\n    iframe.dataset.ks50Direct=\"1\";\n    iframe.dataset.videoId=videoId;\n    iframe.dataset.muted=muted;\n    iframe.title=\"Direct YouTube iPhone test\";\n    iframe.src=\"https://www.youtube.com/embed/\"+encodeURIComponent(videoId)+\"?autoplay=1&playsinline=1&controls=1&fs=1&rel=0&loop=1&playlist=\"+encodeURIComponent(videoId)+\"&mute=\"+muted;\n    iframe.allow=\"autoplay; encrypted-media; picture-in-picture; fullscreen\";\n    iframe.setAttribute(\"allowfullscreen\",\"\");\n    iframe.setAttribute(\"webkitallowfullscreen\",\"\");\n    iframe.referrerPolicy=\"strict-origin-when-cross-origin\";\n    iframe.style.cssText=\"position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;border:0!important;display:block!important;\";\n    host.appendChild(iframe);\n  }\n  return true;\n}\n";
const route='  if(KINETOSPHERE_NATIVE && loadHostedYoutubeBridge(videoId)){'+"\n"+
'    scheduleGymAudioForYouTube();'+"\n"+
'    updateGymVideoAudioButton();'+"\n"+
'    return;'+"\n"+
'  }';
if(html.split(route).length!==2)throw new Error("Native route anchor changed");
if(html.split("function showYouTubeMovementVideo(videoId){").length!==2)throw new Error("Show YouTube function anchor changed");
html=html.replace("function showYouTubeMovementVideo(videoId){",helper+"\nfunction showYouTubeMovementVideo(videoId){");
html=html.replace(route,'  if(ks50Play(videoId)){'+"\n"+
'    scheduleGymAudioForYouTube();'+"\n"+
'    updateGymVideoAudioButton();'+"\n"+
'    return;'+"\n"+
'  }'+"\n"+route);
const clean='  if(host && hostedYoutubeFrame()) host.innerHTML="";';
if(html.split(clean).length!==2)throw new Error("Bridge cleanup anchor changed");
html=html.replace(clean,'  if(host && (hostedYoutubeFrame() || host.querySelector("iframe[data-ks50-direct]"))) host.innerHTML="";');
const toggle='function toggleGymVideoAudio(){\n  gymVideoAudioMuted=!gymVideoAudioMuted;\n  saveGymVideoAudioState();\n  applyGymVideoAudioState();\n}';
if(html.split(toggle).length!==2)throw new Error("Audio toggle anchor changed");
html=html.replace(toggle,'function toggleGymVideoAudio(){\n  gymVideoAudioMuted=!gymVideoAudioMuted;\n  saveGymVideoAudioState();\n  applyGymVideoAudioState();\n  if(ks50IPhone() && ks50Mode==="direct" && ks50VideoId) ks50Play(ks50VideoId);\n}');
fs.writeFileSync(file,html);
const cssFile="www/mobile-shell.css";
let css=fs.readFileSync(cssFile,"utf8");
if(!css.includes("KS50 CLEAN OUTLINES")){
 css+='\n/* KS50 CLEAN OUTLINES; landscape geometry untouched. */\n#playerView:not(.hidden) .video-card,#playerView:not(.hidden) #ytFrame,#playerView:not(.hidden) #ytFrame iframe,html.native-capacitor-shell:not(.native-ipad-shell) body.player-active #playerView .video-card,html.native-capacitor-shell:not(.native-ipad-shell) body.player-active #playerView #ytFrame,html.native-capacitor-shell:not(.native-ipad-shell) body.player-active #playerView #ytFrame>iframe{outline:none!important;}\n';
 fs.writeFileSync(cssFile,css);
}
console.log("KS50 native-only direct YouTube A/B installed");
