import Link from "next/link";
import { HeroAuditForm } from "@/ui/components/HeroAuditForm";
import { AuthGate } from "@/ui/components/AuthGate";
import { ThemeToggle } from "@/ui/components/ThemeToggle";
import { LandingMotion } from "@/ui/components/LandingMotion";
import { StartTrialButton } from "@/ui/components/StartTrialButton";
import { getSession } from "@/lib/auth/server";
import "./landing.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Syntra — The autonomous SEO engineer that ships pull requests",
  description:
    "Syntra crawls your site, plans the highest-impact SEO improvements, and opens real pull requests against your repo — for any industry. Watch it work in real time.",
};

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const session = await getSession();
  const authed = !!session;
  const { authError } = await searchParams;

  return (
    <>
    {authed && <LandingMotion />}
    <div className={`syntra-landing${authed ? "" : " is-gated"}`} aria-hidden={!authed}>
      {/* Continuous ambient backdrop — drifts behind the whole page */}
      <div className="lp-ambient" aria-hidden />

      {/* NAV */}
      <nav className="lp-nav">
        <div className="container nav-inner">
          <div className="lp-brand">
            <img className="lp-brand-mark" src="/syntra-logo.png" alt="Syntra logo" />
            <div className="lp-brand-text">Syntra</div>
          </div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#proof">Proof</a>
            <a href="#devs">For developers</a>
            <a href="#faq">FAQ</a>
            <ThemeToggle />
            <StartTrialButton className="nav-cta">
              Start a free run <span style={{ fontSize: 11 }}>→</span>
            </StartTrialButton>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero" id="top">
        <div className="hero-aurora" />
        <div className="hero-grid-bg" />
        <div className="hero-spotlight" aria-hidden />
        <div className="container hero-inner">
          <div className="hero-copy">
          <div className="eyebrow">
            <span className="dot" />
            Detect → Plan → Implement → Validate
          </div>
          <h1 className="hero-title">
            An agent that <em>ships SEO fixes</em> to your site while you sleep.
          </h1>
          <p className="hero-sub">
            It crawls your site, detects what kind of business it is, plans the
            highest-impact improvements, opens pull requests against your repo, and
            only flags what passes Lighthouse. You watch it work in real time.
          </p>
          <HeroAuditForm />
          <div className="hero-ctas">
            <a className="lp-btn lp-btn-secondary" href="#how">
              See how it works
            </a>
            <Link className="lp-btn lp-btn-secondary" href="/runs">
              Recent runs
            </Link>
          </div>
          <div className="hero-meta">
            <span className="row"><span className="check">✓</span> No code changes by you</span>
            <span className="row"><span className="check">✓</span> Every change is a reviewable PR</span>
            <span className="row"><span className="check">✓</span> First run free, no credit card</span>
          </div>
          </div>

          {/* HERO PREVIEW — the product shot, right column */}
          <div className="hero-preview-tilt">
          <div className="hero-preview">
            <div className="preview-bar">
              <div className="dot" />
              <div className="dot" />
              <div className="dot" />
              <div className="url">
                <span className="url-host">syntra.dev</span>/runs/run_a7f3c2e1
              </div>
            </div>
            <div className="preview-body">
              {/* LEFT: pipeline */}
              <aside className="pp-left">
                <div className="pp-label">Pipeline</div>

                <div className="pp-step">
                  <div className="pp-step-rail-wrap">
                    <div className="pp-step-marker done">✓</div>
                    <div className="pp-step-line" />
                  </div>
                  <div className="pp-step-body">
                    <div className="pp-step-title">Crawl</div>
                    <div className="pp-step-meta">47 pages</div>
                  </div>
                </div>

                <div className="pp-step">
                  <div className="pp-step-rail-wrap">
                    <div className="pp-step-marker done">✓</div>
                    <div className="pp-step-line" />
                  </div>
                  <div className="pp-step-body">
                    <div className="pp-step-title">Research</div>
                    <div className="pp-step-meta">search intent</div>
                  </div>
                </div>

                <div className="pp-step">
                  <div className="pp-step-rail-wrap">
                    <div className="pp-step-marker done">✓</div>
                    <div className="pp-step-line" />
                  </div>
                  <div className="pp-step-body">
                    <div className="pp-step-title">Plan</div>
                    <div className="pp-step-meta">7 suggestions</div>
                  </div>
                </div>

                <div className="pp-step">
                  <div className="pp-step-rail-wrap">
                    <div className="pp-step-marker run" />
                    <div className="pp-step-line" />
                  </div>
                  <div className="pp-step-body">
                    <div className="pp-step-title run">Modify</div>
                    <div className="pp-step-meta">2 of 3 PRs</div>
                  </div>
                </div>

                <div className="pp-step">
                  <div className="pp-step-rail-wrap">
                    <div className="pp-step-marker pending" />
                  </div>
                  <div className="pp-step-body">
                    <div className="pp-step-title pending">Validate</div>
                  </div>
                </div>
              </aside>

              {/* MID: suggestions */}
              <section className="pp-mid">
                <h4>Suggestions</h4>
                <div className="sub">7 proposed · 2 in flight · 1 implemented</div>

                <div className="pp-sug">
                  <div className="pp-sug-row">
                    <div>
                      <span className="pp-sug-title">
                        Add FAQ structured data to the top 6 landing pages
                      </span>
                      <span className="pp-sug-cat">structured_data</span>
                    </div>
                    <span className="pp-pill high">HIGH</span>
                  </div>
                  <div className="pp-sug-meta">
                    <span>
                      Impact <strong style={{ color: "var(--success)" }}>HIGH</strong>
                    </span>
                    <span>
                      Risk <strong style={{ color: "var(--success)" }}>LOW</strong>
                    </span>
                    <div className="priority">
                      <div className="bar">
                        <div className="fill" style={{ width: "94%" }} />
                      </div>
                      <span className="num">94</span>
                    </div>
                  </div>
                </div>

                <div className="pp-sug live">
                  <div className="pp-sug-row">
                    <div>
                      <span className="pp-sug-title">
                        Add JSON-LD Organization schema to layout
                      </span>
                      <span className="pp-sug-cat">structured_data</span>
                    </div>
                    <span className="pp-pill dispatch pulse-soft">DISPATCHING</span>
                  </div>
                  <div className="pp-sug-meta">
                    <span
                      className="lp-mono"
                      style={{ fontSize: 10, color: "var(--fg-muted)" }}
                    >
                      job_cc_8f2a · editing src/app/[city]/page.tsx
                      <span className="cursor-inline" />
                    </span>
                  </div>
                </div>

                <div className="pp-sug">
                  <div className="pp-sug-row">
                    <div>
                      <span className="pp-sug-title">
                        Generate sitemap.xml covering all routes
                      </span>
                      <span className="pp-sug-cat">sitemap_robots</span>
                    </div>
                    <span className="pp-pill open">PR OPEN</span>
                  </div>
                  <div className="pp-sug-meta">
                    <span className="lp-mono" style={{ fontSize: 10 }}>
                      PR #284 ·{" "}
                      <span style={{ color: "var(--success)" }}>+87</span>{" "}
                      <span style={{ color: "var(--danger)" }}>−3</span>
                    </span>
                  </div>
                </div>
              </section>

              {/* RIGHT: log */}
              <aside className="pp-right">
                <div className="pp-log-head">
                  <span className="pp-log-title">Live log</span>
                  <span className="pp-log-stream">
                    <span className="dot pulse-soft" />
                    streaming
                  </span>
                </div>
                <div className="pp-log">
                  <div className="pp-log-line">
                    <span className="t">30:13</span>
                    <span>
                      <span className="agent">[crawl]</span> 47 pages indexed
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">30:16</span>
                    <span>
                      <span className="agent">[lighthouse]</span> 62 / 88 / 92 / 71
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">30:30</span>
                    <span>
                      <span className="agent">[geo]</span> 23 landmarks · 14 intents
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">30:59</span>
                    <span>
                      <span className="agent">[planner]</span> 7 suggestions ready
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">31:48</span>
                    <span>
                      <span className="agent">[github]</span> PR #284 opened
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">32:58</span>
                    <span>
                      <span className="agent">[mcp]</span> read src/app/layout.tsx
                    </span>
                  </div>
                  <div className="pp-log-line">
                    <span className="t">33:15</span>
                    <span>
                      <span className="agent">[llm]</span> claude-sonnet-4 · 8.2k tok
                    </span>
                  </div>
                  <div className="pp-log-line live">
                    <span className="t">34:49</span>
                    <span>
                      <span className="agent">[edit]</span> src/app/[city]/page.tsx
                      <span className="cursor-inline" />
                    </span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
          </div>
        </div>
      </header>

      {/* TRUST STRIP */}
      <section className="trust">
        <div className="container" data-reveal>
          <div className="trust-label">Built on tools you already trust</div>
          <div className="trust-row">
            <span>Next.js</span>
            <span className="sep" />
            <span>Vercel</span>
            <span className="sep" />
            <span>GitHub</span>
            <span className="sep" />
            <span>Claude Code</span>
            <span className="sep" />
            <span>Lighthouse</span>
            <span className="sep" />
            <span>MCP</span>
          </div>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className="lp-section" id="how">
        <div className="container">
          <div style={{ maxWidth: 760, marginBottom: 56 }} data-reveal>
            <span className="lp-section-eyebrow">What it does</span>
            <h2 className="lp-section-title">Five agents. One pull request at a time.</h2>
            <p className="lp-section-sub">
              Each run takes about five minutes. You point it at your site and your repo;
              it does the rest. Nothing ships until Lighthouse on the preview deployment
              confirms a real improvement.
            </p>
          </div>

          <div className="pipeline" data-reveal-children>
            <div className="pipe-step">
              <div className="pipe-num">01</div>
              <h3>Crawl</h3>
              <p>Indexes every page on your live site and captures a baseline Lighthouse score to beat.</p>
              <div className="arrow">→</div>
            </div>
            <div className="pipe-step">
              <div className="pipe-num">02</div>
              <h3>Research</h3>
              <p>Analyzes search visibility — the keywords, topics, and (for local businesses) the areas and intents that matter in your market.</p>
              <div className="arrow">→</div>
            </div>
            <div className="pipe-step">
              <div className="pipe-num">03</div>
              <h3>Plan</h3>
              <p>Generates ranked suggestions with impact, risk, and the exact files each change would touch.</p>
              <div className="arrow">→</div>
            </div>
            <div className="pipe-step">
              <div className="pipe-num">04</div>
              <h3>Modify</h3>
              <p>You approve. Claude Code edits your repo and opens one PR per accepted suggestion.</p>
              <div className="arrow">→</div>
            </div>
            <div className="pipe-step">
              <div className="pipe-num">05</div>
              <h3>Validate</h3>
              <p>Waits for Vercel preview, re-runs Lighthouse, and only flags wins that actually improved scores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div style={{ maxWidth: 760, marginBottom: 56 }} data-reveal>
            <span className="lp-section-eyebrow">Why teams run it</span>
            <h2 className="lp-section-title">
              Get found by the people searching for you — without hiring an SEO team.
            </h2>
          </div>

          <div className="benefits" data-reveal-children>
            <div className="benefit">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Adapts to any industry</h3>
              <p>
                Syntra detects what kind of business your site is — SaaS, healthcare,
                e-commerce, local services — and tailors the audit, schema, and content
                to it. Location-based? It layers in local search intelligence too.
              </p>
              <div className="benefit-stat">
                <span className="num">∞</span>
                <span className="lbl">industries, one engine</span>
              </div>
            </div>
            <div className="benefit">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <h3>Every change is reviewable</h3>
              <p>
                Nothing touches your site without a pull request. You approve in GitHub.
                Roll back any time. No mystery edits, no scary &quot;AI did something&quot;.
              </p>
              <div className="benefit-stat">
                <span className="num">100%</span>
                <span className="lbl">of changes are PRs</span>
              </div>
            </div>
            <div className="benefit">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <h3>Proven by Lighthouse</h3>
              <p>
                Suggestions don&apos;t ship on hype. Every accepted change is re-measured
                on a Vercel preview deploy and only flagged a win if the numbers actually move.
              </p>
              <div className="benefit-stat">
                <span className="num">A/B</span>
                <span className="lbl">before vs. after on every PR</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="lp-section proof-section" id="proof">
        <div className="container">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="lp-section-eyebrow">How a run looks</span>
            <h2 className="lp-section-title">
              From &quot;needs work&quot; to &quot;good in every category&quot; — in one run.
            </h2>
            <p className="lp-section-sub">
              An illustrative run: a site audited and improved across four Lighthouse
              categories in a few minutes of agent time, every change a reviewable pull
              request. Each run shows the real before/after from your own preview deploy.
            </p>
          </div>

          <div className="proof-card" style={{ marginTop: 8 }} data-reveal>
            <div
              style={{
                display: "flex",
                alignItems: "stretch",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {[
                { t: "Before score", d: "Baseline Lighthouse on your live site" },
                { t: "Syntra analysis", d: "Crawl, detect the business, plan the highest-impact fixes" },
                { t: "Optimization PR", d: "Claude Code opens one reviewable pull request" },
                { t: "Validation", d: "Re-run Lighthouse on the Vercel preview deploy" },
                { t: "Improved score", d: "Merge only what measurably moved" },
              ].map((s, i) => (
                <div
                  key={s.t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: "1 1 0",
                    minWidth: 150,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{s.t}</div>
                    <div style={{ fontSize: 12.5, color: "var(--fg-muted)", lineHeight: 1.45 }}>
                      {s.d}
                    </div>
                  </div>
                  {i < 4 && (
                    <div style={{ color: "var(--fg-dim)", fontSize: 18, flexShrink: 0 }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="proof-footer">
            <span className="item">Every change is a pull request</span>
            <span className="item">Nothing merges until Lighthouse confirms it on your preview</span>
          </div>
        </div>
      </section>

      {/* DEV SECTION */}
      <section className="dev-section" id="devs">
        <div className="container">
          <div className="dev-grid" data-reveal-children>
            <div>
              <span className="lp-section-eyebrow">For developers</span>
              <h2 className="lp-section-title" style={{ fontSize: 38 }}>
                Your repo is the source of truth. Always.
              </h2>
              <p className="lp-section-sub" style={{ marginBottom: 0 }}>
                Every agent runs against a real workspace, talks to your codebase over MCP,
                and produces git diffs you can read. No magic, no lock-in, no proprietary
                representation of your site.
              </p>

              <ul className="dev-feat">
                <li>
                  <div className="ico">▸</div>
                  <div><strong>One PR per change</strong> Reviewable diffs, never bulk commits.</div>
                </li>
                <li>
                  <div className="ico">⊙</div>
                  <div><strong>MCP everywhere</strong> Filesystem, shell, Vercel, GitHub, Lighthouse.</div>
                </li>
                <li>
                  <div className="ico">↗</div>
                  <div><strong>Self-hosted MCP</strong> Bring your own server. We talk to it, not the other way.</div>
                </li>
                <li>
                  <div className="ico">●</div>
                  <div><strong>Live SSE traces</strong> Every span, every tool call, every LLM token.</div>
                </li>
                <li>
                  <div className="ico">⧗</div>
                  <div><strong>OpenTelemetry-ready</strong> Pipe spans to your own observability stack.</div>
                </li>
                <li>
                  <div className="ico">⌥</div>
                  <div><strong>Webhook triggers</strong> Run on push, on Vercel deploy, or on schedule.</div>
                </li>
              </ul>
            </div>

            <div className="dev-code">
              <div className="dev-code-bar">
                <span className="d" />
                <span className="d" />
                <span className="d" />
                <span className="file">~ syntra/run.config.ts</span>
              </div>
              <pre
                dangerouslySetInnerHTML={{
                  __html: `<span class="c-com">// One operator, one site, deeply observable.</span>
<span class="c-key">import</span> { <span class="c-var">defineRun</span> } <span class="c-key">from</span> <span class="c-str">"@syntra/agent"</span>;

<span class="c-key">export default</span> <span class="c-fn">defineRun</span>({
  <span class="c-var">site</span>:    <span class="c-str">"https://your-site.com"</span>,
  <span class="c-var">repo</span>:    <span class="c-str">"your-org/your-site"</span>,
  <span class="c-var">industry</span>: <span class="c-str">"auto-detect"</span>,
  <span class="c-var">trigger</span>: { <span class="c-var">kind</span>: <span class="c-str">"github_webhook"</span> },

  <span class="c-var">mcp</span>: {
    <span class="c-var">url</span>:     <span class="c-str">"https://mcp.your-org.dev"</span>,
    <span class="c-var">plugins</span>: [<span class="c-str">"repo"</span>, <span class="c-str">"fs"</span>, <span class="c-str">"shell"</span>,
               <span class="c-str">"lighthouse"</span>, <span class="c-str">"vercel"</span>, <span class="c-str">"github"</span>],
  },

  <span class="c-var">policy</span>: {
    <span class="c-var">maxPRsPerRun</span>: <span class="c-str">5</span>,
    <span class="c-var">requirePassingLighthouse</span>: <span class="c-str">true</span>,
    <span class="c-var">autoMerge</span>: <span class="c-str">false</span>,
  },
});`,
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section className="flow-section">
        <div className="container">
          <div style={{ maxWidth: 760 }} data-reveal>
            <span className="lp-section-eyebrow">A run, end to end</span>
            <h2 className="lp-section-title">
              Five minutes. Four agents. One you-approved PR.
            </h2>
          </div>
          <div className="flow" data-reveal-children>
            <div className="flow-step">
              <div className="num">— 01</div>
              <h3>Point it at your site</h3>
              <p>
                Paste your URL, your repo, and a GitHub token. The wizard pre-checks GitHub
                access, MCP reachability, and your Vercel project. You hit start and walk
                away.
              </p>
              <div className="demo">
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>site:</span> your-site.com
                </div>
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>repo:</span> your-org/your-site
                </div>
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>industry:</span> auto-detected
                </div>
                <div className="row" style={{ color: "var(--success)" }}>
                  <span className="ts">00:01</span>✓ pre-flight passed
                </div>
              </div>
            </div>

            <div className="flow-step">
              <div className="num">— 02</div>
              <h3>Watch agents work, live</h3>
              <p>
                SSE-driven flight deck. Every crawl, every tool call, every token.
                Suggestions appear as they&apos;re generated, ranked by impact and risk.
              </p>
              <div className="demo">
                <div className="row"><span className="ts">00:13</span>[crawl] 47 pages indexed</div>
                <div className="row"><span className="ts">00:30</span>[geo] 23 landmarks · 14 intents</div>
                <div className="row"><span className="ts">00:59</span>[planner] 7 suggestions</div>
                <div className="row live">
                  <span className="ts">04:49</span>[edit] page.tsx
                  <span className="cursor-inline" />
                </div>
              </div>
            </div>

            <div className="flow-step">
              <div className="num">— 03</div>
              <h3>Approve only what you want</h3>
              <p>
                One click accepts a suggestion. Claude Code drafts the PR. Vercel deploys
                a preview. Lighthouse re-runs. Wins are flagged green; you decide what
                merges.
              </p>
              <div className="demo">
                <div className="row"><span className="ts">01:48</span>PR opened on a feature branch</div>
                <div className="row"><span className="ts">03:02</span>preview ready</div>
                <div className="row" style={{ color: "var(--success)" }}>
                  <span className="ts">03:21</span>✓ SEO improved on preview
                </div>
                <div className="row" style={{ color: "var(--success)" }}>
                  <span className="ts">03:21</span>✓ perf improved on preview
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="faq">
        <div className="container">
          <span className="lp-section-eyebrow">FAQ</span>
          <h2 className="lp-section-title" data-reveal>Questions you&apos;d be smart to ask.</h2>

          <div className="faq-list" data-reveal-children>
            <details className="faq-item">
              <summary className="faq-q">
                Will it push code to my repo without me approving?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                No. Every change is a pull request on a feature branch. Auto-merge is off
                by default; you turn it on per repo if and when you want to. Until then,
                the agent stops at &quot;PR opened&quot; and waits.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                What stack does my site need to be on?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                Syntra reads your repo and adapts to whatever framework it finds. It&apos;s
                best-supported on Next.js (App Router or Pages) deployed on Vercel with
                GitHub as the remote — that&apos;s where preview deploys and Lighthouse
                validation are fully wired end to end. Other stacks work for the audit and
                pull requests; the validation step depends on your preview setup.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                How does it handle local / location-based SEO?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                Only when it matters. Syntra detects whether your business is
                location-based; if it is, the research agent maps the areas you serve,
                nearby landmarks, and local search intents into keyword clusters and local
                landing-page suggestions. Online or global businesses skip this step
                entirely — no invented geography.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                What happens if a suggestion regresses Lighthouse?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                The validation agent re-runs Lighthouse on the Vercel preview deploy and
                compares it to baseline. Regressions are flagged in red on the run page.
                The PR stays open but isn&apos;t marked &quot;validated&quot; — you can
                close it without merging.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                Is my data going through your servers?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                The orchestrator is hosted; the MCP server (which actually touches your
                files) can be self-hosted on your own infra. The only thing crossing our
                boundary is the planning prompt and the agent traces — never your source
                code.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                Who is this not for?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                Sites with no code repository to open pull requests against — some closed
                website builders and hosted platforms. The audit and plan still run, but
                the auto-implement step needs a repo it can push a branch to. If you can
                give Syntra a GitHub repo, it can ship.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="cta-band" id="start">
        <div className="hero-aurora" />
        <div className="container cta-band-inner" data-reveal>
          <h2>Run it on your site. See what changes.</h2>
          <p>
            First run is free. No card required. About five minutes from &quot;paste
            URL&quot; to a Lighthouse-validated pull request waiting in GitHub.
          </p>
          <div className="ctas">
            <a className="lp-btn lp-btn-primary" href="#top" data-magnetic>
              Analyze my site <span className="ext">→</span>
            </a>
            <a className="lp-btn lp-btn-secondary" href="#how">
              How it works
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="container">
          <div className="foot-grid">
            <div className="foot-brand">
              <div className="lp-brand">
                <img className="lp-brand-mark" src="/syntra-logo.png" alt="Syntra logo" />
                <div className="lp-brand-text">Syntra</div>
              </div>
              <p>
                The autonomous SEO engineer that ships real pull requests — for any
                industry, on your own repo.
              </p>
            </div>
            <div className="foot-col">
              <h4>Product</h4>
              <ul>
                <li><a href="#how">How it works</a></li>
                <li><a href="#proof">Proof</a></li>
                <li><Link href="/runs/new">Start a run</Link></li>
                <li><Link href="/runs">Recent runs</Link></li>
              </ul>
            </div>
            <div className="foot-col">
              <h4>Developers</h4>
              <ul>
                <li><a href="#devs">Architecture</a></li>
                <li><Link href="/connect">Connect</Link></li>
                <li>
                  <a
                    href="https://github.com/Akshatb2006/SEO-MultiAgentic-System"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                </li>
                <li><a href="#">Status</a></li>
              </ul>
            </div>
            <div className="foot-col">
              <h4>Company</h4>
              <ul>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <div>© Syntra · Built for operators who like to watch agents work.</div>
            <div className="right">
              <a href="#">Twitter / X</a>
              <a
                href="https://github.com/Akshatb2006/SEO-MultiAgentic-System"
                target="_blank"
                rel="noreferrer"
              >
                GitHub
              </a>
              <a href="#">RSS</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
    {!authed && <AuthGate error={authError} />}
    </>
  );
}
