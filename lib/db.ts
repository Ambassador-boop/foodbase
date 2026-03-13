import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

// Initialize Neon client - uses tagged template literals
const sql = neon(process.env.DATABASE_URL!, { fullResults: false });

// Export the sql client directly
export { sql };
export const db = sql;

export type Database = typeof sql;

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

// Transaction wrapper
export async function transaction<T>(
  callback: (client: typeof sql) => Promise<T>
): Promise<T> {
  return callback(sql);
}
