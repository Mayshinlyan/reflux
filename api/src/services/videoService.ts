/** Finds a YouTube video of a dish, or says there is none. The relay holds the key; the phone never sees it. */
export type VideoService = {
  /** A YouTube video id, or null when none was found (or the look-up failed). Never throws. */
  find(title: string): Promise<string | null>;
};

const SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const TIMEOUT_MS = 5_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 500;

type Options = {
  apiKey: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Told when a look-up fails, with no key or title in it. */
  onFailure?: (reason: string) => void;
};

/** Lowercase and one space between words, so "Kimchi  egg fried rice" and "kimchi egg fried rice" share an answer. */
function cacheKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Looks up "<title> recipe" with the YouTube Data API (embeddable, strict safe search, three results, the first one
 * wins) and keeps each answer for a day, misses included, because a search costs 100 of the 10,000 daily quota units.
 * A failed look-up is not kept, so the next try can succeed.
 */
export function createYoutubeVideoService({
  apiKey,
  fetchImpl = fetch,
  now = Date.now,
  onFailure,
}: Options): VideoService {
  const cache = new Map<string, { id: string | null; at: number }>();

  /** The id, null for "no video", or undefined when the look-up itself failed. */
  async function search(title: string): Promise<string | null | undefined> {
    const url = new URL(SEARCH_URL);
    url.search = new URLSearchParams({
      part: 'id',
      type: 'video',
      videoEmbeddable: 'true',
      safeSearch: 'strict',
      maxResults: '3',
      q: `${title} recipe`,
      key: apiKey,
    }).toString();
    try {
      const res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) {
        onFailure?.(`status ${res.status}`);
        return undefined;
      }
      const body = (await res.json()) as { items?: { id?: { videoId?: unknown } }[] };
      const ids = (body.items ?? []).map((item) => item.id?.videoId);
      const found = ids.find((id): id is string => typeof id === 'string' && /^[\w-]{11}$/.test(id));
      return found ?? null;
    } catch {
      onFailure?.('request failed');
      return undefined;
    }
  }

  return {
    async find(title) {
      const key = cacheKey(title);
      const hit = cache.get(key);
      if (hit && now() - hit.at < CACHE_TTL_MS) return hit.id;
      const id = await search(title);
      if (id === undefined) return null;
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { id, at: now() });
      return id;
    },
  };
}

/** Used when no key is set: every dish simply has no video. */
export function createUnavailableVideoService(): VideoService {
  return { find: async () => null };
}
