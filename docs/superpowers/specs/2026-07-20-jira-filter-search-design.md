# Searchable Jira Filter Menus

## Goal

Make every Jira card filter menu searchable so long lists such as sprints,
assignees, and fix versions can be narrowed before selecting one or more
values.

## Interaction

- Each Jira filter menu shows a search input above its checkbox options.
- Opening a menu focuses its search input.
- Typing narrows the visible options using case-insensitive substring matching.
- Leading and trailing query whitespace is ignored.
- Searching is local to the already-loaded options and never sends another
  Jira request.
- Checked values retain their selected state. Clearing the query restores the
  full option list with those values still checked.
- An empty result shows a localized "No matching options" message.
- Closing a menu clears its transient query. Reopening starts with the complete
  option list.
- Checking an option keeps the menu open and preserves keyboard focus, matching
  the current multi-select behavior.

## Implementation

`src/jira.ts` will expose a small pure helper that filters option strings. The
existing `paintToolbar` function will add a localized search input to each
`<details>` menu and repaint only that menu's option container on input. It
will continue using the existing persisted `JiraSelections`; search queries
will not be stored in card settings.

The search input and empty state will use new strings from `src/locales/en.ts`.
`styles.css` will add a compact sticky search row so the field remains
available while scrolling long option lists.

## Accessibility

- Each search input has an accessible label containing the filter name.
- The input receives focus when its `<details>` menu opens.
- Native checkboxes and labels remain the selection mechanism.
- The existing visible focus treatment is extended to the search input.

## Testing

Tests in `test/jira.test.ts` will cover:

- an empty query returning every option;
- case-insensitive substring matching;
- trimming query whitespace;
- no-match results;
- input arrays remaining unchanged.

The full test, build, and lint commands will run before updating the existing
draft pull request.
