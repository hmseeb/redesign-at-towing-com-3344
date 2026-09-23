# AT Towing — Website Redesign

A modernized, fully responsive redesign of the AT Towing website (Benicia & Concord, CA).
Built with vanilla HTML, CSS and JavaScript — no build step, no dependencies.

## Business

- **AT Towing** — heavy & light duty towing, vehicle recovery, auto/truck transportation since 2002
- **Phone (24/7 dispatch):** [925-395-6178](tel:925-395-6178)
- **Address:** 51 Oak Rd, Benicia, California, 94510
- **Instagram:** [@at_towing24.7](https://instagram.com/at_towing24.7)

## Services

Heavy Duty Towing · Car Lockouts · Jumpstarts · Luxury Auto Towing · 24 Hour Roadside Assistance

## Structure

```
index.html    single-page site (hero, about, why us, services, gallery, FAQ, contact, service areas)
styles.css    monochrome brand system, responsive layout, motion
script.js     mobile nav, services submenu, FAQ accordion, form validation, scroll reveal
api/          serverless lead handler that posts form submissions to GoHighLevel
favicon.svg   AT monogram favicon
```

## Lead routing (GoHighLevel)

Every form marked `data-ghl-form` posts to `/api/ghl-lead`, which upserts the
contact in the GoHighLevel sub-account `K1fuM6V0oHLnUHKCRJdt` with first name,
last name, phone and email, sets the custom fields **Lead Source** = `Website`
and **Website Form** = the form's `data-form-name`, applies the
**website-lead** tag and saves the message as a note on the contact. The
visitor sees the thank-you message once the lead is accepted.

Environment variables required by the deployment:

| Variable | Purpose |
| --- | --- |
| `GHL_API_KEY` | GoHighLevel Private Integration token (v2 API) with contacts read/write access |
| `GHL_LOCATION_ID` | Optional — overrides the default sub-account id |

## Design notes

- Original black & white logo and monochrome brand palette retained, presented in a
  bold editorial layout: heavy Archivo display type, Inter body copy, high-contrast
  dark sections and generous whitespace.
- Photography is unified with a grayscale treatment so authentic job-site photos and
  service imagery sit together cohesively.
- Accessibility: skip link, semantic landmarks, ARIA-wired nav/accordion/form,
  visible focus states, `prefers-reduced-motion` support.
- SEO: Open Graph/Twitter meta, canonical URL, `AutoRepair` and `FAQPage` JSON-LD.

## Running locally

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit <http://localhost:8000>.
