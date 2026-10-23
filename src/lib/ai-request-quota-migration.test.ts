import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const denyPolicyMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261023170000_explicit_deny_ai_request_events.sql"),
  "utf8",
);
const quotaMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261022230000_add_ai_request_rate_limits.sql"),
  "utf8",
);

describe("AI request quota database security contract", () => {
  it("explicitly denies every direct table operation to browser roles", () => {
    expect(denyPolicyMigration).toMatch(
      /create policy[\s\S]*?for all[\s\S]*?to anon,\s*authenticated[\s\S]*?using\s*\(false\)[\s\S]*?with check\s*\(false\)/i,
    );
  });

  it("keeps quota events inaccessible directly and limits RPC execution to signed-in users", () => {
    expect(quotaMigration).toMatch(
      /revoke all on table public\.ai_request_events from public, anon, authenticated;/i,
    );
    expect(quotaMigration).toMatch(
      /revoke all on function public\.consume_ai_request\(text\) from public, anon;/i,
    );
    expect(quotaMigration).toMatch(
      /grant execute on function public\.consume_ai_request\(text\) to authenticated;/i,
    );
    expect(quotaMigration).toMatch(/auth\.uid\(\)/i);
    expect(quotaMigration).toMatch(/set search_path = pg_catalog, public/i);
  });
});
