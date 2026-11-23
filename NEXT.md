# Next

Updated: 2026-11-22

## Where it stands

This is a classroom adaptation of Chuanqi Sun's Spaceship IDE (chuanqisun/spaceship), a tool for steering LLM text in real time. This copy adds sign-in with emailed codes, an owner panel with a roster and a shared spending allowance, live generation through the server, and a decision-model lab; the pilot answers at https://spaceship.aroughidea.com/. The last work (2026-11-18) started live generation for signed-in users and showed the remaining demo balance.

## Next step

Add a health route, `api/health.js`, that runs `select 1` against the database and returns 200 or 503 with no detail, then a scheduled check that calls it every two hours, so a broken sign-in shows up as an alert and not as a quiet outage.

## After that

- Connect the Vercel site to this repository so a merge to `master` publishes it; today it is uploaded from a local copy (see SETUP.md).
- Bring in the original project's newer commits (six since the fork, all README and community links).
- Pick from the future work listed under "Pilot scope" in SETUP.md: per-person allowances, facilitator roles, workshop scheduling, data retention.

## Blocked or waiting

- None.

## Open questions

- Which class or workshop is the pilot for, and when does it run?
- This plan was drafted by Claude on 2026-11-22 from the code and its history. Is the next step right?
