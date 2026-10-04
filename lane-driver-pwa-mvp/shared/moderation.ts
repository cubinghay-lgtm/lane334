/**
 * Automated safety moderation for the Community Road Hazard & Test Tip Board.
 * Shared so the client can give instant feedback and the server can enforce it.
 */

export const POST_LIMITS = {
  title: { min: 4, max: 80 },
  body: { min: 10, max: 500 },
  location: { max: 80 },
} as const;

/** Community reports needed before a post is hidden automatically. */
export const AUTO_HIDE_REPORT_THRESHOLD = 3;

// Prefix matches catch variants ("shitty"); words that start real terms
// (Dickson St, fire retardant) only match exact forms.
const BLOCKED_WORDS = [
  /\b(fuck|shit|bitch|asshole|bastard|cunt|slut|whore)\w*/i,
  /\b(dick|dicks|dickhead|retard|retards|retarded|fag|fags|faggot)\b/i,
];

const UNSAFE_PHRASES = [
  /\b(posting|texting|typing|filming)\s+(this\s+)?while\s+driving\b/i,
  /\bstreet\s*rac(e|ing)\b/i,
  /\b(drift|donuts?)\s+(spot|meet)/i,
  /\bhow\s+to\s+(beat|avoid|dodge)\s+(the\s+)?(cops?|police|chp|tickets?)\b/i,
];

const PII_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /[\w.+-]+@[\w-]+\.[\w.]+/, reason: "Please remove email addresses — the board is anonymous." },
  { pattern: /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/, reason: "Please remove phone numbers — the board is anonymous." },
  { pattern: /\b\d[A-Z]{3}\d{3}\b/, reason: "Please don't post license plates." },
];

const LINK_PATTERN = /(https?:\/\/|www\.)\S+/i;

export type ModerationResult = { ok: true } | { ok: false; reason: string };

export function moderatePost(post: { title: string; body: string; location?: string }): ModerationResult {
  const title = post.title.trim();
  const body = post.body.trim();
  const location = (post.location ?? "").trim();

  if (title.length < POST_LIMITS.title.min) return { ok: false, reason: "Add a short title so others know what to watch for." };
  if (title.length > POST_LIMITS.title.max) return { ok: false, reason: `Keep the title under ${POST_LIMITS.title.max} characters.` };
  if (body.length < POST_LIMITS.body.min) return { ok: false, reason: "Add a little more detail about the hazard or tip." };
  if (body.length > POST_LIMITS.body.max) return { ok: false, reason: `Keep posts under ${POST_LIMITS.body.max} characters.` };
  if (location.length > POST_LIMITS.location.max) return { ok: false, reason: "Shorten the location to a street or landmark." };

  const text = `${title}\n${body}\n${location}`;

  if (BLOCKED_WORDS.some((pattern) => pattern.test(text))) {
    return { ok: false, reason: "Let's keep the board respectful — please rephrase without that language." };
  }
  if (LINK_PATTERN.test(text)) return { ok: false, reason: "Links aren't allowed on the board." };
  for (const { pattern, reason } of PII_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason };
  }
  if (UNSAFE_PHRASES.some((pattern) => pattern.test(text))) {
    return { ok: false, reason: "Posts can't promote unsafe or distracted driving." };
  }

  return { ok: true };
}

/** Anonymous, stable display handle — never derived from a real name. */
export function anonymousHandle(learnerId: string): string {
  const hex = learnerId.replace(/[^a-f0-9]/gi, "").slice(-4).toUpperCase().padStart(4, "0");
  return `Driver ${hex}`;
}
