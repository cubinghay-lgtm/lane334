/**
 * Anonymous learner identity: a random UUID kept on this device. Lane never
 * asks for a name, email, or school. Clearing it starts a fresh profile.
 */
const LEARNER_KEY = "lane.learnerId";
const CONSENT_KEY = "lane.consent.v1";

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

let memoryId: string | null = null;

export function getLearnerId(): string {
  const store = storage();
  const existing = store?.getItem(LEARNER_KEY) ?? memoryId;
  if (existing) return existing;
  const id = crypto.randomUUID();
  memoryId = id;
  store?.setItem(LEARNER_KEY, id);
  return id;
}

export function resetLearnerId() {
  storage()?.removeItem(LEARNER_KEY);
  memoryId = null;
}

export function hasAcceptedTerms(): boolean {
  return storage()?.getItem(CONSENT_KEY) === "accepted";
}

export function acceptTerms() {
  storage()?.setItem(CONSENT_KEY, "accepted");
}
