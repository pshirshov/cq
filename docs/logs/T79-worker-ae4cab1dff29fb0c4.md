# implement-worker — T79 (M18) web archived-milestone unify — PASS

Agent ae4cab1dff29fb0c4. resultCommit 48318e481c282bf7be6e79f12889ff670bf95243, branch implement/T79 (rebased onto main b17c49a). check green 568 pass / 0 fail.

Archived milestone-groups now render through the same collapsible <section> subsection renderer as active groups (shared SubsectionItemTable + MilestoneSubsection), listed after active sections, all present at once, each with an 'archived' badge. Archived sections default collapsed, lazy-fetch via client.fetchLedgerArchive on first expand (cached). lw-archive-pointer button path + dead App-level archive state/CSS retired. happy-dom tests: ≥2 archived groups as lw-milestone-section with badges, none as pointer, collapsed-by-default + one fetch on first expand, active unaffected. Files: App.tsx, styles.css, test/app.test.tsx, test/fakeClient.ts. Left SubsectionItemTable/MilestoneSubsection shells structured for T80 (badge) + T83 (goals flat) to compose.
