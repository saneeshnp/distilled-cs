// Share Encoder — pack/unpack assessment payloads for shareable report links.
//
// The payload is a small JSON object base64url-encoded into a single URL param.
// Schema (kept terse to minimize URL length):
//   { v: <assessment_version>, c?: <companyName>, p?: <profile>, r?: <responses>, t?: <iso8601 timestamp> }
//
// Versioning strategy: ID-keyed encoding plus a version field. Renaming or
// removing a question silently drops that answer on decode; adding a question
// leaves it unanswered. A version mismatch is surfaced to the UI so the viewer
// can show a "generated against an earlier assessment" notice.
//
// Pure module: no DOM, no localStorage, safe for Node-based tests.

function utf8ToBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(input) {
  const padLen = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Encode an assessment payload to a URL-safe string.
// `version` should be the current `meta.assessment_version` from the JSON data.
// `timestamp` is an ISO 8601 string identifying when the underlying assessment
// was taken; surfaced in the shared report footer so a stale link doesn't look
// current.
export function encodeReport({ version, companyName, profile, responses, timestamp }) {
  if (typeof version !== 'number') {
    throw new Error('encodeReport: version is required and must be a number');
  }
  const payload = { v: version };
  if (typeof companyName === 'string' && companyName.trim()) {
    payload.c = companyName.trim();
  }
  if (profile && typeof profile === 'object') {
    const p = {};
    for (const [k, v] of Object.entries(profile)) {
      if (k === 'company_name') continue;
      if (typeof v === 'string' && v) p[k] = v;
    }
    if (Object.keys(p).length) payload.p = p;
  }
  if (responses && typeof responses === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(responses)) {
      if (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4) {
        r[k] = v;
      }
    }
    if (Object.keys(r).length) payload.r = r;
  }
  if (typeof timestamp === 'string' && timestamp) {
    payload.t = timestamp;
  }
  return utf8ToBase64Url(JSON.stringify(payload));
}

// Decode a URL payload back into a sanitized object.
// Returns null if the input is malformed or missing required fields.
// - Unknown response IDs are kept (caller filters against current schema)
// - Non-integer / out-of-range response values are dropped silently
// - Non-string profile values are dropped silently
export function decodeReport(encoded) {
  if (typeof encoded !== 'string' || !encoded) return null;

  let parsed;
  try {
    parsed = JSON.parse(base64UrlToUtf8(encoded));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  if (typeof parsed.v !== 'number' || !Number.isFinite(parsed.v)) return null;

  const responses = {};
  if (parsed.r && typeof parsed.r === 'object' && !Array.isArray(parsed.r)) {
    for (const [id, val] of Object.entries(parsed.r)) {
      if (typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 4) {
        responses[id] = val;
      }
    }
  }

  const profile = {};
  if (parsed.p && typeof parsed.p === 'object' && !Array.isArray(parsed.p)) {
    for (const [k, v] of Object.entries(parsed.p)) {
      if (typeof v === 'string' && v) profile[k] = v;
    }
  }

  const companyName = typeof parsed.c === 'string' ? parsed.c : '';
  const timestamp = typeof parsed.t === 'string' ? parsed.t : '';

  return { version: parsed.v, companyName, profile, responses, timestamp };
}

// Filter a responses map to only IDs present in the current schema.
// Useful when an older shared link carries answers for questions that have
// since been removed or renamed.
export function filterResponsesToKnownIds(responses, knownIds) {
  if (!responses || typeof responses !== 'object') return {};
  const set = new Set(knownIds);
  const result = {};
  for (const [id, val] of Object.entries(responses)) {
    if (set.has(id)) result[id] = val;
  }
  return result;
}
