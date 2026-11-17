// LOCAL FIXTURE reconstruction only. The anonymized catalog is never a deployment.
import fs from 'node:fs';
export const evidence = JSON.parse(fs.readFileSync(new URL('../verified-schema/catalog.json', import.meta.url), 'utf8'));
const q = value => '"' + value.replaceAll('"', '""') + '"';
export function baselineSQL() {
  const c = evidence;
  const sql = ['SET search_path=public,extensions;', 'SET check_function_bodies=off;'];
  for (const t of c.tables) {
    sql.push(`CREATE TABLE public.${q(t.table_name)} (${t.columns.map(col => `${q(col.name)} ${col.type}${col.identity ? ` GENERATED ${col.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY` : col.default ? ` DEFAULT ${col.default}` : ''}${col.nullable ? '' : ' NOT NULL'}`).join(',')});`);
  }
  for (const con of [...c.constraints.filter(c => c.kind !== 'f'), ...c.constraints.filter(c => c.kind === 'f')]) sql.push(`ALTER TABLE public.${q(con.table_name)} ADD CONSTRAINT ${q(con.name)} ${con.definition};`);
  const constraintNames = new Set(c.constraints.map(con => con.name));
  for (const i of c.indexes) if (!constraintNames.has(i.indexname)) sql.push(i.indexdef + ';');
  if (c.triggers.length) throw Error('New trigger evidence requires loader review');
  for (const f of c.functions) sql.push(f.definition + ';');
  for (const f of c.functions) {
    const sig = `public.${q(f.name)}(${f.args})`;
    sql.push(`REVOKE ALL ON FUNCTION ${sig} FROM PUBLIC, anon, authenticated, service_role;`);
    for (const entry of f.acl.slice(1, -1).split(',')) {
      const [role, rest] = entry.split('=');
      if (rest.includes('X')) sql.push(`GRANT EXECUTE ON FUNCTION ${sig} TO ${role ? q(role) : 'PUBLIC'};`);
    }
  }
  for (const g of c.grants) sql.push(`GRANT ${g.privilege_type} ON TABLE public.${q(g.table_name)} TO ${q(g.grantee)};`);
  for (const t of c.tables) sql.push(`ALTER TABLE public.${q(t.table_name)} ENABLE ROW LEVEL SECURITY;`);
  for (const p of c.policies) sql.push(`CREATE POLICY ${q(p.policyname)} ON public.${q(p.tablename)} AS ${p.permissive} FOR ${p.cmd} TO ${p.roles.slice(1, -1).split(',').map(q).join(',')}${p.qual ? ` USING (${p.qual})` : ''}${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`);
  sql.push('RESET check_function_bodies;');
  // Relevant recorded postgres/public defaults, not unrelated platform schemas.
  for (const kind of ['FUNCTIONS', 'TABLES', 'SEQUENCES']) sql.push(`ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ${kind} TO anon, authenticated, service_role;`);
  return sql.join('\n');
}
