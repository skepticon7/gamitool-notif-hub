# Design reference

`EDEN.dc.html` is the full Claude Design mockup this frontend is being built against — the ground-truth source for screen layouts, spacing, copy text, animations, and interaction states, used throughout the build for pixel-matching. It's a `.dc.html` file (Claude Design's own component-preview format, not a real runnable app) — read it as a spec, don't try to run it.

**Why this file lives here:** it was originally only available via the DesignSync tool against a live `claude.ai/design` project. That's fine mid-session, but a *new* session starting fresh has no path back to it unless the project ID is known and DesignSync access is re-authorized — so the file itself is committed here for offline, permanent access instead of depending on that.

## Project details (for live re-fetching if ever needed)

- Design project ID: `a287d081-d197-48fb-b479-4115b53f2ba4`
- Target file within that project: `EDEN.dc.html`
- Design system it imports: `gamitool-design-system-22414a8c-a270-4504-a8d4-bb157ddab972` (tokens/colors/typography/foundations — already hand-ported into `src/styles/tokens/*.css`, no need to re-fetch those specifically)
- Original source URL: `https://claude.ai/design/p/a287d081-d197-48fb-b479-4115b53f2ba4?file=EDEN.dc.html`

To pull a fresh copy (e.g. if the design gets updated upstream), use the `DesignSync` tool's `list_files`/`get_file` methods against that project ID — see any earlier session for the exact call pattern, or just ask a fresh session to fetch it given this project ID.

## How to read it

It's a single-page prototype covering every screen (employee dashboard/missions/badges, admin rule graph/schedulments/catalog/engine activity/dashboard, login) via `sc-if`-gated sections in one template, plus a `<script type="text/x-dc">` block containing the mock view-model logic (`renderVals()`) — that JS is genuinely useful for understanding exact style computations (colors, conditional formatting, spacing) even though none of the state/data logic itself should be copied (it's all mock data, not real API shapes — see `CLAUDE.md` for what's actually real).

Sections are marked with `<!-- ====== SCREEN NAME ====== -->` comments — grep for those to jump to a specific screen rather than reading the whole 144KB file.
