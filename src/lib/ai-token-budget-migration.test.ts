import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261024120000_add_ai_token_budget_enforcement.sql"),
  "utf8",
);

describe("AI token-budget migration security contract", () => {
  it("denies direct browser-role access to the token ledger", () => {
    expect(migration).toMatch(/revoke all on table public\.ai_token_budget_events from public, anon, authenticated;/i);
    expect(migration).toMatch(/create policy "deny direct access to AI token budget events"[\s\S]*?for all[\s\S]*?to anon, authenticated[\s\S]*?using \(false\)[\s\S]*?with check \(false\)/i);
  });

  it("limits reservations to authenticated users and uses a fixed search path", () => {
    expect(migration).toMatch(/auth\.uid\(\)/i);
    expect(migration).toMatch(/set search_path = pg_catalog, public/i);
    expect(migration).toMatch(/revoke all on function public\.reserve_ai_token_budget\(text, integer\) from public, anon;/i);
    expect(migration).toMatch(/grant execute on function public\.reserve_ai_token_budget\(text, integer\) to authenticated;/i);
    expect(migration).toMatch(/grant execute on function public\.settle_ai_token_budget\(uuid, integer\) to authenticated;/i);
  });

  it("enforces a rolling token cap and validates settled usage", () => {
    expect(migration).toMatch(/v_budget_limit constant bigint := 500000/i);
    expect(migration).toMatch(/p_reserved_tokens < 1 or p_reserved_tokens > 150000/i);
    expect(migration).toMatch(/actual_tokens is not null and actual_tokens between 0 and 300000/i);
    expect(migration).toMatch(/settled_at > v_now - interval '24 hours'/i);
  });
});
