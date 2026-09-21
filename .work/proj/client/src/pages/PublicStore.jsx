import { TopBar } from "../components/UI.jsx";
import { useApp } from "../context.jsx";
import Icon from "../components/Icon.jsx";
import Store from "./learn/Store.jsx";

/* Public storefront for LOGGED-OUT visitors reached from the landing's
   "Course store" button. Reuses the learner Store (public /store APIs); any
   buy/enroll action prompts sign-up via onRequireAuth. */
export default function PublicStore({ onHome, onRequireAuth }) {
  const { t } = useApp();
  return (
    <div className="app">
      <TopBar onHome={onHome} />
      <div className="container">
        <div className="section-title" style={{ marginBottom: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={onHome}>
            <Icon name="chevronRight" size={15} /> {t("backToHome")}
          </button>
        </div>
        <Store onRequireAuth={onRequireAuth} />
      </div>
    </div>
  );
}
