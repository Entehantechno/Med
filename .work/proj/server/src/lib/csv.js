/* Minimal CSV parse/stringify (RFC-4180-ish) — no dependencies. */

export function toCSV(rows, columns) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return "\uFEFF" + header + "\n" + body; // BOM for Excel/Persian
}

export function parseCSV(text) {
  // strip BOM
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQ) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') inQ = false;
      else field += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\r") { /* ignore */ }
      else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((c) => c && c.trim() !== ""))
    .map((r) => {
      const obj = {};
      header.forEach((h, i) => (obj[h] = (r[i] ?? "").trim()));
      return obj;
    });
}

/* Build a Content-Disposition-safe filename. HTTP header values must be
   ASCII without quotes/CR/LF: a query value such as `type=abc"` or a Persian
   template key used to crash the export with "Invalid character in header
   content" (500). Everything outside [A-Za-z0-9._-] becomes "_". */
export function safeFilename(name, fallback = "export") {
  const s = String(name == null ? "" : name).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^[._-]+|[._-]+$/g, "").slice(0, 80);
  return s || fallback;
}

// Split logical CSV records, not physical lines. Keep original quoting so the
// import response can return lossless failed records for correction/retry.
export function splitCSVRecords(value) {
  const text = String(value ?? "").replace(/^\uFEFF/, "");
  const records = []; let start = 0, quoted = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && (text[i] === '\n' || text[i] === '\r')) {
      records.push(text.slice(start, i));
      if (text[i] === '\r' && text[i + 1] === '\n') i++;
      start = i + 1;
    }
  }
  if (quoted) throw new Error("unterminated_csv_quote");
  records.push(text.slice(start));
  return records.map(r => r.trimEnd()).filter(r => r.trim() !== "");
}
