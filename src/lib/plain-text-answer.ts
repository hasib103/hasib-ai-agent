/**
 * The chat UI renders assistant content as plain text rather than Markdown.
 * Normalize common Markdown decorations so model formatting markers are not
 * shown literally to users or read aloud by the browser.
 */
export function normalizeAssistantAnswer(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\x60{3}(?:[a-zA-Z0-9_-]+)?[ \t]*\n([\s\S]*?)\x60{3}/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "• ")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/__([\s\S]+?)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    .replace(/~~([\s\S]+?)~~/g, "$1")
    .replace(/\x60([^\x60\n]+)\x60/g, "$1")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
