"use client";

/**
 * HiwHeader - sticky top bar for /how-it-works.
 *
 * TOKEN GOTCHA: this bar is `sticky` and is NOT reliably nested inside the light
 * frame's `[data-section="light"]` token scope, so design tokens would resolve to
 * the ROOT (dark) palette and the bar would go invisible (same class of bug that
 * killed the landing navbar). Therefore this is the ONE component that uses
 * EXPLICIT HEX, per the spec - never tokens.
 *
 *   bg     #fefefe   border #e7e7e7   ink #14161c   muted #646464
 *
 * Slim, z-50, subtle bottom hairline. Marker: data-hiw="header".
 */

const BG = "#fefefe";
const BORDER = "#e7e7e7";
const INK = "#14161c";
const MUTED = "#646464";

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "#overview", label: "Overview" },
  { href: "#methodology", label: "Methodology" },
  { href: "#different", label: "What's new" },
  { href: "#see-it-live", label: "See it live" },
];

export function HiwHeader() {
  return (
    <header
      data-hiw="header"
      className="sticky top-0 z-50 w-full backdrop-blur-sm"
      style={{ backgroundColor: `${BG}f2`, borderBottom: `1px solid ${BORDER}` }}
    >
      <div
        className="mx-auto flex h-14 max-w-[var(--maxw-content)] items-center justify-between gap-6 px-5 sm:px-8"
      >
        {/* Left - wordmark */}
        <a
          href="/how-it-works"
          className="group flex items-baseline gap-2 whitespace-nowrap"
          style={{ color: INK }}
        >
          <span className="font-mono text-[13px] font-semibold tracking-tight">
            Alpha
          </span>
          <span className="font-display text-[15px] leading-none" style={{ color: MUTED }}>
            &amp;
          </span>
          <span className="font-mono text-[13px] font-semibold tracking-tight">
            Oversight
          </span>
        </a>

        {/* Center - section anchors (hidden on small screens) */}
        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:opacity-100"
              style={{ color: MUTED }}
              onMouseEnter={(e) => (e.currentTarget.style.color = INK)}
              onMouseLeave={(e) => (e.currentTarget.style.color = MUTED)}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Right - report link + back home */}
        <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
          <a
            href="/alpha-oversight-report.pdf"
            className="font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
            style={{ color: INK }}
          >
            Read the report
          </a>
          <span aria-hidden style={{ color: BORDER }}>
            |
          </span>
          <a
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
            style={{ color: MUTED }}
          >
            &larr; Home
          </a>
        </div>
      </div>
    </header>
  );
}

export default HiwHeader;
