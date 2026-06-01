/**
 * Thin HTTP wrapper around the Appfigures REST API (v2).
 * Auth: Personal Access Token passed as `Authorization: Bearer <PAT>`.
 * Docs: https://docs.appfigures.com/api/reference/v2/
 */

const BASE_URL = "https://api.appfigures.com/v2";

export class AppfiguresError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "AppfiguresError";
  }
}

/** Read and validate the PAT from the environment. Throws if missing. */
function getToken(): string {
  const token = process.env.APPFIGURES_PAT?.trim();
  if (!token) {
    throw new AppfiguresError(
      "APPFIGURES_PAT is not set. Create a Personal Access Token at " +
        "https://appfigures.com/developers/keys and set it in the environment.",
    );
  }
  return token;
}

export type QueryValue = string | number | boolean | undefined | null;
export type Query = Record<string, QueryValue>;

/** Build a querystring, skipping undefined/null/empty values. */
function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/**
 * Perform a GET request against the Appfigures API and return parsed JSON.
 * `path` must start with `/` (e.g. "/reports/sales").
 */
export async function afRequest<T = unknown>(
  path: string,
  query?: Query,
): Promise<T> {
  const token = getToken();
  const url = `${BASE_URL}${path}${buildQuery(query)}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    throw new AppfiguresError(
      `Network error calling Appfigures: ${(err as Error).message}`,
    );
  }

  const text = await res.text();

  if (!res.ok) {
    throw new AppfiguresError(
      `Appfigures API returned ${res.status} ${res.statusText} for ${path}`,
      res.status,
      text.slice(0, 2000),
    );
  }

  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AppfiguresError(
      `Failed to parse Appfigures response as JSON for ${path}`,
      res.status,
      text.slice(0, 2000),
    );
  }
}
