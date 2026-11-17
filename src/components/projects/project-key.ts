// A campaign's project key lives only in this browser (localStorage) and is sent with each request.
const k = (slug: string) => `sdd-project-key:${slug}`;

export function getProjectKey(slug: string): string | null {
  try {
    return localStorage.getItem(k(slug));
  } catch {
    return null;
  }
}

export function setProjectKey(slug: string, key: string) {
  try {
    localStorage.setItem(k(slug), key);
  } catch {
    /* storage blocked: the key works for this page only */
  }
}

export function clearProjectKey(slug: string) {
  try {
    localStorage.removeItem(k(slug));
  } catch {
    /* ignore */
  }
}

export function keyHeaders(slug: string): HeadersInit {
  const key = getProjectKey(slug);
  return key ? { "X-SDD-Project-Key": key } : {};
}
