import { describe, it, expect, beforeAll } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db: PGlite;
const sql = (f: string) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), "utf8");

beforeAll(async () => {
  db = new PGlite();
  await db.exec(sql("0001_menu_core.sql"));
  await db.exec("create table orders (id uuid primary key default gen_random_uuid());");
  await db.exec(sql("0002_policy_acceptance.sql"));
});

const fails = async (q: string) => { let e: unknown; try { await db.query(q); } catch (x) { e = x; } return e; };

describe("menu schema", () => {
  it("draft without price ok; publishing without price blocked", async () => {
    const c = await db.query<{ id: string }>("insert into menu_categories(name,status) values ('Rice Meals','published') returning id");
    const cid = c.rows[0]!.id;
    await db.query(`insert into menu_items(category_id,name) values ('${cid}','Jollof')`);
    expect(await fails(`insert into menu_items(category_id,name,status) values ('${cid}','Fried Rice','published')`)).toBeTruthy();
  });
  it("rejects zero/negative/float-ish price and oversize", async () => {
    const cid = (await db.query<{ id: string }>("select id from menu_categories limit 1")).rows[0]!.id;
    for (const p of ["0", "-1", "10000000001"]) expect(await fails(`insert into menu_items(category_id,name,price_kobo) values ('${cid}','x${p}',${p})`)).toBeTruthy();
  });
  it("duplicate names in a category blocked case-insensitively; archived one frees the name", async () => {
    const cid = (await db.query<{ id: string }>("select id from menu_categories limit 1")).rows[0]!.id;
    expect(await fails(`insert into menu_items(category_id,name) values ('${cid}','  JOLLOF ')`)).toBeTruthy();
    await db.query(`update menu_items set status='archived' where lower(name)='jollof'`);
    await db.query(`insert into menu_items(category_id,name) values ('${cid}','Jollof')`);
  });
  it("optimistic locking: stale version rejected, fresh bumps version", async () => {
    const r = (await db.query<{ id: string; version: number }>("select id, version from menu_items where status='draft' limit 1")).rows[0]!;
    await db.query(`update menu_items set portion='Large', version=${r.version} where id='${r.id}'`);
    expect(await fails(`update menu_items set portion='X', version=${r.version} where id='${r.id}'`)).toBeTruthy();
    const after = (await db.query<{ version: number }>(`select version from menu_items where id='${r.id}'`)).rows[0]!;
    expect(after.version).toBe(r.version + 1);
  });
  it("cannot hard-delete a category that has items", async () => {
    expect(await fails("delete from menu_categories")).toBeTruthy();
  });
});

describe("policy acceptance", () => {
  it("insert once per order+version, duplicates blocked, update/delete blocked", async () => {
    const oid = (await db.query<{ id: string }>("insert into orders default values returning id")).rows[0]!.id;
    await db.query(`insert into order_policy_acceptances(order_id,policy_version) values ('${oid}','v1')`);
    expect(await fails(`insert into order_policy_acceptances(order_id,policy_version) values ('${oid}','v1')`)).toBeTruthy();
    expect(await fails("update order_policy_acceptances set policy_version='v2'")).toBeTruthy();
    expect(await fails("delete from order_policy_acceptances")).toBeTruthy();
  });
});
