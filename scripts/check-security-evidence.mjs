// Offline readiness gate only. Never opens a database connection or reads secrets.
import fs from 'node:fs';
const required = ['schema.sql', 'policies-and-grants.sql', 'function-definitions.sql', 'storage-and-api-boundaries.md'];
const missing = required.filter(name => {
  const file = new URL(`../security/verified-schema/${name}`, import.meta.url);
  return !fs.existsSync(file) || fs.statSync(file).size === 0;
});
if (missing.length) {
  console.error(`BLOCKED: faithful database authorization tests require reviewed, schema-only evidence: ${missing.join(', ')}. See security/verification/README.md. No database tests ran.`);
  process.exitCode = 2;
} else {
  console.error('BLOCKED: evidence is present but must be reviewed and a schema-specific local fixture/role harness implemented before database security can be assessed. No database tests ran.');
  process.exitCode = 2;
}
