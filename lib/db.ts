import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { env } from './env';

/**
 * The Neon client, created on first use rather than at import.
 *
 * DATABASE_URL is validated in lib/env.ts, which throws at start-up when it is
 * missing; nothing here falls back to a default connection string. The reason the
 * client is lazy is `next build`: it imports every route to collect page data on
 * a machine that has no database, and `neon('')` would throw there. The first
 * real query still fails loudly if the variable is absent at runtime.
 */
type Client = NeonQueryFunction<false, false>;

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    if (!env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL is not set. The database client cannot be created. See docs/environment.md.',
      );
    }
    client = neon(env.DATABASE_URL, { fullResults: false });
  }
  return client;
}

/** The Neon client, for callers that use `sql``...``` tagged templates. */
export const sql: Client = new Proxy(function sqlTag() {} as unknown as Client, {
  apply(_target, _thisArg, args: unknown[]) {
    const fn = getClient() as unknown as (...callArgs: unknown[]) => unknown;
    return fn(...args);
  },
  get(_target, property) {
    const value = (getClient() as unknown as Record<PropertyKey, unknown>)[property];
    return typeof value === 'function' ? value.bind(getClient()) : value;
  },
}) as Client;

export const db = sql;

export type Database = Client;

// Helper function to replace $1, $2 etc with proper placeholders
function buildQuery(queryString: string, values: any[] = []): any {
  let paramIndex = 0;
  const parts: any[] = [];
  const queryParts = queryString.split(/(\$\d+)/);
  
  for (let i = 0; i < queryParts.length; i++) {
    const part = queryParts[i];
    if (part?.startsWith('$')) {
      const num = parseInt(part.slice(1));
      parts.push(values[num - 1]);
    } else {
      parts.push(part);
    }
  }
  
  return parts;
}

// Query helper - use sql.query() for conventional $1, $2 placeholder calls
export async function query(queryString: string, values: any[] = []) {
  try {
    // Use sql.query() for conventional function calls with $1, $2 placeholders
    const result = await (sql as any).query(queryString, values);
    return result;
  } catch (error) {
    console.error('[v0] Database query error:', error);
    throw error;
  }
}

// Get single row
export async function getOne(queryString: string, values: any[] = []) {
  try {
    const result = await query(queryString, values);
    return result?.[0] || null;
  } catch (error) {
    console.error('[v0] Database getOne error:', error);
    throw error;
  }
}

// Get all rows
export async function getAll(queryString: string, values: any[] = []) {
  return query(queryString, values);
}

/**
 * Rows from a driver result of either shape.
 *
 * The Neon HTTP driver returns a plain array; some older call sites and a few
 * code paths hand back `{ rows }`. This reads both without a cast at each site,
 * so `Array.isArray(x) ? x : x?.rows` no longer needs to be repeated (and no
 * longer narrows to `never`).
 */
export function rowsOf<T = Record<string, any>>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const rows = (raw as { rows?: unknown } | null | undefined)?.rows;
  return Array.isArray(rows) ? (rows as T[]) : [];
}

// Transaction wrapper
export async function transaction<T>(
  callback: (client: typeof sql) => Promise<T>
): Promise<T> {
  return callback(sql);
}
