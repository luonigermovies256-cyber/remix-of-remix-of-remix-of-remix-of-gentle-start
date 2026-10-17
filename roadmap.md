# Tasks
- [x] Fix the public `*` upload token in code and verify its precedence with passing tests.
- [ ] Restore browser upload access: external upload Worker omits Access-Control-Allow-Origin from POST responses. FIXED in-app: control calls now go through the same-origin relay /api/public/uploads/*, so Worker CORS no longer blocks them. Direct browser PUTs to R2 verified (bucket CORS `*`, ETag exposed); a live relay request still needs a signed-in session check.
- [x] Switch upload service, including previously saved Railway addresses.
- [x] Detect published releases and automatically refresh safely.
- [x] Verify settings and update safeguards with five passing tests; apply package security update and confirm build OK.
- [ ] Verify a real signed-in upload end-to-end in the admin console: requires an authenticated upload session.
