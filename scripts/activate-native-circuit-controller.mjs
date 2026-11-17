// Native Circuit integration: applied to the generated local/Codemagic project.
import fs from "node:fs";
const app="ios/App/App/AppDelegate.swift", storyboard="ios/App/App/Base.lproj/Main.storyboard";
if(!fs.existsSync(app)||!fs.existsSync(storyboard))throw Error("Capacitor iOS project not synced");
let source=fs.readFileSync(app,"utf8");
const nativeSource=fs.readFileSync(new URL("../native/ios/KSNativeCircuitController.swift",import.meta.url),"utf8");
const imports="import UIKit\nimport WebKit\nimport Capacitor\n";
if(!nativeSource.startsWith(imports))throw Error("Unexpected native controller imports");
const fragment=nativeSource.slice(imports.length);
let board=fs.readFileSync(storyboard,"utf8");
const from='customClass="CAPBridgeViewController" customModule="Capacitor"';
const to='customClass="KSNativeCircuitController" customModule="App" customModuleProvider="target"';
if(source.includes("KS NATIVE CIRCUIT INTEGRATION")){
  if(!source.endsWith(fragment)||!board.includes(to)||board.includes(from))throw Error("Generated native controller differs; regenerate ios/ from a clean checkout");
  console.log("Native Circuit integration already matches the version-controlled Swift source");
}else{
  if(!source.includes("import UIKit"))throw Error("Unexpected AppDelegate state");
  if(!board.includes(from)||board.indexOf(from)!==board.lastIndexOf(from))throw Error("Capacitor storyboard changed");
  source=source.replace("import UIKit","import UIKit\nimport WebKit");
  source+=fragment;
  board=board.replace(from,to);
  fs.writeFileSync(app,source);
  fs.writeFileSync(storyboard,board);
  console.log("UIKit Circuit Player native stage active");
}
