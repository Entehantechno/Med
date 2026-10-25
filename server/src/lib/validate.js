/* ================================================================
   validate.js — tiny dependency-free request-body validation.

   Why not Zod/Joi: the offline-friendly build host must npm-install
   with zero postinstall steps, so the app keeps a hand-rolled,
   auditable validator that still follows the OWASP guidance used by
   those libraries:

     • explicit type/shape per endpoint (allow-list),
     • strict rejection of UNKNOWN keys by default (mass-assignment),
     • length/range/enum checks up front,
     • coercion only for the primitive you asked for,
     • one validation error response shape everywhere.

   Usage:
     import { validateBody, s } from "../lib/validate.js";
     router.post("/x", validateBody({ id: s.int({ min: 1 }), name: s.str({ max: 120 }) }), h);
   ================================================================ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fail(errors) { return { ok: false, value: null, errors }; }

export const s = {
  str: (o = {}) => (raw, path) => {
    if (raw == null) {
      if (o.optional) return { ok: true, value: undefined };
      return { ok: false, error: `${path} required` };
    }
    if (typeof raw !== "string") return { ok: false, error: `${path} must be a string` };
    let v2 = raw;
    if (o.trim !== false) v2 = v2.trim();
    const min = o.min ?? 0, max = o.max ?? 5000;
    if (v2.length < min) return { ok: false, error: `${path} too short` };
    if (v2.length > max) return { ok: false, error: `${path} too long` };
    if (o.pattern && !o.pattern.test(v2)) return { ok: false, error: `${path} bad format` };
    if (o.email && !EMAIL_RE.test(v2)) return { ok: false, error: `${path} bad email` };
    if (o.oneOf && !o.oneOf.includes(v2)) return { ok: false, error: `${path} not allowed` };
    return { ok: true, value: v2 };
  },
  num: (o = {}) => (raw, path) => {
    if (raw == null) { if (o.optional) return { ok: true, value: undefined }; return { ok: false, error: `${path} required` }; }
    let n = Number(raw);
    if (!Number.isFinite(n)) return { ok: false, error: `${path} must be a number` };
    // clamp:true reproduces a legacy route contract where out-of-range client
    // numbers are pulled back into range (e.g. anti-cheat score clamping).
    if (o.clamp) {
      if (o.min != null && n < o.min) n = o.min;
      if (o.max != null && n > o.max) n = o.max;
    } else {
      if (o.min != null && n < o.min) return { ok: false, error: `${path} below minimum` };
      if (o.max != null && n > o.max) return { ok: false, error: `${path} above maximum` };
    }
    if (o.integer && !Number.isInteger(n)) {
      if (o.clamp) n = Math.trunc(n);
      else return { ok: false, error: `${path} must be an integer` };
    }
    return { ok: true, value: n };
  },
  int: (o = {}) => s.num({ ...o, integer: true }),
  bool: (o = {}) => (raw, path) => {
    if (raw == null) { if (o.optional) return { ok: true, value: undefined }; return { ok: false, error: `${path} required` }; }
    if (typeof raw === "boolean") return { ok: true, value: raw };
    if (o.coerce && (raw === "true" || raw === "false")) return { ok: true, value: raw === "true" };
    return { ok: false, error: `${path} must be a boolean` };
  },
  oneOf: (values, o = {}) => s.str({ ...o, oneOf: values }),
  array: (inner, o = {}) => (raw, path) => {
    if (raw == null) { if (o.optional) return { ok: true, value: undefined }; return { ok: false, error: `${path} required` }; }
    if (!Array.isArray(raw)) return { ok: false, error: `${path} must be an array` };
    const max = o.max ?? 500;
    if (raw.length > max) return { ok: false, error: `${path} too long` };
    if (o.min != null && raw.length < o.min) return { ok: false, error: `${path} too short` };
    const out = [];
    for (let i = 0; i < raw.length; i++) {
      const r = inner(raw[i], `${path}[${i}]`);
      if (!r.ok) return { ok: false, error: r.error };
      out.push(r.value);
    }
    return { ok: true, value: out };
  },
  object: (shape, o = {}) => validateShape(shape, o),
  any: (o = {}) => (raw, path) => {
    if (raw == null) { if (o.optional) return { ok: true, value: undefined }; return { ok: false, error: `${path} required` }; }
    return { ok: true, value: raw };
  },
};

function validateShape(shape, o = {}) {
  const keys = Object.keys(shape);
  return (raw, path = "body") => {
    if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return fail([`${path} must be an object`]);
    const out = {};
    const errors = [];
    for (const k of keys) {
      const r = shape[k](raw[k], `${path}.${k}`);
      if (!r.ok) errors.push(r.error);
      else if (r.value !== undefined) out[k] = r.value;
    }
    // strict mode: mass-assignment / prototype-pollution guard
    if (o.allowUnknown !== true) {
      for (const k of Object.keys(raw)) {
        if (!(k in shape)) errors.push(`${path}.${k} is not allowed`);
        if (k === "__proto__" || k === "constructor" || k === "prototype") {
          return fail(["forbidden key"]);
        }
      }
    }
    if (errors.length) return fail(errors);
    return { ok: true, value: out, errors: [] };
  };
}

export function validate(schema, body, o = {}) {
  const fn = typeof schema === "function" ? schema : validateShape(schema, o);
  return fn(body, "body");
}

/* Express middleware factory. On failure returns 400 with a generic
   message (field paths are echoed, never values). */
export function validateBody(schema, o = {}) {
  const fn = typeof schema === "function" ? schema : validateShape(schema, o);
  return (req, res, next) => {
    const r = fn(req.body || {}, "body");
    if (!r.ok) return res.status(400).json({ error: "validation_failed", fields: r.errors.slice(0, 12) });
    req.body = r.value;
    next();
  };
}
