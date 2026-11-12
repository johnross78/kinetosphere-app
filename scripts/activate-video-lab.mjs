// iOS Video Lab: substitute ONLY the Codemagic build artifact's entry page.
import fs from "node:fs";
const from = "video-lab/index.html";
const target = "www/index.html";
if (!fs.existsSync(from) || !fs.existsSync(target)) throw Error("Video lab source or Capacitor webDir missing.");
const html = fs.readFileSync(from,"utf8");
if (!html.includes("KINETOSPHERE • iOS VIDEO LAB") || !html.includes('data-mode="bridge"')) throw Error("Video lab page failed validation");
fs.writeFileSync(target,html);
console.log("Isolated video lab activated for this build only.");
