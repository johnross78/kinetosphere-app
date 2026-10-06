import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const appDelegate=path.join(root,'ios','App','App','AppDelegate.swift');
const storyboard=path.join(root,'ios','App','App','Base.lproj','Main.storyboard');

function fail(message){
  console.error('RC34 native iOS patch failed: '+message);
  process.exit(1);
}

if(!fs.existsSync(appDelegate)) fail('AppDelegate.swift not found. Run npx cap add ios / npx cap sync ios first.');
if(!fs.existsSync(storyboard)) fail('Main.storyboard not found. Run npx cap add ios / npx cap sync ios first.');

let swift=fs.readFileSync(appDelegate,'utf8');
const start='// >>> KINETOSPHERE RC34 NATIVE ROTATION FIX >>>';
const end='// <<< KINETOSPHERE RC34 NATIVE ROTATION FIX <<<';
const block = String.raw`
// >>> KINETOSPHERE RC34 NATIVE ROTATION FIX >>>

@objc(KinetosphereBridgeViewController)
final class KinetosphereBridgeViewController: CAPBridgeViewController {
    private var rotationGeneration: Int = 0

    override func viewDidLoad() {
        super.viewDidLoad()
        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        normalizePlayerWebView()
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)

        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        rotationGeneration += 1
        let generation = rotationGeneration

        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.schedulePostRotationNormalization(generation: generation)
        }
    }

    private func schedulePostRotationNormalization(generation: Int) {
        let delays: [Double] = [0.0, 0.08, 0.20, 0.40]

        for delay in delays {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self, generation == self.rotationGeneration else { return }
                self.normalizePlayerWebView()
            }
        }
    }

    private func normalizePlayerWebView() {
        guard UIDevice.current.userInterfaceIdiom == .phone,
              let webView = self.webView else { return }

        webView.evaluateJavaScript("document.body && document.body.classList.contains('player-active')") { [weak self, weak webView] result, _ in
            guard let self = self,
                  let webView = webView,
                  (result as? Bool) == true else { return }

            let scrollView = webView.scrollView
            scrollView.contentInsetAdjustmentBehavior = .never
            scrollView.contentInset = .zero
            scrollView.scrollIndicatorInsets = .zero

            if abs(scrollView.zoomScale - 1.0) > 0.001 {
                scrollView.setZoomScale(1.0, animated: false)
            }

            webView.frame = self.view.bounds
            webView.setNeedsLayout()
            webView.layoutIfNeeded()
            scrollView.setNeedsLayout()
            scrollView.layoutIfNeeded()

            let js = """
            (() => {
              try {
                document.documentElement.style.webkitTextSizeAdjust = '100%';
                document.documentElement.style.textSizeAdjust = '100%';
                window.scrollTo(0, 0);
                window.dispatchEvent(new Event('resize'));
                window.dispatchEvent(new CustomEvent('kinetosphere:native-rotation-settled'));
              } catch (_) {}
            })();
            """
            webView.evaluateJavaScript(js, completionHandler: nil)
        }
    }
}

// <<< KINETOSPHERE RC34 NATIVE ROTATION FIX <<<
`;

const markerStart=swift.indexOf(start);
const markerEnd=swift.indexOf(end);
if(markerStart>=0 && markerEnd>=markerStart){
  swift=swift.slice(0,markerStart)+block.trim()+swift.slice(markerEnd+end.length);
}else{
  swift=swift.trimEnd()+'\n\n'+block.trim()+'\n';
}
fs.writeFileSync(appDelegate,swift);

let board=fs.readFileSync(storyboard,'utf8');
const standard='customClass="CAPBridgeViewController" customModule="Capacitor"';
const custom='customClass="KinetosphereBridgeViewController" customModule="App" customModuleProvider="target"';
if(board.includes(standard)){
  board=board.replace(standard,custom);
}else if(!board.includes('customClass="KinetosphereBridgeViewController"')){
  fail('Could not find the CAPBridgeViewController scene in Main.storyboard.');
}
fs.writeFileSync(storyboard,board);

console.log('Applied RC34 native iPhone rotation fix: custom CAPBridgeViewController + storyboard wiring.');
