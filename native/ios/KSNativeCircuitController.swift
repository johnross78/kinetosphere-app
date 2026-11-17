import UIKit
import WebKit
import Capacitor

// >>> KS NATIVE CIRCUIT INTEGRATION (ISOLATED) >>>
@objc(KSNativeCircuitController)
final class KSNativeCircuitController: CAPBridgeViewController, WKScriptMessageHandler {
  private weak var circuitWeb: WKWebView?
  private var videoWeb: WKWebView?
  private var stage: UIView?
  private var currentId = ""
  private var currentMuted = false
  private var modalOpen = false
  private var lastWebRect: CGRect?
  private var lastCssViewportWidth: CGFloat = 0
  private let bridgeOrigin = "https://circuitbuilder.rosshomegym.com"

  override func viewDidLoad() {
    super.viewDidLoad()
    DispatchQueue.main.async { [weak self] in self?.installNativeCircuitStage() }
  }

  private func findCircuitWeb(_ root: UIView) -> WKWebView? {
    if let web=root as? WKWebView { return web }
    for child in root.subviews {
      if let found=findCircuitWeb(child) { return found }
    }
    return nil
  }

  private func installNativeCircuitStage() {
    guard stage == nil, let web=findCircuitWeb(view) else {
      print("KS native player: web view unavailable or already installed")
      return
    }
    circuitWeb=web
    web.configuration.userContentController.add(self,name:"ksNativeVideo")
    // Keep Capacitor's existing root view, WebKit configuration and navigation
    // completely untouched. Overlay is a child of that same WebView.
    let region=UIView(frame:.zero)
    region.backgroundColor = .black
    region.clipsToBounds=true
    region.layer.cornerRadius=16
    region.layer.cornerCurve = .continuous
    region.isHidden=true

    let videoConfig=WKWebViewConfiguration()
    videoConfig.allowsInlineMediaPlayback=true
    videoConfig.mediaTypesRequiringUserActionForPlayback=[]
    videoConfig.allowsAirPlayForMediaPlayback=true
    let player=WKWebView(frame:.zero,configuration:videoConfig)
    player.backgroundColor = .black
    player.isOpaque=false
    player.scrollView.isScrollEnabled=false
    player.scrollView.contentInsetAdjustmentBehavior = .never
    player.translatesAutoresizingMaskIntoConstraints=false
    region.addSubview(player)
    NSLayoutConstraint.activate([
      player.centerXAnchor.constraint(equalTo:region.centerXAnchor),
      player.centerYAnchor.constraint(equalTo:region.centerYAnchor),
      player.widthAnchor.constraint(equalTo:player.heightAnchor,multiplier:16.0/9.0),
      player.widthAnchor.constraint(lessThanOrEqualTo:region.widthAnchor),
      player.heightAnchor.constraint(lessThanOrEqualTo:region.heightAnchor)
    ])
    let fillWidth=player.widthAnchor.constraint(equalTo:region.widthAnchor)
    let fillHeight=player.heightAnchor.constraint(equalTo:region.heightAnchor)
    fillWidth.priority=UILayoutPriority(750)
    fillHeight.priority=UILayoutPriority(749)
    NSLayoutConstraint.activate([fillWidth,fillHeight])

    web.addSubview(region)
    videoWeb=player
    stage=region
    print("KS native Circuit Player installed in original video-card geometry")
  }

  private func number(_ payload:[String:Any],_ key:String) -> CGFloat? {
    guard let raw=payload[key] as? NSNumber else{return nil}
    let n=CGFloat(raw.doubleValue)
    return n.isFinite ? n : nil
  }

  private func updateNativeFrame(_ payload:[String:Any]) {
    guard let web=circuitWeb,let region=stage,
          let x=number(payload,"x"),let y=number(payload,"y"),
          let w=number(payload,"width"),let h=number(payload,"height"),
          let cssWidth=number(payload,"viewportWidth"),cssWidth>0 else{return}
    if w<=0 || h<=0 {
      lastWebRect=nil
      region.isHidden=true
      return
    }
    lastWebRect=CGRect(x:x,y:y,width:w,height:h)
    lastCssViewportWidth=cssWidth
    applyNativeFrame()
  }

  private func applyNativeFrame() {
    guard let web=circuitWeb, let region=stage,
          let rect=lastWebRect,lastCssViewportWidth>0 else{return}
    // DOM getBoundingClientRect values are viewport-relative CSS pixels.
    // Overlay is inserted into the same WKWebView and converted to its
    // native point coordinates using the live viewport-to-view scale.
    let scale=web.bounds.width/lastCssViewportWidth
    guard scale.isFinite,scale>0 else{return}
    let target=CGRect(x:rect.minX*scale,y:rect.minY*scale,
                      width:rect.width*scale,height:rect.height*scale)
    region.frame=target.insetBy(dx:1,dy:1)
    let visible=web.bounds.intersection(target)
    region.isHidden=modalOpen || currentId.isEmpty || visible.isNull || visible.isEmpty
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    applyNativeFrame()
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.name=="ksNativeVideo",
          let payload=message.body as? [String:Any],
          let type=payload["type"] as? String else{return}
    DispatchQueue.main.async { [weak self] in
      guard let self=self else{return}
      switch type {
      case "load":
        guard let id=payload["id"] as? String,
              id.range(of:"^[A-Za-z0-9_-]{6,20}$",options:.regularExpression) != nil else{return}
        self.loadNativeVideo(id,muted:(payload["muted"] as? Bool) ?? false)
      case "frame": self.updateNativeFrame(payload)
      case "modal":
        self.modalOpen=(payload["open"] as? Bool) ?? false
        self.applyNativeFrame()
      case "stop": self.stopNativeVideo()
      case "audio": self.setNativeAudio(muted:(payload["muted"] as? Bool) ?? false)
      default:break
      }
    }
  }

  private func loadNativeVideo(_ id:String,muted:Bool) {
    guard let videoWeb=videoWeb else{return}
    let needsLoad=currentId != id
    currentId=id
    currentMuted=muted
    applyNativeFrame()
    if needsLoad {
      let urlString=bridgeOrigin+"/embed/youtube?id="+id+"&muted="+(muted ? "1":"0")
      guard let url=URL(string:urlString) else{return}
      var request=URLRequest(url:url,cachePolicy:.reloadIgnoringLocalCacheData)
      request.setValue(bridgeOrigin+"/",forHTTPHeaderField:"Referer")
      videoWeb.load(request)
    } else {
      postToHostedBridge(type:"load",extra:"videoId:'"+id+"'")
      setNativeAudio(muted:muted)
    }
  }

  private func postToHostedBridge(type:String,extra:String="") {
    let payload="{source:'kinetosphere-parent',type:'"+type+"'"+(extra.isEmpty ? "" : ","+extra)+"}"
    videoWeb?.evaluateJavaScript("window.postMessage("+payload+",'*')",completionHandler:nil)
  }

  private func setNativeAudio(muted:Bool) {
    currentMuted=muted
    if !currentId.isEmpty {postToHostedBridge(type:muted ? "mute":"unmute")}
  }

  private func stopNativeVideo() {
    currentId=""
    lastWebRect=nil
    stage?.isHidden=true
    videoWeb?.stopLoading()
    videoWeb?.loadHTMLString("<!doctype html><html><body style='margin:0;background:black'></body></html>",baseURL:URL(string:bridgeOrigin))
  }

  deinit { circuitWeb?.configuration.userContentController.removeScriptMessageHandler(forName:"ksNativeVideo") }
}
// <<< KS NATIVE CIRCUIT INTEGRATION <<<
