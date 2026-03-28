---
name: create-pr
description: 'Create a GitHub pull request with the project PR template, linking the related issue. Use when the user asks to create a PR, open a pull request, or mentions "/create-pr". Handles: (1) Filling the PR template with summary, motivation, changes, key decisions, out of scope, verification, and how to test, (2) Updating the linked GitHub issue tasks to checked, (3) Creating the PR via gh cli with Closes # to auto-close the issue on merge.'
---

# Create Pull Request

Create a GitHub PR using the project template at `.github/PULL_REQUEST_TEMPLATE.md`, linking and updating the related GitHub issue.

## Workflow

### 1. Gather context

```bash
# Branch info
git log main..HEAD --oneline
git diff main...HEAD --stat

# Find the linked issue (from branch name pattern or user input)
gh issue view <number>
```

Identify:
- The **issue number** this branch addresses (from branch name like `001-xxx` or user input)
- All **commits** on the branch since diverging from main
- The **files changed** and their nature (new, modified, deleted)

### 2. Update the GitHub issue

If the issue has task checkboxes (`- [ ]`), update them to reflect completed work:

```bash
gh issue edit <number> --body "<updated body with [x] checked tasks>"
```

Only check tasks that are actually completed by the branch changes.

### 3. Fill the PR template

Use this exact structure (from `.github/PULL_REQUEST_TEMPLATE.md`):

```markdown
## Summary
<!-- 2-4 bullet points, focus on WHAT was delivered, not HOW -->

## Motivation

Closes #<issue-number>

## What changed
<!-- Tree or structured description — give reviewers a quick mental map -->

## Key decisions
<!-- Table format works well for multiple decisions -->
| Decision | Why |
|----------|-----|
| ... | ... |

## Out of scope
<!-- Explicitly list what was NOT included to prevent scope questions -->

## Verification
<!-- What was validated: builds, tests, reviews, speckit passes -->

## How to test
<!-- Exact commands a reviewer can copy-paste to verify locally -->
```

**Guidelines for each section:**

- **Summary**: Lead with user value, not implementation details. 2-4 bullets max.
- **Motivation**: Always include `Closes #<number>` to auto-close the issue on merge. Add context only if the issue title is not self-explanatory.
- **What changed**: A directory tree or structured list works best for multi-file changes. Keep it scannable.
- **Key decisions**: Only include decisions that are non-obvious. If a reviewer might ask "why did you do it this way?", it belongs here. Use a table for 3+ decisions.
- **Out of scope**: List things that are intentionally deferred. This prevents "why didn't you also do X?" comments.
- **Verification**: List concrete validation steps already performed (build results, test passes, review outputs).
- **How to test**: Copy-pasteable commands. Include prerequisites if non-obvious.

### 4. Create the PR

```bash
gh pr create \
  --title "<type>: <short description>" \
  --body "$(cat <<'EOF'
<filled template>
EOF
)" \
  --base main
```

**Title format**: Use conventional commit style (`feat:`, `fix:`, `refactor:`, `docs:`). Keep under 70 characters.

### 5. Report

Output the PR URL so the user can review it.

## Example

**Input**: User says "create the PR" on branch `001-project-scaffolding` linked to issue #1.

**Output**:
- Issue #1 tasks updated (all checked)
- PR created with title `feat: initialize Tauri v2 + React 19 project shell`
- Body filled with summary, `Closes #1`, tree of changes, key decisions table, out of scope, verification results, test commands
- PR URL returned
