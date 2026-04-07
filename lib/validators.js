// Input validation & sanitization helpers
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^[+]?[\d\s\-()]{7,20}$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

function sanitizeStr(v, max = 500) {
  if (v === null || v === undefined) return '';
  return String(v).trim().slice(0, max).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

function isEmail(v) {
  return typeof v === 'string' && EMAIL_RE.test(v.trim()) && v.length <= 254;
}

function isPhone(v) {
  return !v || (typeof v === 'string' && PHONE_RE.test(v.trim()));
}

function isUrl(v) {
  return !v || (typeof v === 'string' && URL_RE.test(v.trim()));
}

function validate(schema, data) {
  const errors = [];
  const clean = {};
  for (const [field, rules] of Object.entries(schema)) {
    const raw = data[field];
    if (rules.required && (raw === undefined || raw === null || raw === '')) {
      errors.push(`${field} is required`);
      continue;
    }
    if (raw === undefined || raw === null || raw === '') {
      clean[field] = rules.default !== undefined ? rules.default : '';
      continue;
    }
    let val = sanitizeStr(raw, rules.max || 1000);
    if (rules.min && val.length < rules.min) {
      errors.push(`${field} must be at least ${rules.min} characters`);
      continue;
    }
    if (rules.type === 'email' && !isEmail(val)) {
      errors.push(`${field} must be a valid email`);
      continue;
    }
    if (rules.type === 'phone' && !isPhone(val)) {
      errors.push(`${field} must be a valid phone number`);
      continue;
    }
    if (rules.type === 'url' && !isUrl(val)) {
      errors.push(`${field} must be a valid URL`);
      continue;
    }
    if (rules.enum && !rules.enum.includes(val)) {
      errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      continue;
    }
    clean[field] = val;
  }
  return { valid: errors.length === 0, errors, data: clean };
}

module.exports = { sanitizeStr, isEmail, isPhone, isUrl, validate };
