/**
 * Calls to the backend API (T-C1, Requirements 3.6.1). Failures throw an
 * Error with the API's message ("The decklist has 300 cards; the limit is
 * 250", rate limits, ...).
 */

async function request(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(body?.message ?? `The server answered ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

/** Preview data for one decklist line (D27). */
export const previewLine = (line, signal) =>
  request(`/api/cards?line=${encodeURIComponent(line)}`, { signal });

/** Starts a job; returns its status. */
export const createJob = (decklist, format) =>
  request('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decklist, format }),
  });

export const jobStatus = (id) => request(`/api/jobs/${id}`);
