const RAPID_HOST = "muscle-group-image-generator.p.rapidapi.com";
const RAPID_BASE = "https://" + RAPID_HOST;

function json(data, status=200, extraHeaders={}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {"Content-Type":"application/json; charset=utf-8", "Access-Control-Allow-Origin":"*", ...extraHeaders}
  });
}

function cleanList(value) {
  if (!value) return "";
  return value.split(",").map(x => x.trim()).filter(Boolean).join(",");
}

async function rapidFetch(env, path, searchParams) {
  if (!env.RAPIDAPI_KEY) {
    return json({error:"RAPIDAPI_KEY secret is not configured in Cloudflare."}, 500);
  }
  const url = new URL(RAPID_BASE + path);
  for (const [key,value] of searchParams) {
    if (value !== "") url.searchParams.set(key,value);
  }
  return fetch(url.toString(), {
    method:"GET",
    headers:{
      "Content-Type":"application/json",
      "x-rapidapi-host":RAPID_HOST,
      "x-rapidapi-key":env.RAPIDAPI_KEY
    }
  });
}


function youtubeEmbedPage(requestUrl) {
  const url = new URL(requestUrl);
  const id = String(url.searchParams.get("id") || "").trim();
  const muted = url.searchParams.get("muted") === "1";
  if (!/^[A-Za-z0-9_-]{6,20}$/.test(id)) {
    return new Response("Invalid video id", {status:400, headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }
  const origin = url.origin;
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin">
<style>
html,body{margin:0;padding:0;width:100%;height:100%;background:#000;overflow:hidden;position:relative}
body{min-width:0;min-height:0}
#player{position:absolute!important;inset:0!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#000}
#player iframe{position:absolute!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;margin:0!important;padding:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;border:0!important;display:block!important;background:#000!important}
</style></head>
<body><div id="player"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
const VIDEO_ID=${JSON.stringify(id)};
const EMBED_ORIGIN=${JSON.stringify(origin)};
const START_MUTED=${muted ? 'true':'false'};
let player=null;
function send(type,data){try{parent.postMessage({source:'kinetosphere-youtube',type,data:data||null},'*')}catch(e){}}
window.onYouTubeIframeAPIReady=function(){
 player=new YT.Player('player',{width:'100%',height:'100%',videoId:VIDEO_ID,playerVars:{autoplay:1,playsinline:1,rel:0,loop:1,playlist:VIDEO_ID,origin:EMBED_ORIGIN,widget_referrer:EMBED_ORIGIN},events:{
  onReady:function(e){try{if(START_MUTED)e.target.mute();else e.target.unMute();syncPlayerSize();e.target.playVideo()}catch(_){} send('ready')},
  onStateChange:function(e){if(e.data===YT.PlayerState.ENDED){try{e.target.seekTo(0,true);e.target.playVideo()}catch(_){}}},
  onError:function(e){send('error',e.data)}
 }});
};
function bridgeSize(){
 const host=document.getElementById('player');
 if(!host)return {width:0,height:0};
 const r=host.getBoundingClientRect();
 return {width:Math.max(0,Math.round(r.width)),height:Math.max(0,Math.round(r.height))};
}
function syncPlayerSize(){
 try{
  if(!player||!player.setSize)return;
  const s=bridgeSize();
  if(s.width>0&&s.height>0) player.setSize(s.width,s.height);
 }catch(_){}
}
let resizeTimer=0;
function schedulePlayerSize(){
 clearTimeout(resizeTimer);
 resizeTimer=setTimeout(function(){
  syncPlayerSize();
  requestAnimationFrame(syncPlayerSize);
 },0);
}
window.addEventListener('resize',schedulePlayerSize,{passive:true});
window.addEventListener('orientationchange',schedulePlayerSize,{passive:true});
if(window.visualViewport)window.visualViewport.addEventListener('resize',schedulePlayerSize,{passive:true});
if('ResizeObserver' in window){
 const ro=new ResizeObserver(schedulePlayerSize);
 ro.observe(document.getElementById('player'));
}
window.addEventListener('message',function(ev){
 const m=ev.data||{}; if(m.source!=='kinetosphere-parent'||!player)return;
 try{
  if(m.type==='mute') player.mute();
  else if(m.type==='unmute'){player.unMute();player.setVolume(100)}
  else if(m.type==='play') player.playVideo();
  else if(m.type==='pause') player.pauseVideo();
  else if(m.type==='load'&&m.videoId){player.loadVideoById(m.videoId)}
 }catch(_){}
});
<\/script></body></html>`;
  return new Response(html, {
    status:200,
    headers:{
      "Content-Type":"text/html; charset=utf-8",
      "Cache-Control":"no-store",
      "Referrer-Policy":"strict-origin-when-cross-origin",
      "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"default-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://i.ytimg.com https://*.googlevideo.com; script-src 'self' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com; img-src 'self' data: https://i.ytimg.com https://*.ytimg.com; media-src https://*.googlevideo.com; connect-src https://www.youtube.com https://*.googlevideo.com; style-src 'unsafe-inline';"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);


    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET, OPTIONS",
        "Access-Control-Allow-Headers":"Content-Type",
        "Access-Control-Max-Age":"86400"
      }});
    }

    if (url.pathname === "/embed/youtube") {
      return youtubeEmbedPage(request.url);
    }

    if (url.pathname === "/api/muscle-groups") {
      const upstream = await rapidFetch(env, "/v2/muscle-groups", []);
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status:upstream.status,
        headers:{
          "Content-Type":upstream.headers.get("Content-Type") || "application/json",
          "Cache-Control":"public, max-age=3600, s-maxage=86400",
          "X-Content-Type-Options":"nosniff",
          "Access-Control-Allow-Origin":"*"
        }
      });
    }

    if (url.pathname === "/api/muscle-image") {
      const primaryMuscles = cleanList(url.searchParams.get("primaryMuscles"));
      const secondaryMuscles = cleanList(url.searchParams.get("secondaryMuscles"));
      if (!primaryMuscles) return json({error:"Missing primaryMuscles"},400);

      const valid = /^[a-zA-Z0-9_,.-]+$/;
      if (!valid.test(primaryMuscles) || (secondaryMuscles && !valid.test(secondaryMuscles))) {
        return json({error:"Invalid muscle parameter"},400);
      }

      const size = url.searchParams.get("size") || "original";
      const transparent = url.searchParams.get("transparent") || "true";
      const backgroundColor = url.searchParams.get("backgroundColor") || "1A1A2E";
      const primaryColor = url.searchParams.get("primaryColor") || "EF4444";
      const secondaryColor = url.searchParams.get("secondaryColor") || "FB923C";

      const isMulti = !!secondaryMuscles;
      const params = isMulti
        ? new URLSearchParams({
            primaryMuscles,
            secondaryMuscles,
            size,
            primaryColor,
            secondaryColor,
            backgroundColor,
            transparent
          })
        : new URLSearchParams({
            muscles: primaryMuscles,
            size,
            color: primaryColor,
            backgroundColor,
            transparent
          });

      const cache = caches.default;
      const cacheKey = new Request(
        new URL("/__muscle_cache/" + (isMulti ? "multi" : "single") + "?" + params.toString(), request.url).toString(),
        {method:"GET"}
      );
      const cached = await cache.match(cacheKey);
      if (cached) return cached;

      const upstream = await rapidFetch(env, isMulti ? "/v2/images/multi" : "/v2/images/single", params);
      if (!upstream.ok) {
        const text = await upstream.text();
        return new Response(text, {
          status:upstream.status,
          headers:{
            "Content-Type":upstream.headers.get("Content-Type") || "application/json",
            "Cache-Control":"no-store",
            "Access-Control-Allow-Origin":"*"
          }
        });
      }

      const image = new Response(upstream.body, {
        status:upstream.status,
        headers:{
          "Content-Type":upstream.headers.get("Content-Type") || "image/png",
          "Cache-Control":"public, max-age=86400, s-maxage=2592000",
          "X-Content-Type-Options":"nosniff",
          "Access-Control-Allow-Origin":"*"
        }
      });
      ctx.waitUntil(cache.put(cacheKey, image.clone()));
      return image;
    }

    return env.ASSETS.fetch(request);
  }
};
