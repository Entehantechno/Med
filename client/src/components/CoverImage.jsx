/* R89: reference cover image. Built-in covers (/covers/<code>.jpg) get AVIF and WebP sources
   (scripts/optimize-covers.mjs generates them at 360 px). Any other URL is used as it is. */
export const COVER_PATH_RE = /^\/covers\/[A-Za-z0-9._-]+\.jpe?g$/i;

export function coverSources(src) {
  if (typeof src !== "string" || !COVER_PATH_RE.test(src)) return null;
  const base = src.replace(/\.jpe?g$/i, "");
  return { avif: `${base}.avif`, webp: `${base}.webp` };
}

export default function CoverImage({ src, alt, style, onError }) {
  const s = coverSources(src);
  const img = <img src={src} alt={alt} style={style} loading="lazy" decoding="async" onError={onError} />;
  if (!s) return img;
  return (
    <picture>
      <source type="image/avif" srcSet={s.avif} />
      <source type="image/webp" srcSet={s.webp} />
      {img}
    </picture>
  );
}
