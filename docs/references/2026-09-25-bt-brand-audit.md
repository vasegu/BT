# BT visual identity: source audit and demonstrator styling

Inspected 25 September 2026. Companion to the [BT Consumer specification](../superpowers/specs/2026-09-25-bt-consumer-experience-design.md).

This is an extraction from BT's public materials and current website, with an explicit proposed interface treatment. It is **not** a copy of BT's internal brand manual. “Observed” values describe the inspected page; “proposed” values are our design decisions.

## 1. Current identity, rather than an old rebrand

BT launched **Behind Brilliant Things** in May 2026. Its announcement connects the brand to the people, networks and technology supporting everyday life, and mentions a redesigned MyBT app. The September broadband campaign continues that platform through protection and confidence. Our demonstrator should show dependable service and useful action, with warmth in customer language and precision in the technical workspace. Sources: [May launch](https://newsroom.bt.com/bt-to-power-uefa-euro-2028-and-launches-behind-brilliant-things-campaign/), [September campaign](https://newsroom.bt.com/bt-strengthens-broadband-leadership-by-putting-online-security-at-the-heart-of-new-campaign/).

The 2026 annual report describes distinct BT, EE and Plusnet propositions. Use **BT** as the pitch identity and fictional BT customer experience. Do not silently turn the demo into an EE application or imply that shared group ownership establishes permission to pool household records. Source: [BT Annual Report 2026](https://www.bt.com/about/annual-reports/2026summary/).

The public supplier [Marks & Branding Policy](https://groupextranet.bt.com/selling2bt/downloads/BT%20MARKS%20BRANDING%20Policy.pdf) is dated March 2018. It points suppliers to Brand Central for typography, colour and mark specifications; it is not a current visual manual. Brand Central could not be accessed through the research tool. Consequently official clear-space measurements, current full palette, font licensing and co-branding lockups remain unverified. None is invented here.

## 2. What was actually extracted

Source page: [Why BT](https://www.bt.com/broadband/why-bt). Browser inspection captured rendered type, colours and asset URLs. Public stylesheets were inspected separately. The initial BT homepage text fetch returned a waiting screen; the Why BT page rendered successfully. The current MyBT authenticated interface was not inspected, so the proposed phone is a concept, not a reproduction of its latest screens.

| Element | Observed evidence | Use in the demonstrator |
| --- | --- | --- |
| Main brand colour | Rendered headings and links `rgb(85,20,180)` / **#5514B4** | Primary action, active stage, selected evidence and key reference line |
| Body ink | Rendered body copy **#2A2A2A** | Main text on light surfaces |
| Navigation ink | Rendered navigation **#36454F**; utility text **#333333** | Secondary navigation; do not reproduce several almost-identical inks unnecessarily |
| Surfaces | White page; white, `#F0F0F0`, `#EEEEEE`, `#DDDDDD` occur in global CSS | White content and subtle neutral separations |
| Typography | Rendered family begins **BTCurve**, with older BT Font / Calibri / Arial fallbacks | Use BT Curve when supplied for this use; otherwise use the specified system fallback |
| Headline scale | At the inspected desktop viewport: H1 48px, H2 40px, H3 32px; computed weight 500 | Reference for a single cover headline, not the size of dashboard section titles |
| Body and navigation | Body 16px, navigation 18px, utility navigation 14px | Preserve readable body copy; compact controls selectively |
| Mark | Purple circular BT mark in public navigation | Use the supplied mark unchanged, at native aspect ratio |
| Image treatment | Large photographic/video region under a restrained headline | Optional cover image; charts and customer content get priority inside the demo |

The global stylesheet declares `BTCurve_W_Rg.woff2`. Older BT Font regular, bold and light faces coexist in the site bundle. A computed weight of 500 does not prove a separately loaded BT Curve medium font exists. Do not manufacture a licensed font kit from these observations.

The commons bundle also contains **#6400AA** and **#E60050**. Their presence among legacy and component rules does not establish a current primary palette. The inspected page uses #5514B4 for its principal headings and links; that is the grounded starting colour. Do not add bright pink throughout the application simply because it exists in the bundle.

Source assets:

- [Public BT navigation logo](https://www.bt.com/content/dam/bt/global/logos/BT_Logo_purple.png). An unmodified reference copy is saved at [bt/BT_Logo_purple.png](bt/BT_Logo_purple.png); BT owns the mark.
- [Global stylesheet](https://www.bt.com/etc.clientlibs/global/clientlibs.min.css): current navigation, colour and font declarations.
- [Commons stylesheet inspected](https://www.bt.com/etc.clientlibs/commons/clientlibs/clientlib-commons-site.lc-99c5b30af24ff3d2c1372b7bc7ec23a3-lc.css): mixed component and historical rules; hash may change.
- [Referenced regular font URL](https://www.bt.com/etc.clientlibs/settings/wcm/designs/commons/clientlibs_base/resources/fonts/BTCurve_W_Rg.woff2): recorded as provenance; font binary not vendored.

The downloaded PNG was visually checked against the inspected circular mark. Its SHA-256 is `103eba7f727938188ef0cedcd1d2615c8fb690fee3c33dc0589469253524adc8`. No website stylesheet or font bundle was copied into the application.

## 3. Proposed tokens for our interface

Only `brand`, `ink`, `surface` and the BT font identity below are grounded in the observations above. The rest are **our proposed accessible application tokens**, not official BT brand specifications.

```css
--brand: #5514b4;
--brand-hover: #42108c;
--brand-soft: #f1ebfa;
--ink: #2a2a2a;
--ink-muted: #625e68;
--surface: #ffffff;
--canvas: #f7f6f9;
--line: #ddd9e3;
--line-strong: #807986;
--success: #176b43;
--success-soft: #edf7f1;
--warning: #875000;
--warning-soft: #fff4df;
--danger: #b42332;
--danger-soft: #fff0f1;
--focus: #5514b4;
--font-ui: "BTCurve", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
--font-data: ui-monospace, "SFMono-Regular", Consolas, monospace;
--radius-control: 8px;
--radius-panel: 12px;
--radius-phone-card: 20px;
--space-unit: 4px;
```

Use normal text at 16/24px, controls at 14/20px, readable technical metadata at 12/18px, panel titles at 20/26px and moment headlines at 28/34px. Tabular numerals align timestamps and metrics. Monospace belongs to IDs, probabilities, timestamps and short technical labels; explanations remain proportional text.

Spacing uses 4, 8, 12, 16, 24 and 32px. Compact the header, not the evidence. Give panel content 20–24px inset, related rows 8–12px separation and distinct sections 24px. Essential interactive boundaries use `line-strong`; subtle `line` is only a separator, not the sole way to identify a control.

## 4. Brand expression with our best UX

| Surface | Direction |
| --- | --- |
| Workspace | Light, crisp and technical. Purple earns attention through selection and decision state; the entire screen is not purple. |
| Customer phone | iPhone system chrome, real wallpaper, natural notification grouping, legible timestamps and one clear action per card. BT identity lives inside the app and notification icon. |
| Memory | Quiet rows and aligned timelines. Source, freshness and change history are visible. Meaning comes from records and relationships. |
| Arbiter | A clear decision, alternatives and constraints. Sparse colour; green never means “AI said yes.” |
| Technical workbench | Dense enough to demonstrate engineering, with shared row selection and expandable receipts. Full identifiers and distributions appear on demand. |
| Forecasts | Thin labelled lines, restrained uncertainty bands, marked observation cutoff. Baseline neutral, conditional forecast purple, actuals dark. |
| Motion | Proposed 160–220ms for local state changes, 240ms panel disclosure; reduced motion uses instant state changes. Animate one new record once. |
| Loading | A small separate segmented ring suggests work in progress. Keep the BT logo static and unmodified; no Soho grid, metallic cube or indefinite fake activity. |
| Voice | Direct, specific, calm. Explain what is known, what happens next and when an update is due. No agent jargon in customer messages. |

The header mark is proposed at 28–32px with generous surrounding space; these are layout choices, not official minimum-size/clear-space rules. The header reads “BT Consumer / Experience intelligence — concept demonstrator.” Accenture attribution belongs discreetly in the footer; no invented official partnership lockup.

Avoid copying the public site's marketing navigation, large campaign headings into every panel, intrusive promotional bands, or historical typography mixtures. Preserve Soho/Jio's progressive disclosure, phone continuity, explicit scenario clock and evidence drill-down. The brand changes; the established interaction quality carries over.

## 5. Visual acceptance

- At 1512 × 900 and 1440 × 900, a visitor can identify the household, current event and customer consequence without scrolling through several header bars.
- At 390px width, a single active panel fits without horizontal page scroll. The phone is optional framing on small screens, not a tiny scaled desktop.
- Normal text meets 4.5:1 contrast; large text and meaningful UI graphics meet 3:1. Validate actual colour pairs, including hover, disabled and selected states, during implementation.
- Focus remains visible and follows expanded panels; disclosure controls use native semantics. Touch actions aim for 44 × 44px, with no hover-only evidence.
- Status always has words or shapes as well as colour. Unknown, stale, held and failed are distinguishable.
- Public branding observations, proposed UI choices and any later BT-supplied manual revisions remain separately recorded.

Initial token checks on 25 September: brand/white contrast 9.79:1; muted ink/canvas 5.87:1; proposed success, warning and danger text on their corresponding soft fills each exceed 5.8:1; strong boundary/white 4.20:1. These calculated pairs pass their intended text or boundary thresholds. They do not replace verification of the implemented interface and all interactive states.


## Review styling refinement · pre-Studio Jio reference

The user selected the older Jio account layout and typography, before Signals Studio. The review now uses the warm `#FAF9F5` canvas and fine `#E8E5DE` borders from Jio commit `ee83558b` (21 April 2026), with white cards and the original system-sans/monospace stack. Muted text is `#65625D`. BT purple `#5514B4` remains the selection and decision accent. The earlier token table is the initial BT study; these are the chosen review overrides.

This is a deliberate cross-project design adaptation, not an assertion that the warm neutrals or system fonts are BT brand standards. Jio font binaries have not been copied. The centre phone retains system chrome, while the MyBT concept uses the verified public BT mark and colour.


The running 9 July Jio snapshot (`621fa991`) was subsequently confirmed by the user as the fidelity reference. Its compact record typography, section hierarchy, status tags and source/trace rows now inform the BT review. BT purple marks selection and mandate; unknown, pending and unobserved states retain neutral text and explicit labels.


## Working app hierarchy refinement

The current React workspace consolidates surfaces to neutral `#F6F5F8` page/insets, white panels and `#F1EBFA` selected/decision surfaces. These supersede the warm Jio canvas for the running app; the static historical review remains a reference. BT purple remains `#5514B4`. Operations scope and arbiter diagrams share the same light hierarchy as customer memory. Supporting chart hues distinguish data groups without assigning each panel a different background.

Five shared type roles are defined in `app/src/styles.css`: page 26px, section 18px, body 12px, supporting text 11px and metadata 9px. Compact desktop uses 24/16/11/10/8px through the same tokens. System sans-serif handles prose and controls; system monospace identifies data, record IDs and times. SVG labels use chart coordinates. Native phone chrome retains its own scale. These are demonstrator design choices, not newly verified official BT typography rules.
