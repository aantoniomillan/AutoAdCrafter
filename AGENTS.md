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

## Project rules
- All app pages live under src/routes/_authenticated (client-only gate redirecting to /login); only /login and /registro are public. Why: every screen shows private user data.
- DB columns use quoted camelCase identifiers ("userId", "scheduledAt"). Why: matches the external publishing tool's expected schema.
- Video files go to storage bucket videos at <userId>/<uuid>.mp4 and the row stores getPublicUrl. Why: external publisher reads publicUrl.
- No code comments, camelCase short names, plain console messages. Why: owner code style.
