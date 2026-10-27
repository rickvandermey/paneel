# styles

Design tokens and the Tailwind entry shared by every app and UI lib.

- `themes.css`: the `--sd-*` tokens and the built-in themes as `[data-theme]` blocks.
- `tailwind.css`: imports Tailwind, exposes the tokens through `@theme inline` and defines the
  shared `sd-*` utilities. Component stylesheets `@reference` this file and group utilities with
  `@apply` under their semantic class names.
