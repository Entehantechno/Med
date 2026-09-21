import { useApp } from "../context.jsx";
import Icon from "./Icon.jsx";

/* ---------------------------------------------------------------------------
   MediaEmbed — renders a serialized media descriptor from the server:
     { kind: "image" | "video" | "embed", url, caption, provider?, poster? }
   - image : <img> (uploaded or external https)
   - video : native <video> player (uploaded mp4/webm)
   - embed : responsive 16:9 <iframe> for Aparat / YouTube (already normalized
             to a safe player URL server-side; CSP frame-src allows only these)
   Degrades gracefully: in the offline in-app preview an external iframe/img
   simply won't load, but the layout (and caption) stay intact.
--------------------------------------------------------------------------- */
export default function MediaEmbed({ media, className = "" }) {
  const { lang } = useApp();
  if (!media || !media.url) return null;
  const cap = media.caption ? (
    <figcaption className="media-cap">{media.caption}</figcaption>
  ) : null;

  if (media.kind === "embed") {
    return (
      <figure className={`media-embed media-frame ${className}`}>
        <div className="media-ratio">
          <iframe
            src={media.url}
            title={media.caption || (lang === "fa" ? "ویدیوی درس" : "Lesson video")}
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        {cap}
      </figure>
    );
  }

  if (media.kind === "video") {
    return (
      <figure className={`media-embed media-video ${className}`}>
        <video controls preload="metadata" poster={media.poster || undefined} playsInline>
          <source src={media.url} />
        </video>
        {cap}
      </figure>
    );
  }

  // image (default)
  return (
    <figure className={`media-embed media-image ${className}`}>
      <img src={media.url} alt={media.caption || ""} loading="lazy" />
      {cap}
    </figure>
  );
}

/* A tiny inline "has media" badge for lists/editors. */
export function MediaBadge({ media }) {
  const { lang } = useApp();
  if (!media) return null;
  const label = media.kind === "video" ? (lang === "fa" ? "ویدیو" : "Video")
    : media.kind === "embed" ? (media.provider === "aparat" ? "آپارات" : "یوتیوب")
    : (lang === "fa" ? "تصویر" : "Image");
  const icon = media.kind === "image" ? "image" : "play";
  return <span className="media-badge"><Icon name={icon} size={11} /> {label}</span>;
}
