/**
 * Shared investigate-flow evidence shape (T341, goal G41).
 *
 * The investigate-explorer and investigate-prober return the SAME numbered
 * evidence-item shape (`{ n, citation, excerpt, relevance }`) and the same
 * `lean` vocabulary; the prober's `## Catalogue` block states its output is the
 * "same shape as investigate-explorer". Defining the item schema + lean tokens
 * ONCE here keeps the two sidecars from drifting (DRY: two sidecars share this).
 */

/** The four `lean` summary tokens both investigate roles return. */
export const EVIDENCE_LEANS = ["supports", "contradicts", "mixed", "insufficient"] as const;

/**
 * One numbered evidence item: a citation (path:line, URL, or — for the prober —
 * an exact command run), a verbatim excerpt, and a one-line relevance note.
 */
export const evidenceItemSchema = {
  type: "object",
  properties: {
    n: { type: "integer", minimum: 1 },
    citation: {
      type: "string",
      description: "A path:line-range, a URL, or (prober) the exact command run.",
      minLength: 1,
    },
    excerpt: {
      type: "string",
      description: "A 3-5 line VERBATIM excerpt from the cited location, or verbatim command output.",
      minLength: 1,
    },
    relevance: {
      type: "string",
      description: "One line: how this bears on H, and whether it SUPPORTS or CONTRADICTS.",
      minLength: 1,
    },
  },
  required: ["n", "citation", "excerpt", "relevance"],
  additionalProperties: false,
} as const;
