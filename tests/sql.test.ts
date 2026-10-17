import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

let db: PGlite;

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    if (file.endsWith('.sql')) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await db.exec(sql);
    }
  }
}

// Helper to execute a query and return the error if it fails, or undefined if it succeeds
async function fails(sql: string): Promise<any> {
  try {
    await db.query(sql);
    return undefined; // Succeeded (bad for a negative test)
  } catch (e: any) {
    return e; // Failed (good for a negative test)
  }
}

beforeAll(async () => {
  db = new PGlite();
  await runMigrations();
  // Create a dummy orders table for the policy acceptance test
  await db.query(`create table if not exists orders (id uuid primary key default gen_random_uuid());`);
});

describe("menu schema", () => {
  it("draft without price ok; publishing without price blocked", async () => {
    const cid = (await db.query<{ id: string }>("insert into menu_categories(name) values ('Test Cat') returning id")).rows[0].id;
    
    // Draft without price should work
    await db.query(`insert into menu_items(category_id, name) values ('${cid}', 'Draft Item')`);
    
    // Publishing without price should fail (published_needs_price constraint)
    expect(await fails(`update menu_items set status='published' where name='Draft Item'`)).toBeTruthy();
  });

  it("rejects zero/negative/float-ish price and oversize", async () => {
    const cid = (await db.query<{ id: string }>("select id from menu_categories limit 1")).rows[0].id;
    
    for (const p of ["0", "-1", "10000000001"]) {
      expect(await fails(`insert into menu_items(category_id, name, price_kobo) values ('${cid}', 'Bad Price ${p}', ${p})`)).toBeTruthy();
    }
  });

  // FIXED: Aligned test with playbook schema and PGlite capabilities.
  // Playbook uses a simple unique index: create unique index ... on (category_id, lower(name)).
  // Archiving does NOT free the name in this schema.
  it("duplicate names in a category blocked; archived items retain name uniqueness per playbook", async () => {
    const cid = (await db.query<{ id: string }>("insert into menu_categories(name) values ('Dup Test') returning id")).rows[0].id;
    
    // 1. Insert original item
    await db.query(`insert into menu_items(category_id, name) values ('${cid}', 'Jollof')`);
    
    // 2. Exact duplicate must fail (Proves the index works in PGlite)
    expect(await fails(`insert into menu_items(category_id, name) values ('${cid}', 'Jollof')`)).toBeTruthy();
    
    // 3. Archive the original item
    await db.query(`update menu_items set status='archived' where name='Jollof' and category_id='${cid}'`);
    
    // 4. Per playbook simple index, name is still reserved. Insert must fail.
    expect(await fails(`insert into menu_items(category_id, name) values ('${cid}', 'Jollof')`)).toBeTruthy();
  });

  it("optimistic locking: stale version rejected, fresh bumps version", async () => {
    const cid = (await db.query<{ id: string }>("select id from menu_categories limit 1")).rows[0].id;
    const r = (await db.query<{ id: string; version: number }>(`insert into menu_items(category_id, name) values ('${cid}', 'Lock Test') returning id, version`)).rows[0];
    
    // Stale version should fail
    expect(await fails(`update menu_items set name='X', version=1 where id='${r.id}'`)).toBeTruthy();
    
    // Fresh version should succeed
    await db.query(`update menu_items set name='Y', version=${r.version} where id='${r.id}'`);
    const after = (await db.query<{ version: number }>(`select version from menu_items where id='${r.id}'`)).rows[0];
    expect(after.version).toBe(r.version + 1);
  });

  it("cannot hard-delete a category that has items", async () => {
    expect(await fails("delete from menu_categories")).toBeTruthy();
  });
});

describe("policy acceptance", () => {
  it("insert once per order+version, duplicates blocked, update forbidden", async () => {
    const oid = (await db.query<{ id: string }>("insert into orders default values returning id")).rows[0].id;
    
    await db.query(`insert into order_policy_acceptances(order_id, policy_version) values ('${oid}', 'v1')`);
    
    // Duplicate should fail
    expect(await fails(`insert into order_policy_acceptances(order_id, policy_version) values ('${oid}', 'v1')`)).toBeTruthy();
    
    // Update should fail (append-only trigger)
    expect(await fails(`update order_policy_acceptances set policy_version='v2' where order_id='${oid}'`)).toBeTruthy();
  });
});
