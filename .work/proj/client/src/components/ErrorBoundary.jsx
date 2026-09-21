import { Component } from "react";
import { safeLocal } from "../lib/storage.js";

/* Catches any render/runtime error in the React tree and shows a friendly,
   bilingual recovery screen instead of a blank white page. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // keep a copy for debugging in the console (no external logging in this build)
    console.error("MED School caught an error:", error, info);
  }
  reset = () => {
    this.setState({ hasError: false, error: null });
  };
  reload = () => {
    window.location.reload();
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    const fa = safeLocal.getItem("medlab_lang") !== "en";
    const compact = !!this.props.compact;
    return (
      <div className={compact ? "eb-screen eb-compact" : "eb-screen"}>
        <div className="eb-card">
          <div className="eb-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01" />
            </svg>
          </div>
          <h2>{fa ? "مشکلی پیش آمد" : "Something went wrong"}</h2>
          <p>{fa
            ? "متأسفیم! یک خطای غیرمنتظره رخ داد. می‌توانید دوباره تلاش کنید یا صفحه را بارگذاری مجدد کنید."
            : "Sorry! An unexpected error occurred. You can try again or reload the page."}</p>
          <div className="eb-actions">
            <button className="btn btn-primary" onClick={this.reset}>{fa ? "تلاش دوباره" : "Try again"}</button>
            <button className="btn btn-ghost" onClick={this.reload}>{fa ? "بارگذاری مجدد" : "Reload"}</button>
          </div>
          {this.state.error && (
            <details className="eb-details">
              <summary>{fa ? "جزئیات فنی" : "Technical details"}</summary>
              <pre>{String(this.state.error?.message || this.state.error)}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
