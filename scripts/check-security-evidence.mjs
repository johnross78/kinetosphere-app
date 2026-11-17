// Offline report verification only. To RUN database tests: npm run test:security:database.
// Never opens a database connection, reads credentials, or certifies production.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
try {
  const report=JSON.parse(fs.readFileSync(new URL('security/test-results/local-run.json',root),'utf8'));
  if(report.failed!==0 || report.passed<1) throw Error('No successful local database/API run recorded');
  for(const [name,expected] of Object.entries(report.inputs)) {
    const actual=createHash('sha256').update(fs.readFileSync(new URL(name,root))).digest('hex');
    if(actual!==expected) throw Error(`Recorded local results are stale: ${name}`);
  }
  console.log(`RECORDED LOCAL VALIDATION: ${report.passed} database/API assertions passed for these evidence and SQL hashes. This command did not rerun them. Production-equivalent certification remains BLOCKED; see security/verification/README.md.`);
} catch(error) {
  console.error(`BLOCKED: ${error.message}. Run the isolated database harness. This preflight performed no database tests.`);
  process.exitCode=2;
}
