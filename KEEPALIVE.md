# Why there is a keepalive here

GitHub disables scheduled workflows after **60 days without repository
activity**. On 2026-08-15 that happened to `Daily Puzzle Rotation`, which had
been running at 06:00 UTC every morning. It was switched off with the state
`disabled_inactivity`, and the daily REquation stopped advancing. Nothing
failed, nothing was logged, and no alert fired. The only symptom available to
anyone was a player seeing yesterday's puzzle.

This repository is the shape that trips the rule. It is published content: a
robot writes to it, the game reads from it, and months pass with no push from a
person. Commits made by the Actions bot do not reset the timer, so a repo whose
files change every single morning can still be counted as untouched.

## What runs

`.github/workflows/keepalive.yml`, on the 1st and the 15th. It appends a line
to `.keepalive`, pushes it, and then re-enables `Daily Puzzle Rotation`.

The second step is the one that matters. Whether a bot's push resets the
inactivity clock is not something the documentation settles, so the job does
not rely on it: enabling an already-active workflow is a no-op, which makes it
safe to run every time, and it repairs the failure directly instead of only
trying to prevent it.

## This is a workaround

It exists to satisfy a check rather than to do anything useful, which is worth
saying out loud so the next person does not go looking for its purpose. The
real fix is to run the schedule from a repository people commit to, such as the
PWA, and have it write here with a token. That removes the failure instead of
routing around it, and it is the change to make if this ever lapses again.

## If the daily stops advancing

1. Check the workflow state: `gh workflow list --repo blakgeek/requate-puzzles --all`
2. If it reads `disabled_inactivity`: `gh workflow enable "Daily Puzzle Rotation" --repo blakgeek/requate-puzzles`
3. Catch up immediately: `gh workflow run "Daily Puzzle Rotation" --repo blakgeek/requate-puzzles`
4. Confirm: `curl -s https://blakgeek.github.io/requate-puzzles/daily/manifest.json`, and check that `/today` in the game opens the expected day.

A run succeeding is not proof the daily moved. Between 2026-06-14 and
2026-08-14 the job ran green every morning and committed nothing, because the
sliding window had run past the end of its list. Check the puzzle, not the run.
