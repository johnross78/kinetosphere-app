// Disposable local Docker only. No DSN, hosted project, or external endpoint input.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, spawn } from 'node:child_process';
import { randomBytes, createHmac, createHash } from 'node:crypto';
import { baselineSQL, evidence } from '../security/local/catalog-loader.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const dbImage = 'postgres:15.15-alpine@sha256:1d1095b0503145be79c79239372aefadfacf6b7c33c9245bbf99ce4b6b89c737';
const apiImage = 'postgrest/postgrest:v12.2.3@sha256:729bf65c733b73f5b52777f0e4b853f22ed73aa67a22d38269d289779b0a8401';
const prefix = `ks-security-${process.pid}`;
const db = `${prefix}-db`, api = `${prefix}-api`, network = `${prefix}-net`;
const secret = randomBytes(48).toString('hex'); // ephemeral local JWT key; never logged
const results = [];
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const u = { free:1, subscriber:2, owner:3, editor:4, admin:5, analyst:6, platform:11, recipient:12, wrong:13, applicant:14, foreignOwner:15 };
const claims = who => who === 'anon' ? {} : { sub:uuid(u[who]), email:`${who}@example.invalid`, role:'authenticated', app_metadata: who === 'platform' ? {admin:true} : {} };
function docker(args, input) {
  const r = spawnSync('docker', args, { input, encoding:'utf8', maxBuffer:16*1024*1024 });
  if (r.status !== 0) throw Error(`Local Docker operation failed (${args[0]}): ${(r.stderr || '').replaceAll(secret, '[redacted]').slice(0,1800)}`);
  return r.stdout.trim();
}
function sql(text) { return docker(['exec','-i',db,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'], text); }
function attempt(who, query) {
  const role = who === 'anon' ? 'anon' : 'authenticated';
  return spawnSync('docker',['exec','-i',db,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres'], {
    input:`BEGIN; SET LOCAL ROLE ${role}; SET LOCAL request.jwt.claims='${JSON.stringify(claims(who))}'; ${query}; ROLLBACK;`, encoding:'utf8',
  });
}
function check(label, actual, expected) {
  if (actual !== expected) throw Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  results.push({label,passed:true}); console.log(`PASS ${label}`);
}
function value(who, query) {
  const r = attempt(who,query);
  if (r.status !== 0) throw Error(`SQL assertion for ${who} failed: ${r.stderr}`);
  return r.stdout.trim();
}
function denied(label, who, query, message) {
  const r = attempt(who,query);
  check(label, r.status !== 0 && r.stderr.includes(message), true);
}
const media = n => `SELECT count(*) FROM public.provider_media_assets WHERE id='${uuid(n)}'`;
function committed(who, query) {
  return new Promise(resolve => {
    const child=spawn('docker',['exec','-i',db,'psql','-h','127.0.0.1','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres']);
    let out='',err='';
    child.stdout.on('data',data=>{out+=data;}); child.stderr.on('data',data=>{err+=data;});
    child.on('close',status=>resolve({status,out:out.trim(),err}));
    child.stdin.end(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims='${JSON.stringify(claims(who))}'; ${query}; COMMIT;`);
  });
}
function jwt(who) {
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const content = `${enc({alg:'HS256',typ:'JWT'})}.${enc({...claims(who),exp:Math.floor(Date.now()/1000)+300})}`;
  return `${content}.${createHmac('sha256',secret).update(content).digest('base64url')}`;
}
function request(who, route, body) {
  const args = ['exec',db,'wget','-Y','off','-S','-O-'];
  if (who !== 'anon') args.push('--header',`Authorization: Bearer ${jwt(who)}`);
  if (body) args.push('--header','Content-Type: application/json','--post-data',JSON.stringify(body));
  args.push(`http://${api}:3000/${route}`);
  const r = spawnSync('docker',args,{encoding:'utf8'});
  const status = [...(r.stderr || '').matchAll(/HTTP\/1\.[01] (\d+)/g)].at(-1)?.[1];
  if (!status) throw Error(`Local API transport unavailable: ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  return { status:Number(status), body:r.stdout.trim() };
}
function fixtures() {
  return `
 INSERT INTO auth.users(id) VALUES ${Object.values(u).map(n=>`('${uuid(n)}')`).join(',')},('${uuid(999)}');
 INSERT INTO public.providers(id,slug,name,discoverable,free_sample_enabled,access_model,status) VALUES
 ('${uuid(101)}','p1','Provider One',true,false,'subscription','active'),
 ('${uuid(102)}','p2','Provider Two',true,true,'subscription','active'),
 ('${uuid(103)}','inactive','Inactive',true,true,'subscription','inactive');
 INSERT INTO public.provider_members(provider_id,user_id,role) VALUES
 ${['owner','editor','admin','analyst'].map(role=>`('${uuid(101)}','${uuid(u[role])}','${role}')`).join(',')},
 ('${uuid(102)}','${uuid(u.foreignOwner)}','owner');
 INSERT INTO public.provider_storefronts(provider_id) VALUES ('${uuid(101)}'),('${uuid(102)}');
 INSERT INTO public.provider_entitlements(user_id,provider_id,status,starts_at,ends_at)
 VALUES ('${uuid(u.subscriber)}','${uuid(101)}','active',now()-interval '1 day',now()+interval '1 day');
 INSERT INTO public.provider_media_assets(id,provider_id,entity_type,entity_id,asset_type,preview_allowed,external_url) VALUES
 ('${uuid(201)}','${uuid(101)}','exercise','paid-p1','source_video',false,'https://media.invalid/paid-p1'),
 ('${uuid(202)}','${uuid(102)}','exercise','paid-p2','source_video',false,'https://media.invalid/paid-p2'),
 ('${uuid(203)}','${uuid(102)}','exercise','sample','preview_video',true,'https://media.invalid/preview'),
 ('${uuid(204)}','${uuid(102)}','exercise','not-approved','preview_video',false,'https://media.invalid/unapproved'),
 ('${uuid(205)}',null,'exercise','orphan','source_video',false,'https://media.invalid/orphan'),
 ('${uuid(206)}','${uuid(103)}','exercise','inactive','preview_video',true,'https://media.invalid/inactive');
 INSERT INTO public.provider_invites(id,provider_id,email,role,invited_by,created_at,status) VALUES
 ('${uuid(301)}','${uuid(101)}','recipient@example.invalid','editor','${uuid(u.owner)}',now()-interval '8 days','pending'),
 ('${uuid(302)}','${uuid(101)}','wrong@example.invalid','editor','${uuid(u.owner)}',now(),'revoked'),
 ('${uuid(303)}','${uuid(101)}','other@example.invalid','editor','${uuid(u.owner)}',now(),'accepted');
 INSERT INTO public.gym_circuits(user_id,record_id,data) VALUES ('${uuid(u.subscriber)}','private-circuit','{}');
 INSERT INTO public.shared_exercises(record_id,data) VALUES ('public-movement','{}');
 `;
}

try {
  docker(['network','create','--internal',network]);
  docker(['run','-d','--name',db,'--network',network,'--label','kinetosphere.security=local-test','-e','POSTGRES_HOST_AUTH_METHOD=trust',dbImage]);
  let ready = false;
  for(let i=0;i<60;i++) {
    const r = spawnSync('docker',['exec',db,'pg_isready','-h','127.0.0.1','-U','postgres'],{stdio:'ignore'});
    if(r.status===0){ready=true;break;}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready) throw Error('Local PostgreSQL did not become ready');
  sql(read('security/local/auth-adapter.sql'));
  sql(baselineSQL()); sql(fixtures());
  check('baseline reconstructs all 18 public tables',sql("SELECT count(*) FROM pg_tables WHERE schemaname='public'"),'18');
  check('baseline reconstructs all 39 actual policies',sql("SELECT count(*) FROM pg_policies WHERE schemaname='public'"),'39');
  check('baseline reconstructs all 66 constraints',sql("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public'"),'66');
  check('baseline reconstructs all 43 indexes',sql("SELECT count(*) FROM pg_indexes WHERE schemaname='public'"),'43');
  check('baseline enables RLS on all 18 tables',sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relrowsecurity"),'18');
  check('baseline reconstructs all 11 actual functions',sql("SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'"),'11');
  for(const who of ['anon',...Object.keys(u)]) check(`actual role ${who} has no RLS bypass`, value(who,"SELECT current_user || ':' || rolbypassrls FROM pg_roles WHERE rolname=current_user"), `${who==='anon'?'anon':'authenticated'}:false`);
  docker(['run','-d','--name',api,'--network',network,'--label','kinetosphere.security=local-test','-e',`PGRST_DB_URI=postgres://authenticator@${db}:5432/postgres`,'-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e',`PGRST_JWT_SECRET=${secret}`,apiImage]);
  let apiReady=false;
  for(let i=0;i<60;i++) { try { if(request('anon','shared_exercises?select=record_id').status===200){apiReady=true;break;} }catch{} await new Promise(resolve=>setTimeout(resolve,500)); }
  if(!apiReady) throw Error(`Local PostgREST did not become ready: ${docker(['logs',api]).slice(0,1500)}`);
  check('BASELINE API weakness: free member receives paid asset row',JSON.parse(request('free',`provider_media_assets?id=eq.${uuid(202)}&select=id`).body).length,1);
  check('BASELINE weakness: free member reads paid media when samples enabled',value('free',media(202)),'1');
  check('BASELINE weakness: unapproved preview readable',value('free',media(204)),'1');
  check('BASELINE weakness: orphan media readable',value('free',media(205)),'1');
  check('BASELINE weakness: inactive provider preview readable',value('free',media(206)),'1');
  sql("UPDATE public.provider_entitlements SET ends_at=now()-interval '1 hour'");
  check('BASELINE weakness: expired active subscription reads paid media',value('subscriber',media(201)),'1');
  sql("UPDATE public.provider_entitlements SET starts_at=now()+interval '1 day',ends_at=now()+interval '2 days'");
  check('BASELINE weakness: future active subscription reads paid media',value('subscriber',media(201)),'1');
  check('BASELINE weakness: old pending invite accepted',value('recipient',`SELECT public.accept_provider_invite('${uuid(301)}')`),uuid(101));
  denied('BASELINE protection: wrong email rejected','wrong',`SELECT public.accept_provider_invite('${uuid(301)}')`,'different email');
  denied('BASELINE protection: revoked invitation rejected','wrong',`SELECT public.accept_provider_invite('${uuid(302)}')`,'no longer pending');
  check('BASELINE weakness: platform admin helper returns NULL for missing role claim',value('free','SELECT public.is_platform_admin() IS NULL'),'t');
  check('BASELINE weakness: free user removes another provider member via NULL guard',value('free',`SELECT public.remove_provider_member('${uuid(101)}','${uuid(u.editor)}')`),'t');
  check('BASELINE weakness: free user creates provider invite via NULL guard',value('free',`SELECT public.create_provider_invite('${uuid(101)}','attack@example.invalid','editor') IS NOT NULL`),'t');
  check('BASELINE weakness: free user approves onboarding via NULL guard',value('free',"SELECT public.review_provider_onboarding_application(public.submit_provider_onboarding_application('Untrusted Provider','free@example.invalid','',''),true) IS NOT NULL"),'t');
  check('BASELINE weakness: authenticated TRUNCATE bypasses RLS',value('free','TRUNCATE public.gym_circuits; SELECT count(*) FROM public.gym_circuits'),'0');

  const changes=[];
  for(const name of ['function-execute','entitlement-window','media-access','invitation-expiration']) {
    const source=read(`security/proposals/${name}.sql`);
    if(source.includes(evidence.redaction.synthetic_uuid)) throw Error('Synthetic administrator found in reviewed change set');
    changes.push(source);
  }
  sql('BEGIN;\n'+changes.join('\n')+'\nROLLBACK;');
  check('rollback rehearsal restores old preview policy',value('free',media(202)),'1');
  check('rollback rehearsal restores original helper semantics',value('free','SELECT public.is_platform_admin() IS NULL'),'t');
  check('rollback rehearsal removes uncommitted expiry column',sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_invites' AND column_name='expires_at'"),'0');
  sql('BEGIN;\n'+changes.join('\n')+'\nCOMMIT;');
  check('corrected admin helper is false, not NULL',value('free','SELECT public.is_platform_admin()'),'f');
  check('editable user_metadata cannot grant database admin',value('free',`SET LOCAL request.jwt.claims='${JSON.stringify({...claims('free'),user_metadata:{admin:true}})}'; SELECT public.is_platform_admin()`),'f');
  denied('free user cannot remove member','free',`SELECT public.remove_provider_member('${uuid(101)}','${uuid(u.editor)}')`,'Not authorized');
  denied('free user cannot create invite','free',`SELECT public.create_provider_invite('${uuid(101)}','attack@example.invalid','editor')`,'Not authorized');
  denied('authenticated cannot TRUNCATE private circuits','free','TRUNCATE public.gym_circuits','permission denied');
  denied('anon cannot TRUNCATE private circuits','anon','TRUNCATE public.gym_circuits','permission denied');
  check('anon still reads public exercise library',value('anon','SELECT count(*) FROM public.shared_exercises'),'1');
  check('anon sees no raw protected assets',value('anon','SELECT count(*) FROM public.provider_media_assets'),'0');
  for(const n of [202,204,205,206]) check(`free user denied protected asset ${n}`,value('free',media(n)),'0');
  check('approved preview remains available',value('free',media(203)),'1');
  for(const who of ['owner','admin','editor','platform']) check(`${who} retains own media access`,value(who,media(201)),'1');
  check('analyst does not gain paid content by membership alone',value('analyst',media(201)),'0');
  check('editor cannot read foreign paid media',value('editor',media(202)),'0');
  for(const status of ['active','trialing','comped','canceled','expired','past_due']) {
    for(const [window,start,end] of [['valid',"now()-interval '1 day'","now()+interval '1 day'"],['expired',"now()-interval '2 days'","now()-interval '1 day'"],['future',"now()+interval '1 day'","now()+interval '2 days'"],['open',"now()-interval '1 day'",'NULL']]) {
      sql(`UPDATE public.provider_entitlements SET status='${status}',starts_at=${start},ends_at=${end},canceled_at=now()-interval '1 hour'`);
      const allow = (window==='valid' && ['active','trialing','comped','canceled'].includes(status)) || (window==='open' && status==='comped');
      check(`${status}/${window} entitlement media decision`,value('subscriber',media(201)),allow?'1':'0');
    }
  }
  for(const expr of ["'2026-01-02','2026-01-03','2026-01-03'", "'2026-01-03','2026-01-02','2026-01-01'", "NULL,'2026-01-02','2026-01-01'"]) {
    check(`strict interval boundary ${expr}`,sql(`SELECT kinetosphere_security.entitlement_effective('active',${expr})`),'f');
  }
  denied('expired invite denied after correction','recipient',`SELECT public.accept_provider_invite('${uuid(301)}')`,'Invite expired');
  denied('expired invite email claim denied','owner',`SELECT * FROM public.claim_provider_invite_email('${uuid(301)}')`,'Invite expired');
  check('old invite retains original age in backfill',sql(`SELECT expires_at=created_at+interval '7 days' FROM public.provider_invites WHERE id='${uuid(301)}'`),'t');
  const invite = value('owner',`SELECT public.create_provider_invite('${uuid(101)}','recipient@example.invalid','editor')`);
  // value() rolls mutations back: use a fixture-only new invite for persistent tests.
  sql(`UPDATE public.provider_invites SET status='revoked' WHERE id='${uuid(301)}'; INSERT INTO public.provider_invites(id,provider_id,email,role,invited_by) VALUES ('${uuid(304)}','${uuid(101)}','recipient@example.invalid','editor','${uuid(u.owner)}')`);
  // Old pending invite must first be revoked to respect the actual partial index.
  check('owner create invite RPC still returns UUID',/^[a-f0-9-]{36}$/.test(invite),true);

  denied('fresh invite wrong recipient still rejected','wrong',`SELECT public.accept_provider_invite('${uuid(304)}')`,'different email');
  denied('accepted invite replay rejected','free',`SELECT public.accept_provider_invite('${uuid(303)}')`,'no longer pending');
  check('owner cannot demote another owner through role RPC',value('owner',`SELECT public.update_provider_member_role('${uuid(101)}','${uuid(u.owner)}','editor')`),'f');
  check('owner cannot remove owner through member RPC',value('owner',`SELECT public.remove_provider_member('${uuid(101)}','${uuid(u.owner)}')`),'f');
  check('owner can update an editor',value('owner',`SELECT public.update_provider_member_role('${uuid(101)}','${uuid(u.editor)}','analyst')`),'t');
  check('owner can remove an editor',value('owner',`SELECT public.remove_provider_member('${uuid(101)}','${uuid(u.editor)}')`),'t');
  denied('provider admin cannot manage owner-only team operations','admin',`SELECT public.create_provider_invite('${uuid(101)}','new@example.invalid','editor')`,'Not authorized');
  denied('foreign owner cannot edit another provider team','foreignOwner',`SELECT public.remove_provider_member('${uuid(101)}','${uuid(u.editor)}')`,'Not authorized');
  check('editor own storefront edit allowed',value('editor',`WITH changed AS (UPDATE public.provider_storefronts SET tagline='local-test' WHERE provider_id='${uuid(101)}' RETURNING 1) SELECT count(*) FROM changed`),'1');
  check('editor foreign storefront edit hidden by RLS',value('editor',`WITH changed AS (UPDATE public.provider_storefronts SET tagline='local-test' WHERE provider_id='${uuid(102)}' RETURNING 1) SELECT count(*) FROM changed`),'0');
  denied('editor cannot reassign storefront provider','editor',`UPDATE public.provider_storefronts SET provider_id='${uuid(103)}' WHERE provider_id='${uuid(101)}'`,'row-level security');
  check('private circuits hidden from other subscriber',value('free','SELECT count(*) FROM public.gym_circuits'),'0');
  check('subscriber retains own circuit',value('subscriber','SELECT count(*) FROM public.gym_circuits'),'1');
  check('platform moderator does not bypass private circuit ownership',value('platform','SELECT count(*) FROM public.gym_circuits'),'0');
  denied('subscriber cannot reassign circuit ownership','subscriber',`UPDATE public.gym_circuits SET user_id='${uuid(u.free)}'`,'row-level security');
  denied('subscriber cannot grant own entitlement','subscriber',`INSERT INTO public.provider_entitlements(user_id,provider_id) VALUES ('${uuid(u.subscriber)}','${uuid(102)}')`,'row-level security');
  check('subscriber cannot mutate own entitlement',value('subscriber',"WITH changed AS (UPDATE public.provider_entitlements SET status='comped' RETURNING 1) SELECT count(*) FROM changed"),'0');
  check('onboarding applicant can submit matching identity',value('applicant',"SELECT public.submit_provider_onboarding_application('Synthetic Provider','applicant@example.invalid','','') IS NOT NULL"),'t');
  denied('onboarding wrong email denied','applicant',"SELECT public.submit_provider_onboarding_application('Synthetic Provider','wrong@example.invalid','','')",'signed-in account');
  sql(`INSERT INTO public.provider_onboarding_applications(id,applicant_user_id,business_name,contact_email) VALUES ('${uuid(401)}','${uuid(u.applicant)}','Synthetic Provider','applicant@example.invalid')`);
  denied('free member cannot review onboarding','free',`SELECT public.review_provider_onboarding_application('${uuid(401)}',true)`,'platform administration required');
  check('platform can approve onboarding and assign owner',value('platform',`SELECT public.review_provider_onboarding_application('${uuid(401)}',true) IS NOT NULL`),'t');
  for(const name of ['current_provider_role(uuid)','is_platform_admin()','provider_has_capability(uuid,text)']) check(`anon EXECUTE removed for ${name}`,sql(`SELECT has_function_privilege('anon','public.${name}','EXECUTE')`),'f');

  const accepts=await Promise.all([committed('recipient',`SELECT public.accept_provider_invite('${uuid(304)}'); SELECT pg_sleep(0.3)`),committed('recipient',`SELECT public.accept_provider_invite('${uuid(304)}'); SELECT pg_sleep(0.3)`)]);
  check('concurrent acceptance exactly one success',accepts.filter(r=>r.status===0).length,1);
  check('concurrent acceptance replay rejects second caller',accepts.filter(r=>r.err.includes('no longer pending')).length,1);
  check('concurrent acceptance creates exactly one membership',sql(`SELECT count(*) FROM public.provider_members WHERE provider_id='${uuid(101)}' AND user_id='${uuid(u.recipient)}'`),'1');
  check('concurrent acceptance marks invite accepted',sql(`SELECT status FROM public.provider_invites WHERE id='${uuid(304)}'`),'accepted');
  sql(`INSERT INTO public.provider_invites(id,provider_id,email,role,invited_by) VALUES ('${uuid(305)}','${uuid(101)}','owner@example.invalid','editor','${uuid(u.owner)}')`);
  denied('existing member role cannot be changed via invite','owner',`SELECT public.accept_provider_invite('${uuid(305)}')`,'Already a member');
  sql(`INSERT INTO public.provider_invites(id,provider_id,email,role,invited_by) VALUES ('${uuid(306)}','${uuid(101)}','wrong@example.invalid','editor','${uuid(u.owner)}')`);
  await Promise.all([committed('wrong',`SELECT public.accept_provider_invite('${uuid(306)}')`),committed('owner',`SELECT public.revoke_provider_invite('${uuid(306)}')`)]);
  check('accept/revoke race leaves consistent membership and status',sql(`SELECT ((status='accepted') = EXISTS(SELECT 1 FROM public.provider_members WHERE user_id='${uuid(u.wrong)}' AND provider_id='${uuid(101)}')) FROM public.provider_invites WHERE id='${uuid(306)}'`),'t');

  // More workflow/API assertions are below; results contain only names/counts.
  for(const [who,route,count] of [['anon','shared_exercises?select=record_id',1],['anon','provider_media_assets?select=id',0],['free',`provider_media_assets?id=eq.${uuid(202)}&select=id`,0],['free',`provider_media_assets?id=eq.${uuid(203)}&select=id`,1]]) {
    const r=request(who,route); check(`API ${who} ${route} status`,r.status,200); check(`API ${who} ${route} row count`,JSON.parse(r.body).length,count);
  }
  for(const who of ['anon','free','editor','admin','foreignOwner']) {
    const r=request(who,'rpc/remove_provider_member',{p_provider_id:uuid(101),p_user_id:uuid(u.editor)});
    check(`API ${who} unauthorized team mutation rejected`,r.status>=400,true);
  }
  const ownerUpdate=request('owner','rpc/update_provider_member_role',{p_provider_id:uuid(101),p_user_id:uuid(u.editor),p_role:'editor'});
  check('API owner can manage permitted team roles',ownerUpdate.status,200);
  check('API owner role update returns true',ownerUpdate.body,'true');
  const freeReview=request('free','rpc/review_provider_onboarding_application',{p_application_id:uuid(401),p_approve:true});
  check('API free user cannot approve onboarding',freeReview.status,400);
  const review=request('platform','rpc/review_provider_onboarding_application',{p_application_id:uuid(401),p_approve:true});
  check('API platform onboarding approval preserved',review.status,200);
  check('API onboarding creates pending private provider and owner atomically',sql(`SELECT count(*) FROM public.providers p JOIN public.provider_members m ON m.provider_id=p.id WHERE p.id='${JSON.parse(review.body)}' AND p.status='pending' AND NOT p.discoverable AND p.access_model='private' AND m.user_id='${uuid(u.applicant)}' AND m.role='owner'`),'1');
  const hash = text => createHash('sha256').update(text).digest('hex');
  const inputs = [...fs.readdirSync(path.join(root,'security/verified-schema')).map(n=>`security/verified-schema/${n}`),...['function-execute','entitlement-window','media-access','invitation-expiration'].map(n=>`security/proposals/${n}.sql`),'security/local/auth-adapter.sql','security/local/catalog-loader.mjs','scripts/test-provider-security.mjs'];
  const report={scope:'Reconstructed public schema + real PostgreSQL roles + local PostgREST. Auth adapter, not full Supabase Auth.',dbImage,apiImage,node:process.version,postgres:sql('SHOW server_version'),passed:results.length,failed:0,inputs:Object.fromEntries(inputs.map(n=>[n,hash(read(n))])),results};
  fs.mkdirSync(path.join(root,'security/test-results'),{recursive:true});
  fs.writeFileSync(path.join(root,'security/test-results/local-run.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`${results.length} local database/API assertions passed; production equivalence NOT established.`);
} finally {
  for(const name of [api,db]) spawnSync('docker',['rm','-fv',name],{stdio:'ignore'});
  spawnSync('docker',['network','rm',network],{stdio:'ignore'});
}
