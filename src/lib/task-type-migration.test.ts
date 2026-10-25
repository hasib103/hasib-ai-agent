import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261025150000_add_url_analysis_task_type.sql"),
  "utf8",
);

describe("URL analysis task migration", () => {
  it("adds the read-only URL analysis type without removing supported task types", () => {
    expect(migration).toMatch(/drop constraint if exists tasks_task_type_check/i);
    expect(migration).toMatch(/'generate_plan'::text/i);
    expect(migration).toMatch(/'create_memory_note'::text/i);
    expect(migration).toMatch(/'analyze_url'::text/i);
    expect(migration).toMatch(/existing tasks and their history\/results are preserved/i);
  });
});
