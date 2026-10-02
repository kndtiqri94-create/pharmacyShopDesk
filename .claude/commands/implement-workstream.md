---
description: Ask Sanjeewa (Team Lead) to implement a workstream end-to-end
---

Call the Task tool with `subagent_type=team-lead` and this prompt: "Run
*implement-workstream $ARGUMENTS to completion, following your ORCHESTRATION_RULES —
do not stop between phases; only return once the Code Reviewer returns APPROVED,
MAX_REVIEW_ITERATIONS is hit, or an unresolvable BLOCKED comes back."

If `$ARGUMENTS` is empty, ask the user which workstream number from
`docs/SOLUTION_TASKS.md` they mean before calling the Task tool.
