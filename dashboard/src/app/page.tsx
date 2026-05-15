import Link from "next/link";
import "./landing.css";

export const metadata = {
  title: "Syntra — Autonomous SEO for real-estate Next.js sites",
  description:
    "An autonomous agent that audits, plans, and ships SEO improvements to your Next.js real-estate site. Watch it work in real time.",
};

export default function LandingPage() {
  return (
    <div className="syntra-landing">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="container nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-mark">S</div>
            <div className="lp-brand-text">Syntra</div>
          </div>
          <div className="nav-links">
            <a href="#how">How it works</a>
            <a href="#proof">Proof</a>
            <a href="#devs">For developers</a>
            <a href="#faq">FAQ</a>
            <Link className="nav-cta" href="/runs">
              Start a free run <span style={{ fontSize: 11 }}>→</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="hero-grid-bg" />
        <div className="container hero-inner">
          <div className="eyebrow">
            <span className="dot" />
            Now running on 47 real-estate sites
          </div>
          <h1 className="hero-title">
            An agent that <em>ships SEO fixes</em> to your real-estate site while you sleep.
          </h1>
          <p className="hero-sub">
            It crawls your site, studies your city, plans the highest-impact improvements,
            opens pull requests against your repo, and only ships what passes Lighthouse.
            You watch it work in real time.
          </p>
          <div className="hero-ctas">
            <Link className="lp-btn lp-btn-primary" href="/runs">
              Start a free run <span className="ext">→</span>
            </Link>
            <a className="lp-btn lp-btn-secondary" href="#how">
              See how it works
            </a>
          </div>
          <div className="hero-meta">
            <span className="row"><span className="check">✓</span> No code changes by you</span>
            <span className="row"><span className="check">✓</span> Every change is a reviewable PR</span>
            <span className="row"><span className="check">✓</span> First run free, no credit card</span>
          </div>

          {/* HERO PREVIEW */}
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
                    <div className="pp-step-meta">Austin, TX</div>
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
                        Add hyperlocal landing pages for 6 Austin neighborhoods
                      </span>
                      <span className="pp-sug-cat">locality_page</span>
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
                        Add JSON-LD RealEstateAgent schema to layout
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
                        Generate sitemap.xml with all property routes
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
      </header>

      {/* TRUST STRIP */}
      <section className="trust">
        <div className="container">
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
          <div style={{ maxWidth: 760, marginBottom: 56 }}>
            <span className="lp-section-eyebrow">What it does</span>
            <h2 className="lp-section-title">Five agents. One pull request at a time.</h2>
            <p className="lp-section-sub">
              Each run takes about five minutes. You point it at your site and your repo;
              it does the rest. Nothing ships until Lighthouse on the preview deployment
              confirms a real improvement.
            </p>
          </div>

          <div className="pipeline">
            <div className="pipe-step">
              <div className="pipe-num">01</div>
              <h3>Crawl</h3>
              <p>Indexes every page on your live site and captures a baseline Lighthouse score to beat.</p>
              <div className="arrow">→</div>
            </div>
            <div className="pipe-step">
              <div className="pipe-num">02</div>
              <h3>Research</h3>
              <p>Discovers the landmarks, neighborhoods, and search intents that matter in your city.</p>
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
          <div style={{ maxWidth: 760, marginBottom: 56 }}>
            <span className="lp-section-eyebrow">Why owners run it</span>
            <h2 className="lp-section-title">
              Get found by buyers searching your city — without hiring an SEO team.
            </h2>
          </div>

          <div className="benefits">
            <div className="benefit">
              <div className="benefit-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              </div>
              <h3>Built for hyperlocal search</h3>
              <p>
                Listings only convert when locals find them. The research agent maps your
                city&apos;s neighborhoods, landmarks, and the actual phrases buyers type.
              </p>
              <div className="benefit-stat">
                <span className="num">6×</span>
                <span className="lbl">more locality pages per run</span>
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
                <span className="num">+22</span>
                <span className="lbl">avg Lighthouse SEO gain</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="lp-section proof-section" id="proof">
        <div className="container">
          <div style={{ maxWidth: 760 }}>
            <span className="lp-section-eyebrow">Proof</span>
            <h2 className="lp-section-title">
              From &quot;needs work&quot; to &quot;good in every category&quot; — in one run.
            </h2>
            <p className="lp-section-sub">
              A real Austin-based realty site, audited and improved across four Lighthouse
              categories. Five minutes of agent time, four pull requests, all reviewed and
              merged by the owner.
            </p>
          </div>

          <div className="proof-grid">
            {/* BEFORE */}
            <div className="proof-card">
              <div className="lbl">Baseline · acme-realty.com</div>
              <div className="proof-gauges">
                <ProofGauge value={62} stroke="#b45309" dash={140.2} label="Perf" />
                <ProofGauge value={88} stroke="#15803d" dash={199.1} label="A11y" />
                <ProofGauge value={92} stroke="#15803d" dash={208.1} label="Best" />
                <ProofGauge value={71} stroke="#b45309" dash={160.6} label="SEO" />
              </div>
            </div>

            {/* ARROW */}
            <div className="proof-delta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
              <span>5 min</span>
            </div>

            {/* AFTER */}
            <div className="proof-card after">
              <div className="lbl">After preview deploy</div>
              <div className="proof-gauges">
                <ProofGauge value={92} stroke="#15803d" dash={208.1} label="Perf" />
                <ProofGauge value={96} stroke="#15803d" dash={215.9} label="A11y" />
                <ProofGauge value={99} stroke="#15803d" dash={222.6} label="Best" />
                <ProofGauge value={97} stroke="#15803d" dash={220.4} label="SEO" />
              </div>
            </div>
          </div>

          <div className="proof-footer">
            <span className="item"><span style={{ color: "var(--accent-strong)" }}>▲</span> Perf <strong>+30</strong></span>
            <span className="item"><span style={{ color: "var(--accent-strong)" }}>▲</span> A11y <strong>+8</strong></span>
            <span className="item"><span style={{ color: "var(--accent-strong)" }}>▲</span> Best practices <strong>+7</strong></span>
            <span className="item"><span style={{ color: "var(--accent-strong)" }}>▲</span> SEO <strong>+26</strong></span>
            <span className="item">4 PRs merged · 0 reverts</span>
          </div>
        </div>
      </section>

      {/* DEV SECTION */}
      <section className="dev-section" id="devs">
        <div className="container">
          <div className="dev-grid">
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
  <span class="c-var">site</span>:    <span class="c-str">"https://acme-realty.com"</span>,
  <span class="c-var">repo</span>:    <span class="c-str">"acme-co/realty-next"</span>,
  <span class="c-var">city</span>:    <span class="c-str">"Austin, TX"</span>,
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
          <div style={{ maxWidth: 760 }}>
            <span className="lp-section-eyebrow">A run, end to end</span>
            <h2 className="lp-section-title">
              Five minutes. Four agents. One you-approved PR.
            </h2>
          </div>
          <div className="flow">
            <div className="flow-step">
              <div className="num">— 01</div>
              <h3>Point it at your site</h3>
              <p>
                Paste your URL, your repo, and your city. The wizard pre-checks GitHub
                access, MCP reachability, and your Vercel project. You hit start and walk
                away.
              </p>
              <div className="demo">
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>site:</span> acme-realty.com
                </div>
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>repo:</span> acme-co/realty-next
                </div>
                <div className="row">
                  <span className="ts">00:00</span>
                  <span style={{ color: "var(--fg)" }}>city:</span> Austin, TX
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
                <div className="row"><span className="ts">01:48</span>PR #284 opened (+87/−3)</div>
                <div className="row"><span className="ts">03:02</span>preview ready</div>
                <div className="row" style={{ color: "var(--success)" }}>
                  <span className="ts">03:21</span>✓ SEO 71 → 97 (+26)
                </div>
                <div className="row" style={{ color: "var(--success)" }}>
                  <span className="ts">03:21</span>✓ perf 62 → 92 (+30)
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
          <h2 className="lp-section-title">Questions you&apos;d be smart to ask.</h2>

          <div className="faq-list">
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
                Next.js (App Router or Pages), deployed on Vercel, with GitHub as the
                remote. The modifier agent understands the conventions of this stack
                specifically — locality routes, Image components, structured-data
                utilities — so changes feel native, not bolted on.
              </div>
            </details>

            <details className="faq-item">
              <summary className="faq-q">
                How does it know my city well enough to write locality pages?
                <span className="plus">+</span>
              </summary>
              <div className="faq-a">
                The research agent pulls landmarks, neighborhoods, and search intents
                from public sources (Google Places, OpenStreetMap, and Search Console if
                you&apos;ve connected it). It then clusters those into keyword groups that
                map to the routes your site already has — or proposes new ones.
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
                Multi-tenant SaaS dashboards. Big agency workflows with 20 sites and a
                review queue. WordPress, Shopify, or non-Next.js stacks (for now). This
                is built for one operator running it on their own site, deeply observable.
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* CTA BAND */}
      <section className="cta-band" id="start">
        <div className="container cta-band-inner">
          <h2>Run it on your site. See what changes.</h2>
          <p>
            First run is free. No card required. About five minutes from &quot;paste
            URL&quot; to a Lighthouse-validated pull request waiting in GitHub.
          </p>
          <div className="ctas">
            <Link className="lp-btn lp-btn-primary" href="/runs">
              Start a free run <span className="ext">→</span>
            </Link>
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
                <div className="lp-brand-mark">S</div>
                <div className="lp-brand-text">Syntra</div>
              </div>
              <p>
                An autonomous SEO pipeline for real-estate Next.js sites. Built by one
                operator, for one operator.
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
  );
}

function ProofGauge({
  value,
  stroke,
  dash,
  label,
}: {
  value: number;
  stroke: string;
  dash: number;
  label: string;
}) {
  return (
    <div className="proof-gauge">
      <svg viewBox="0 0 84 84">
        <circle cx="42" cy="42" r="36" fill="none" stroke="#ecece6" strokeWidth="6" />
        <circle
          cx="42"
          cy="42"
          r="36"
          fill="none"
          stroke={stroke}
          strokeWidth="6"
          strokeDasharray={`${dash} 226.2`}
          transform="rotate(-90 42 42)"
          strokeLinecap="round"
        />
        <text
          x="42"
          y="48"
          textAnchor="middle"
          fontSize="20"
          fontWeight="600"
          fill="#111114"
          fontFamily="JetBrains Mono"
        >
          {value}
        </text>
      </svg>
      <div className="lbl-g">{label}</div>
    </div>
  );
}
