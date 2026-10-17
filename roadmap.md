# Tasks
- [x] Fix the public `*` upload token in code and verify its precedence with passing tests.
- [ ] Restore browser upload access: external upload Worker omits Access-Control-Allow-Origin from POST responses; its owner must correct and deploy it. Browser reproduced Failed to fetch despite HTTP 200 with token `*`.
- [x] Switch upload service, including previously saved Railway addresses.
- [x] Detect published releases and automatically refresh safely.
- [x] Verify settings and update safeguards with five passing tests; apply package security update and confirm build OK.
- [ ] Verify a real signed-in upload and two published releases: requires deployment and an authenticated upload session. Service health is healthy, but its browser health response lacks CORS headers.