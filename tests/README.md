# tests/

Automated tests live next to the code they cover, which keeps imports honest and allows the same
tooling to run them in CI:

- `frontend/src/test/calc.test.ts` — P&L, R-multiples, metrics, drawdown, date ranges
- `frontend/src/test/risk.test.ts` — position sizing, risk guard, quality score
- `frontend/src/test/analysis.test.ts` — 20-detector mistake engine, audit scores, investigations
- `frontend/src/test/coach.test.ts` — local AI coach, honesty guards
- `frontend/src/test/app.test.tsx` — auth screen, markdown renderer
- `frontend/src/test/pages.smoke.test.tsx` — every page mounts; empty states do not fabricate data

Run everything from the repository root:

```bash
npm test           # 7 suites / 103 tests
npm run typecheck  # strict TypeScript
```

See [../docs/TESTING.md](../docs/TESTING.md) for coverage details and the manual QA script.
