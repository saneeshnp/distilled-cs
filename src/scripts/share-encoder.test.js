// Manual test harness for share-encoder.js
// Run: node src/scripts/share-encoder.test.js

import {
  encodeReport,
  decodeReport,
  filterResponsesToKnownIds,
} from './share-encoder.js';

let passed = 0;
let failed = 0;

function assert(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Fixtures ────────────────────────────────────────────────────────────────

const fullProfile = {
  customer_segment: 'seg_midmarket',
  company_arr: 'arr_5m_20m',
  cs_team_size: 'size_4_10',
  industry_vertical: 'ind_b2b_saas',
  product_complexity: 'complexity_moderate',
  cs_team_age: 'age_1_3y',
  cs_ops_exists: 'ops_partial',
};

const fullResponses = {
  sc_q1: 2, sc_q2: 3, sc_q3: 2,
  jl_q1: 2, jl_q2: 2, jl_q3: 3,
  hr_q1: 3, hr_q2: 2, hr_q3: 2,
  md_q1: 1, md_q2: 2, md_q3: 2,
  ev_q1: 2, ev_q2: 3, ev_q3: 2,
  os_q1: 3, os_q2: 2, os_q3: 3,
  ca_q1: 2, ca_q2: 2, ca_q3: 3,
  ai_q1: 1, ai_q2: 2, ai_q3: 1,
};

// ── Round-trip ──────────────────────────────────────────────────────────────

console.log('Round-trip:');
{
  const encoded = encodeReport({
    version: 1,
    companyName: 'Acme Corp',
    profile: fullProfile,
    responses: fullResponses,
  });
  assert('returns a non-empty string', typeof encoded === 'string' && encoded.length > 0);
  assert(
    'is URL-safe (no +, /, =)',
    !/[+/=]/.test(encoded),
    `encoded=${encoded}`,
  );

  const decoded = decodeReport(encoded);
  assert('decode returns an object', decoded && typeof decoded === 'object');
  assert('version round-trips', decoded.version === 1);
  assert('companyName round-trips', decoded.companyName === 'Acme Corp');
  assert('profile round-trips', deepEqual(decoded.profile, fullProfile));
  assert('responses round-trip', deepEqual(decoded.responses, fullResponses));

  console.log(`  ℹ payload length: ${encoded.length} chars`);
}

// ── Empty / minimal payload ─────────────────────────────────────────────────

console.log('\nMinimal payload (version only):');
{
  const encoded = encodeReport({ version: 1 });
  const decoded = decodeReport(encoded);
  assert('version present', decoded.version === 1);
  assert('empty companyName', decoded.companyName === '');
  assert('empty profile', deepEqual(decoded.profile, {}));
  assert('empty responses', deepEqual(decoded.responses, {}));
}

// ── Optional fields omitted ─────────────────────────────────────────────────

console.log('\nOptional fields:');
{
  const encoded = encodeReport({
    version: 1,
    companyName: '',
    profile: { customer_segment: 'seg_smb' },
    responses: { sc_q1: 3 },
  });
  const decoded = decodeReport(encoded);
  assert('blank companyName decodes as empty', decoded.companyName === '');
  assert('profile retained', decoded.profile.customer_segment === 'seg_smb');
  assert('response retained', decoded.responses.sc_q1 === 3);
}

console.log('\ncompany_name in profile is stripped on encode:');
{
  const encoded = encodeReport({
    version: 1,
    profile: { ...fullProfile, company_name: 'Should not leak' },
    responses: fullResponses,
  });
  const decoded = decodeReport(encoded);
  assert('company_name absent from decoded profile', !('company_name' in decoded.profile));
}

// ── Malformed input ─────────────────────────────────────────────────────────

console.log('\nMalformed input:');
assert('null → null', decodeReport(null) === null);
assert('undefined → null', decodeReport(undefined) === null);
assert('empty string → null', decodeReport('') === null);
assert('non-string → null', decodeReport(42) === null);
assert('garbage base64 → null', decodeReport('!!!not-valid-base64!!!') === null);
assert('non-JSON payload → null', decodeReport(btoa('not json')) === null);
assert('JSON array → null', decodeReport(btoa('[1,2,3]').replace(/=+$/, '')) === null);
assert('object without v → null', decodeReport(btoa('{"r":{}}').replace(/=+$/, '')) === null);

// ── Sanitization on decode ──────────────────────────────────────────────────

console.log('\nDecode sanitization:');
{
  const dirty = {
    v: 1,
    c: 'Acme',
    p: { customer_segment: 'seg_smb', bogus_obj: { nope: 1 }, bogus_num: 42 },
    r: { sc_q1: 3, sc_q2: 'bad', sc_q3: 5, sc_q4: 0, sc_q5: 2.5, sc_q6: 4 },
  };
  const encoded = btoa(JSON.stringify(dirty)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decoded = decodeReport(encoded);
  assert('only string profile values kept', deepEqual(decoded.profile, { customer_segment: 'seg_smb' }));
  assert('out-of-range / non-int responses dropped', deepEqual(decoded.responses, { sc_q1: 3, sc_q6: 4 }));
}

// ── Timestamp ───────────────────────────────────────────────────────────────

console.log('\nTimestamp:');
{
  const iso = '2026-05-15T12:30:00.000Z';
  const encoded = encodeReport({ version: 1, timestamp: iso });
  const decoded = decodeReport(encoded);
  assert('timestamp round-trips', decoded.timestamp === iso);
}
{
  const encoded = encodeReport({ version: 1 });
  const decoded = decodeReport(encoded);
  assert('omitted timestamp decodes as empty string', decoded.timestamp === '');
}

// ── Unicode / special characters ────────────────────────────────────────────

console.log('\nUnicode in company name:');
{
  const encoded = encodeReport({ version: 1, companyName: 'Café Müller 株式会社' });
  const decoded = decodeReport(encoded);
  assert('unicode round-trips', decoded.companyName === 'Café Müller 株式会社');
}

// ── encodeReport input validation ───────────────────────────────────────────

console.log('\nencodeReport validation:');
{
  let threw = false;
  try { encodeReport({}); } catch { threw = true; }
  assert('throws when version missing', threw);

  threw = false;
  try { encodeReport({ version: '1' }); } catch { threw = true; }
  assert('throws when version is not a number', threw);
}

// ── filterResponsesToKnownIds ───────────────────────────────────────────────

console.log('\nfilterResponsesToKnownIds:');
{
  const filtered = filterResponsesToKnownIds(
    { sc_q1: 3, removed_q1: 2, sc_q2: 4 },
    ['sc_q1', 'sc_q2', 'sc_q3'],
  );
  assert('drops unknown IDs', deepEqual(filtered, { sc_q1: 3, sc_q2: 4 }));
  assert('empty input → empty', deepEqual(filterResponsesToKnownIds(null, ['a']), {}));
}

// ── Version mismatch surfacing ──────────────────────────────────────────────

console.log('\nVersion mismatch:');
{
  const encoded = encodeReport({ version: 1, responses: fullResponses });
  const decoded = decodeReport(encoded);
  const currentVersion = 2;
  assert('decoded version differs from current', decoded.version !== currentVersion);
  assert('caller can detect mismatch', decoded.version < currentVersion);
}

// ── Size sanity ─────────────────────────────────────────────────────────────

console.log('\nSize sanity (full report):');
{
  const encoded = encodeReport({
    version: 1,
    companyName: 'Acme Corp',
    profile: fullProfile,
    responses: fullResponses,
  });
  assert(
    `under 1000 chars (got ${encoded.length})`,
    encoded.length < 1000,
  );
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
