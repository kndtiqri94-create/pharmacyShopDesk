---
description: Ask Shiham (Product Owner) to draft a concise product brief
---

Call the Task tool with `subagent_type=product-owner` and the following prompt
(substitute `$ARGUMENTS` with whatever description of the product/feature the user
provided after the command; if empty, ask the user for it first):

> Create a product brief based on this description: $ARGUMENTS
>
> Capture the business and functional requirements of the product and provide solid
> context for others working on it. Include:
> 1. Project overview / description
> 2. Target audience
> 3. Primary benefits / features
> 4. High-level tech/architecture used
>
> Keep the brief very concise and to the point — just enough context to understand the
> bigger picture. Write the document to `docs/PRODUCT_BRIEF.md` (unless a different file
> name is specified).
