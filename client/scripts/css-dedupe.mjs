/* css-dedupe.mjs — build-time removal of overridden CSS declarations.

   Several stylesheets (styles.css, design-refresh.css, …) restate the same
   selector and property again later in the cascade. A declaration is dead when a
   LATER rule with the IDENTICAL selector, inside the same at-rule context, sets the
   same property with the same or stronger importance: that later declaration always
   wins for every element the selector matches, so the earlier one can never apply.

   Two cases are kept on purpose:
   - a later value that older browsers cannot parse (color-mix, oklch, env(), …),
     because then the earlier value is the progressive fallback that still applies;
   - anything inside @keyframes.

   Source files are not edited; this runs over the emitted CSS in the Vite build. */
import postcss from "postcss";

// Newer value syntax: when the LATER value uses it, the earlier value may be the
// fallback an older browser keeps, so the earlier declaration is not removed.
const PARSE_RISK = /color-mix\(|oklch\(|oklab\(|\blab\(|\blch\(|light-dark\(|\bcolor\(|env\(|image-set\(/i;

function contextOf(node) {
  const parts = [];
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type === "atrule") parts.unshift(`@${p.name} ${p.params}`);
  }
  return parts.join("|");
}

// Normalise a property name. Custom properties are case-sensitive; others are not.
const propKey = (prop) => (prop.startsWith("--") ? prop : prop.toLowerCase());

export function dedupeOverriddenCss(css) {
  const root = postcss.parse(css);
  const groups = new Map();
  root.walkRules((rule) => {
    if (rule.parent && rule.parent.type === "atrule" && /keyframes$/i.test(rule.parent.name)) return;
    const key = `${contextOf(rule)}::${rule.selector}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rule);
  });

  let removed = 0;
  for (const rules of groups.values()) {
    if (rules.length < 2) continue;
    // Later rules first: `later` maps property -> importance of the last declaration.
    const later = new Map();
    for (let i = rules.length - 1; i >= 0; i--) {
      const rule = rules[i];
      const kept = [];
      for (const node of rule.nodes) {
        if (node.type !== "decl") { kept.push(node); continue; }
        const key = propKey(node.prop);
        const imp = node.important ? "important" : "normal";
        const lat = later.get(key);
        const overridden = lat && (lat.imp === "important" || imp === "normal");
        if (overridden && !PARSE_RISK.test(lat.value)) { removed++; continue; }
        kept.push(node);
      }
      for (const node of rule.nodes) {
        if (node.type !== "decl") continue;
        const key = propKey(node.prop);
        const imp = node.important ? "important" : "normal";
        const cur = later.get(key);
        if (!cur || imp === "important") later.set(key, { imp, value: node.value });
      }
      if (kept.length === 0) { rule.remove(); continue; }
      if (kept.length !== rule.nodes.length) {
        rule.removeAll();
        kept.forEach((node) => rule.append(node.clone()));
      }
    }
  }
  return { css: root.toString(), removed };
}
