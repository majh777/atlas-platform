/**
 * Security sanitization utilities
 * 
 * Provides XSS prevention, input validation, and safe string handling.
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Use this when displaying user-provided content in HTML context.
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strips HTML tags from input string.
 * Use for plaintext extraction from potentially malicious HTML.
 */
export function stripHtmlTags(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes a string for safe storage and display.
 * Removes dangerous HTML/JS patterns while preserving content.
 */
export function sanitizeForStorage(input: string): string {
  // Remove script tags and event handlers
  const result = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '[JS_REMOVED]:');
  
  return result;
}

/**
 * Sanitizes a filename to prevent path traversal attacks.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, '')
    .replace(/[/\\]/g, '_')
    .replace(/^[.\s]+/, '')
    .replace(/[.\s]+$/, '');
}

/**
 * Validates and sanitizes a URL to prevent injection.
 */
export function sanitizeUrl(url: string): string {
  // Block javascript: and data: URLs
  if (/^(javascript|data|vbscript):/i.test(url.trim())) {
    return '';
  }
  return url;
}

/**
 * Truncates string to maximum length to prevent resource exhaustion.
 */
export function truncate(input: string, maxLength: number): string {
  if (input.length <= maxLength) return input;
  return input.slice(0, maxLength) + '...';
}

/**
 * Validates that a string contains only safe characters for identifiers.
 */
export function isSafeIdentifier(input: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(input);
}

/**
 * Removes null bytes and other control characters.
 */
export function removeControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
