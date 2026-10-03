# ShopDesk back office (frontend)

ShopDesk is the quiet back office of a one-shop pharmacy. This app is the Angular frontend for Workstream 2.1 (Foundation): look and feel, building blocks, sample data, the main frame, sign-in and role access. The nine modules are placeholders until features F-2.2 to F-2.5.

It has no backend. All data is in-memory sample data that resets when you reload the page.

## Run it

```bash
npm install
npm start          # http://localhost:4200/
npm run build      # development build check
npm run build:prod # production build (sample sign-in is switched off, see below)
npm run lint
npm test           # run the unit tests yourself (they are not run automatically)
npm run check:contrast
```

## Security headers

`index.html` carries a Content-Security-Policy meta tag. The host should also send the same policy as an HTTP header, plus `frame-ancestors 'none'` (or `X-Frame-Options: DENY`), because `frame-ancestors` is ignored in a meta tag. Production build does not inline critical CSS so no inline script is needed.

## Sample sign-in (for testers only)

This is a sample sign-in, not real security. There is no server, and the details below only work in a development build (`mockAuthEnabled: true` in `src/environments/environment.ts`). The production build ships with `mockAuthEnabled: false`, replaces the sample details with an empty list, and shows "Sign-in is not set up" instead.

| Role (as shown in the top bar) | Username | Password | Lands on |
|---|---|---|---|
| Admin, shown as Owner (Nimal Perera) | `nimal` | `Owner@2026` | Dashboard |
| Manager (Kamal Silva) | `kamal` | `Manager@2026` | Dashboard |
| Pharmacist (Dilani Fernando) | `dilani` | `Pharmacist@2026` | Dashboard |
| Cashier (Ruwani Jayawardena) | `ruwani` | `Cashier@2026` | Products |

Access by role (Full / View / No access) is defined once in `src/app/core/services/data/in-memory/seed/role-permission.seed.ts`.

## Layout and breakpoints

Desktop first. Breakpoints live in `src/styles/_breakpoints.scss` (and the one matching drawer query in `src/app/core/utils/breakpoints.const.ts`). The smallest supported width is 360px.

| Width | Behaviour |
|---|---|
| 1280px and wider | 232px sidebar, fluid content, 12-column form grid with a 320px summary beside it |
| 1024 to 1279px | Sidebar becomes a drawer behind a labelled Menu button, summary moves below the form |
| 768 to 1023px | Drawer sidebar, form grid reflows to 6 columns, stat cards 2 per row |
| Below 768px | Drawer sidebar, form grid 1 column, stat cards 1 per row, tables scroll sideways with a sticky first column (or stack) |

## Design tokens

All colours, spacing, radius, shadow and type tokens are CSS custom properties in `src/styles/_tokens.scss` (light theme in `:root`, dark theme in `[data-theme='dark']`; the sidebar is dark in both). Hex values are approximate until exact ones are supplied. `npm run check:contrast` checks the 4.5:1 text and 3:1 control pairs in both themes. DM Sans is bundled locally from `@fontsource/dm-sans`; there is no CDN.

## Structure

```
src/app/core/        models (domain, enums, shared), data services (abstract + in-memory + seed), auth, permissions, guards, utils
src/app/shared/      presentation components (icon, button, badge, card, data-table, field, ...)
src/app/features/    shell (sidebar, top bar), auth/sign-in, modules (placeholders), errors
src/styles/          global SCSS partials
```

Screens get data only through the abstract services in `src/app/core/services/data/`. To use a real API later, add implementations and bind them in `provideDataServices`.
