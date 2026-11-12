/**
 * qrcode.react ships without type declarations, so every import of it is
 * implicitly `any` (the repo reported TS7016 for this package before Batch 3B).
 *
 * A shorthand ambient declaration is used deliberately: it silences the missing
 * types without inventing a prop shape for a library we only pass values to.
 * If the package adds its own types later, this file can be deleted.
 */
declare module 'qrcode.react';
