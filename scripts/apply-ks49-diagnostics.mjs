// Adds diagnostic code to the packaged iPhone HTML only, not the Cloudflare web app.
import fs from "node:fs";
const file = "www/index.html";
let html = fs.readFileSync(file, "utf8");
const marker = '<script src="ks49-diagnostics.js" defer></script>';
if (!html.includes(marker)) {
  if (!html.includes("</body>")) throw new Error("Cannot locate closing body tag for KS49 instrumentation.");
  html = html.replace("</body>", marker + "\n</body>");
  fs.writeFileSync(file, html);
}
if (!fs.existsSync("www/ks49-diagnostics.js")) throw new Error("KS49 diagnostics script missing");
console.log("KS49 iPhone Player diagnostics injected into native HTML");
