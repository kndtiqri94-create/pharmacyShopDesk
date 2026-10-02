# <DOMAIN> Standards — Template

> Copy this file to create a new PyTIQ standards document. Delete this note and any
> section that would otherwise be empty — do not keep a heading with no content
> "for consistency." Remove this blockquote in the final document.

## Purpose

One paragraph: what problem this standard exists to solve, and why it is a
distinct document rather than a section of another standard.

## Scope

- What this document applies to (which PyTIQ component types, connector
  categories, pipeline stages, etc.).
- What it explicitly does **not** cover, with a pointer to the owning document.

## Referenced Standards

- External standards this document aligns with (PEPs, RFCs, industry
  conventions), with the specific parts that are relevant.
- Internal PyTIQ standards this document depends on or is depended on by.

## Principles

The small number of judgment-guiding ideas behind the rules in this document.
Principles explain *why*; Mandatory Rules state *what*. Keep this section short
— if a principle needs three paragraphs to explain, it probably belongs in
`ENGINEERING_STANDARDS.md` instead of being restated here.

## Mandatory Rules

Numbered, enforceable rules using MUST / MUST NOT. Each rule should be something
a human reviewer or an AI code-review agent can check against a diff without
guessing. Group related rules under subheadings. Include rationale inline only
when the rule would otherwise look arbitrary.

## Recommended Practices

SHOULD / SHOULD NOT / MAY guidance — practices that are strongly encouraged but
where a documented, reviewed exception is acceptable.

## Architecture / Structure

Where this concern lives in a PyTIQ project: module layout, interface
boundaries, naming conventions. Only include this section if the standard
imposes structural requirements beyond generic Python module layout.

## Examples

Good/bad code pairs illustrating the mandatory rules that are easy to get
wrong. Every example must be realistic enough to review, not a toy snippet
that omits the actual difficulty.

## Testing / Validation

What must be tested or validated for work under this standard to be considered
done. Cross-reference `TESTING_STANDARDS.md` for shared test taxonomy instead
of redefining it here.

## Security Considerations

Only include if this domain has security implications beyond the general rules
in `SECURITY_AND_PII_STANDARDS.md`. Otherwise, state the cross-reference and
omit the section.

## Review Checklist

A short, concrete `[ ]` checklist a reviewer (human or AI) can run through
against a diff. Every line must be independently verifiable — no "code is
clean" items.

## Related Standards

Bullet list of links to other `docs/development-standards/*.md` files this
document cross-references, with one clause on what each link is for.
