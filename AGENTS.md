<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Generate a release marker in the client build and poll it from the root; only reload safely outside uploads, checkout dialogs, input editing and active playback, preserving authentication and payment recovery.
- Resolve the upload endpoint through one shared browser-safe module, migrating retired service addresses while preserving explicit empty settings and custom endpoints.
- Resolve the built-in service's public upload token in that same module so stale settings cannot override it; retain configurable tokens for custom endpoints.
