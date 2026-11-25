import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/csp-report
 *
 * Where the browser sends Content-Security-Policy violations while the policy is
 * in Report-Only mode. Nothing is stored and nothing is blocked: the point is to
 * find the origins the policy is still missing, from real traffic.
 *
 * What is logged: the directive that fired, the blocked URL (trimmed, no query
 * string, because a query can carry an order reference or a token), and the
 * document path. What is never logged: cookies, headers, request bodies.
 *
 * Always answers 204. A report endpoint that returns errors makes browsers retry
 * and fills the logs with noise about the noise.
 */

/** Modern browsers send an array of `application/csp-report`-style entries. */
interface CspReportBody {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'blocked-uri'?: string;
    'source-file'?: string;
    'line-number'?: number;
  };
  // Reporting API shape (report-to).
  body?: {
    documentURL?: string;
    effectiveDirective?: string;
    blockedURL?: string;
    sourceFile?: string;
  };
}

/** Drops the query and the fragment: they can carry references and tokens. */
function safeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    // Not a URL (browsers use bare words like "inline" or "eval").
    return value.slice(0, 120);
  }
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const raw = await request.text();
    // A report is a few hundred bytes. Anything large is not a browser report.
    if (raw.length > 20_000) {
      console.warn(`[csp-report] ${requestId} ignored: report too large`);
      return new NextResponse(null, { status: 204 });
    }

    const parsed: CspReportBody = JSON.parse(raw);
    const legacy = parsed['csp-report'];
    const modern = parsed.body;

    const directive = legacy?.['effective-directive'] ?? legacy?.['violated-directive'] ?? modern?.effectiveDirective;
    const blocked = safeUrl(legacy?.['blocked-uri'] ?? modern?.blockedURL);
    const documentPath = safeUrl(legacy?.['document-uri'] ?? modern?.documentURL);
    const source = safeUrl(legacy?.['source-file'] ?? modern?.sourceFile);

    console.warn(
      `[csp-report] ${requestId} directive=${directive ?? 'unknown'} blocked=${blocked ?? 'unknown'} document=${documentPath ?? 'unknown'} source=${source ?? 'unknown'}`,
    );
  } catch (error) {
    // A malformed report is not worth a 400: the browser cannot act on it.
    console.warn(
      `[csp-report] ${requestId} unreadable report: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  return new NextResponse(null, { status: 204 });
}

/** Reports are POSTed; a GET is almost always a health check. */
export async function GET() {
  return NextResponse.json({ ok: true });
}
