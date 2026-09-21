import { useState } from "react";
import { useApp } from "../../context.jsx";
import Icon from "../../components/Icon.jsx";
import CalmModeCard from "../../components/CalmModeCard.jsx";
import ProfileCard from "../../components/ProfileCard.jsx";
import { playLevelUp } from "../../lib/feedback.js";

/* Global settings hub — one place to control appearance (theme), sound effects,
   language, and see the motion preference. Everything is client-side and
   AI-free; the toggles just flip localStorage-backed context state that the
   rest of the app already reads. */
export default function Settings() {
  const { t, theme, setTheme, sound, setSound, lang, setLang, fontScale, setFontScale, logoutAll } = useApp();
  const FONTS = [
    ["small", t("fontSmall")],
    ["normal", t("fontNormal")],
    ["large", t("fontLarge")],
    ["xl", t("fontXl")],
  ];
  const [tested, setTested] = useState(false);

  const reducedMotion = typeof window !== "undefined" &&
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const testSound = () => {
    // enable sound if muted so the preview is actually heard, then play the fanfare
    if (!sound) setSound(true);
    playLevelUp();
    setTested(true);
    setTimeout(() => setTested(false), 1500);
  };

  return (
    <div className="settings-page">
      <div className="section-title"><h4><Icon name="settings" size={18} /> {t("settings")}</h4></div>
      <p className="muted" style={{ marginTop: -4 }}>{t("settingsHint")}</p>

      {/* Personal info: nickname, phone, bio + anonymous/real-name toggle */}
      <ProfileCard />

      {/* Appearance / theme */}
      <div className="card set-card">
        <div className="set-head"><Icon name="sun" size={16} /> {t("settingsAppearance")}</div>
        <div className="set-row">
          <div className="set-label">{t("settingsTheme")}</div>
          <div className="set-seg" role="group" aria-label={t("settingsTheme")}>
            <button
              className={`set-seg-btn ${theme === "light" ? "active" : ""}`}
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}>
              ☀️ {t("settingsThemeLight")}
            </button>
            <button
              className={`set-seg-btn ${theme === "dark" ? "active" : ""}`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}>
              🌙 {t("settingsThemeDark")}
            </button>
          </div>
        </div>
      </div>

      {/* Text size (accessibility) */}
      <div className="card set-card">
        <div className="set-head"><Icon name="book" size={16} /> {t("settingsFont")}</div>
        <div className="small muted" style={{ marginBottom: 10 }}>{t("settingsFontHint")}</div>
        <div className="set-seg set-seg-wrap" role="group" aria-label={t("settingsFont")}>
          {FONTS.map(([key, label]) => (
            <button
              key={key}
              className={`set-seg-btn ${fontScale === key ? "active" : ""}`}
              aria-pressed={fontScale === key}
              onClick={() => setFontScale(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="set-font-preview">{t("fontPreview")}</div>
      </div>

      {/* Sound & feedback */}
      <div className="card set-card">
        <div className="set-head"><Icon name="party" size={16} /> {t("settingsSound")}</div>
        <div className="toggle-row">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="set-label">{t("settingsSoundLabel")}</div>
            <div className="small muted">{sound ? t("settingsSoundOnDesc") : t("settingsSoundOffDesc")}</div>
          </div>
          <button
            className={`switch ${sound ? "on" : ""}`}
            role="switch"
            aria-checked={sound}
            aria-label={sound ? t("soundOff") : t("soundOn")}
            onClick={() => setSound(!sound)}
          />
        </div>
        <button className="btn btn-ghost btn-sm set-test" onClick={testSound} disabled={tested}>
          {t("settingsPreviewSound")}
        </button>
      </div>

      {/* Language */}
      <div className="card set-card">
        <div className="set-head"><Icon name="globe" size={16} /> {t("settingsLanguage")}</div>
        <div className="set-row">
          <div className="set-seg" role="group" aria-label={t("settingsLanguage")}>
            <button
              className={`set-seg-btn ${lang === "fa" ? "active" : ""}`}
              aria-pressed={lang === "fa"}
              onClick={() => setLang("fa")}>
              {t("settingsLangFa")}
            </button>
            <button
              className={`set-seg-btn ${lang === "en" ? "active" : ""}`}
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}>
              {t("settingsLangEn")}
            </button>
          </div>
        </div>
      </div>

      {/* Session security — ASVS 3.3.4 logout of every device */}
      <div className="card set-card">
        <div className="set-head"><Icon name="logout" size={16} /> {t("logoutAll")}</div>
        <div className="small muted" style={{ marginBottom: 10 }}>{t("logoutAllHint")}</div>
        <button className="btn btn-danger btn-sm" onClick={logoutAll}>{t("logoutAll")}</button>
      </div>

      {/* Calm Mode (anti-burnout, opt-in) */}
      <CalmModeCard />

      {/* Motion (informational — driven by the OS preference) */}
      <div className="card set-card">
        <div className="set-head"><Icon name="activity" size={16} /> {t("settingsMotion")}</div>
        {reducedMotion
          ? <div className="set-motion-on">✓ {t("settingsReducedMotionOn")}</div>
          : <div className="small muted">{t("settingsMotionNote")}</div>}
      </div>
    </div>
  );
}
