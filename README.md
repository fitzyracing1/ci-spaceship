# ci-spaceship

CI is a spaceship. Every run flies a simulated mission through five flight phases:
**launch → ascent → orbit insertion → cruise → landing**.

Between phases the ship hands state over in **transfers** (altitude, velocity, fuel, heading, a checksum, and
a few telemetry packets). The scenario generator deliberately leaves **gaps** in those transfers. A solver bot
looks at each transfer, spots the gap, and fills it. A run is **lit** only when every transfer is solved
correctly. Anything else is **dark**.

## Gaps the generator leaves

| gap | what's wrong | how the solver fills it |
|---|---|---|
| `missing_field` | one state value is `null` | recover it from the checksum |
| `unit_mismatch` | km, km/h, lb or radians instead of m, m/s, kg, degrees | convert back to SI |
| `checksum_break` | checksum is wrong | recompute it |
| `out_of_order` | telemetry packets shuffled | sort by packet index |
| `missing_link` | the "to" phase is missing | next phase in the flight plan |

The long (scheduled) profile stacks up to three gaps per transfer and adds duplicate and late deliveries.

## Layout

- `scenarios/` – seeded generator (`generate.mjs`, writes a feed file) and a tiny endless feed server (`server.mjs`). No dependencies.
- `checks/` – **locked** grader. It rebuilds the hidden ground truth from the seed and compares every solved transfer to it.
- `solver/` – reference solver bot. Solves a feed file, or crawls the live feed nonstop (`--url`).
- `android/` – Kotlin app that runs the solver on your phone: polls the feed URL in a loop, solves each transfer locally, and shows lit/dark counts.
- `.github/workflows/mission.yml` – on every push: fly a mission and grade it. Every 6 hours: a long mission (2000 transfers) with more random faults. Each run writes a LIGHT summary.

## Why the grader is locked

An easy way to fake a lit build is to weaken the test instead of fixing the code. To block that:

1. `CODEOWNERS` requires the owner's review for `checks/` and `.github/`.
2. CI hashes `checks/` and compares it to the pinned manifest in `.github/checks.lock`. Any difference makes the run dark.
3. The solver is not allowed to reference the grader or the truth (CI greps for it).
4. A canary step grades the raw, unsolved feed and expects it to be dark, so a grader that says "lit" to everything gets caught.

## Run it

```sh
npm run mission                       # generate, solve, grade (Node 18+)
npm test
PORT=8787 node scenarios/server.mjs   # live feed
node solver/solve.mjs --url http://localhost:8787 --max 200
```

Phone: download the `ci-spaceship-debug-apk` artifact from a CI run, install it, start the feed server on your
laptop, and enter `http://<laptop-ip>:8787` in the app.

## Scope

This is a self-contained test world. Every transfer is made up by our own generator. The bot never touches real
third-party transfers, accounts, or money.

## License

MIT © 2026 Joshua Almeida
