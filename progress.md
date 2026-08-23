Original prompt: 完整阅读并审视 Tiny Game Hub，将其从机械扩张的小游戏合集升级为以立直麻将为核心的系统化训练场；基于实际代码制定并实施分阶段的 Tiny Game Hub 1.0 方案，保持纯前端且不过度架构。

## Current implementation goal

- Implement Phase 1 only: establish a trustworthy riichi rule-calculation baseline.
- Keep the app runnable after every change.
- Do not start the later training UI, persistence migration, or catalog-pruning phases yet.

## Baseline

- `pnpm run typecheck`: passed before Phase 1.
- `pnpm run build`: passed before Phase 1.
- `pnpm test`: 356/357 passed; the failing case is the mingang waiting-tile consistency test.

## Progress

- Separated physical meld tile count from logical meld shape count; kans now occupy one 3-tile shape when deriving concealed hand sizes.
- Corrected seat-wind calculation so it depends on seat relative to dealer, not round wind.
- Corrected visible-tile counting to include every seat's exposed melds.
- Corrected honor rendering to the model order East, South, West, North, Chun, Hatsu, Haku, including dragon colors.
- Added focused baseline tests for these invariants: 12 tests passed; TypeScript typecheck passed.
- Extended local settlement to accept exact dealer/non-dealer tsumo payments from the rules engine, including the dealer-tsumo all-seat branch.
- Added the `RiichiRules` facade over riichi-rs for structural hand analysis and authoritative win evaluation, including tile-order conversion, kan logical counts, ron/tsumo winning-tile normalization, red fives, ura-dora rescoring, and exact tsumo payments.
- Migrated structural waits, furiten/exhaustive-draw wait sets, human win availability/resolution, AI ron/tsumo resolution, and settlement plumbing to the facade; removed simplified TypeScript scoring fallbacks from production Japanese-mahjong flows.
- Added explicit failure behavior: valid-state rule-engine errors are no longer silently downgraded to “cannot win” or “noten”; AI actions and exhaustive-draw settlement pause instead of advancing with a fabricated result.
- Preserved yakuman multipliers through the in-game result, log, and modal; “0 fu / 0 han” is no longer shown for yakuman wins.
- Added a narrow `lastDrawWasRinshan` state bit so the three replacement-draw paths pass the rinshan context into authoritative evaluation and ordinary draws/discards clear it.
- Kept waiting-value previews limited to stable visible information: no ura-dora, ippatsu, rinshan, or haitei leakage into hypothetical future waits.
- Corrected the rules-page fu and limit thresholds so the copy no longer describes the deleted simplified scoring formula.
- Focused Phase 1 verification passes: 6 files / 52 tests; TypeScript typecheck passes.
- Browser validation exposed a dev-only async-WASM runtime failure; disabling Rsbuild import lazy-compilation fixed it without changing production chunking.
- Re-ran the original web-game Playwright client against rules, game entry, and a real discard/AI advance. Screenshots were inspected; the final dev runs produced no console-error files.

## Phase 1 checklist

- [x] Normalize tile identity across model, rendering, and WASM mappings.
- [x] Add a tested riichi rules facade for structural hand analysis and exact win evaluation.
- [x] Separate structural tenpai from legal-win and furiten checks.
- [x] Remove simplified production scoring fallbacks.
- [x] Correct seat-wind and kan logical tile-count handling.
- [x] Count every visible meld in remaining-tile hints.
- [x] Run focused tests, full tests, typecheck, build, and browser validation.

## Final verification

- `pnpm test`: 54 files / 385 tests passed.
- `pnpm run typecheck`: passed.
- `pnpm run build`: passed and emitted the riichi WASM asset.
- Scoped Biome check: 34 changed source/test files passed with no fixes required.
- `git diff --check`: passed.
- Exact web-game Playwright client: opened a fresh riichi game in the dev server, discarded a real tile, observed the turn advance, and produced no console-error report. Final screenshot: `C:/Users/52699/.codex/visualizations/2026/08/23/01a02ddd-f18a-7ea2-8f0c-38aeb27aa9ea/final-browser/shot-0.png`.

## Notes / follow-ups

- Phase 2 remains responsible for dead-wall modeling, claim priority (including ankan chankan limits), legal riichi-discard locking, the complete ippatsu lifecycle, and the deterministic round runtime.
