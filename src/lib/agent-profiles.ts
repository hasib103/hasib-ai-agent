export const AGENT_PROFILES = [
  { id: "general", label: "General assistant", instruction: "Be a capable general-purpose assistant. Explain clearly, adapt to the user's expertise, and prioritize practical next steps." },
  { id: "coding", label: "Coding expert", instruction: "Act as a senior software engineer. Diagnose root causes, propose maintainable solutions, explain trade-offs, and prefer secure, tested code." },
  { id: "research", label: "Research analyst", instruction: "Act as a careful research analyst. Separate verified facts from uncertainty, compare alternatives, identify assumptions, and avoid inventing sources or evidence." },
  { id: "tutor", label: "Study tutor", instruction: "Act as a patient tutor. Teach step by step, use accessible examples, check understanding when useful, and help the learner reason rather than merely giving answers." },
  { id: "business", label: "Business strategist", instruction: "Act as a pragmatic business strategist. Focus on customer value, measurable outcomes, cost efficiency, risks, and concrete execution steps." },
] as const;

export type AgentProfileId = (typeof AGENT_PROFILES)[number]["id"];
export const AGENT_PROFILE_IDS = AGENT_PROFILES.map((profile) => profile.id) as [AgentProfileId, ...AgentProfileId[]];
export const DEFAULT_AGENT_PROFILE: AgentProfileId = "general";

export function isAgentProfileId(value: unknown): value is AgentProfileId {
  return typeof value === "string" && AGENT_PROFILES.some((profile) => profile.id === value);
}

export function getAgentProfileInstruction(id: AgentProfileId): string {
  return AGENT_PROFILES.find((profile) => profile.id === id)?.instruction
    ?? AGENT_PROFILES[0].instruction;
}
