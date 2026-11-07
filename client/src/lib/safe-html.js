/* safe-html.js — R70. Every place that renders HTML from data (blog bodies,
   admin previews, banner titles, generated SVG) goes through sanitizeHtml().
   The CSP already blocks inline scripts; this removes script-capable markup
   before it reaches the DOM, so a compromised editor account cannot store a
   payload that runs for readers. */
import DOMPurify from "dompurify";

const FORBID_TAGS = ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "meta", "link", "base"];
const FORBID_ATTR = ["style", "srcdoc", "formaction"];

export function sanitizeHtml(html, { svg = false } = {}) {
  const input = String(html ?? "");
  if (!input) return "";
  return DOMPurify.sanitize(input, {
    USE_PROFILES: svg ? { svg: true, svgFilters: true } : { html: true },
    FORBID_TAGS,
    FORBID_ATTR,
    ADD_ATTR: ["target"],
  });
}
