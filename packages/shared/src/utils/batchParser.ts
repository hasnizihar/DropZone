/**
 * Robust URL Batch Parser for DROPZONE.
 * Extracts, cleans, deduplicates, and bounds URLs from multi-line or pasted text.
 */

export interface BatchParseResult {
  urls: string[];
  excessCount: number;
  totalFound: number;
  invalidCount: number;
  warning?: string;
}

const DEFAULT_MAX_BATCH_SIZE = 50;

/**
 * Strips common trailing punctuation from URLs found in free text (e.g. "Visit https://example.com/file.zip.")
 */
function cleanUrlCandidate(raw: string): string {
  let cleaned = raw.trim();
  // Strip enclosing quotes, brackets, or trailing sentence punctuation
  cleaned = cleaned.replace(/^["'(<[]+/, '');
  cleaned = cleaned.replace(/[)"'>\].,;:!?]+$/, '');
  return cleaned;
}

/**
 * Validates whether a candidate string is a well-formed HTTP/HTTPS URL.
 */
function isValidHttpUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Parses arbitrary text (newlines, spaces, commas, or embedded prose) into a deduplicated list of HTTP/HTTPS URLs.
 * Bounded by maxLimit (defaults to 50). Preserves insertion order.
 */
export function parseBatchUrls(
  input: string,
  maxLimit: number = DEFAULT_MAX_BATCH_SIZE
): BatchParseResult {
  if (!input || typeof input !== 'string') {
    return {
      urls: [],
      excessCount: 0,
      totalFound: 0,
      invalidCount: 0,
    };
  }

  // Regex to extract potential http/https URL tokens
  const urlRegex = /https?:\/\/[^\s,;"'<>`]+/gi;
  const candidates: string[] = [];

  // Match all potential URLs
  const matches = input.match(urlRegex) || [];
  let invalidCount = 0;

  for (const match of matches) {
    const cleaned = cleanUrlCandidate(match);
    if (isValidHttpUrl(cleaned)) {
      candidates.push(cleaned);
    } else {
      invalidCount++;
    }
  }

  // Also check if lines contain bare URLs without regex issues
  const lines = input.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = cleanUrlCandidate(line.trim());
    if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !candidates.includes(trimmed)) {
      if (isValidHttpUrl(trimmed)) {
        candidates.push(trimmed);
      }
    }
  }

  // Deduplicate while preserving first appearance order
  const uniqueUrls: string[] = [];
  const seen = new Set<string>();

  for (const u of candidates) {
    // Normalize URL string (lowercasing host, standardizing trailing slash for root)
    try {
      const parsed = new URL(u);
      const normalized = parsed.href;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        uniqueUrls.push(normalized);
      }
    } catch {
      if (!seen.has(u)) {
        seen.add(u);
        uniqueUrls.push(u);
      }
    }
  }

  const totalFound = uniqueUrls.length;
  const excessCount = Math.max(0, totalFound - maxLimit);
  const boundedUrls = uniqueUrls.slice(0, maxLimit);

  let warning: string | undefined;
  if (excessCount > 0) {
    warning = `Batch limit reached: only the first ${maxLimit} URLs will be processed. ${excessCount} excess URLs were omitted.`;
  }

  return {
    urls: boundedUrls,
    excessCount,
    totalFound,
    invalidCount,
    warning,
  };
}
