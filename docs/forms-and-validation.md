# Forms and validation

A `form` element collects inputs and sends them to an API as JSON. The API validates them on the server against its declared payload, and the form shows any errors next to the fields. There is no separate client-side validation layer to keep in sync: the API's rules are the rules.

## A complete form

```json iwc:element
{
  "type": "form",
  "id": "contact",
  "inputs": [
    { "name": "name", "type": "text", "label": "Name", "required": true, "autocomplete": "name" },
    { "name": "email", "type": "email", "label": "Email", "required": true, "placeholder": "you@example.com" },
    { "name": "topic", "type": "select", "label": "Topic", "options": [{ "label": "An order", "value": "order" }, { "label": "Something else", "value": "other" }] },
    { "name": "body", "type": "textarea", "label": "Message", "required": true },
    { "name": "newsletter", "type": "checkbox", "label": "Send me the newsletter" }
  ],
  "elements": [{ "type": "text", "variant": "caption", "content": "We reply within a day." }],
  "submit": {
    "api": "messages.api.iwc",
    "label": "Send",
    "success": { "message": "Thanks, we'll be in touch.", "reset": true }
  }
}
```

and the API it posts to, whose `request.payload` is the validation:

```json iwc:api
{
  "name": "sendMessage",
  "method": "POST",
  "path": "/messages",
  "operation": "db.create",
  "resource": "message.schema.iwc",
  "request": {
    "payload": {
      "name": { "type": "string", "required": true, "minLength": 2, "maxLength": 120 },
      "email": { "type": "email", "required": true },
      "topic": { "type": "string", "enum": ["order", "other"], "default": "other" },
      "body": { "type": "string", "required": true, "maxLength": 5000 },
      "newsletter": { "type": "boolean", "default": false }
    }
  },
  "response": { "status": 201, "fields": { "id": "string" } },
  "security": { "rateLimit": "5/1m" }
}
```

## form properties

| Property | Required | Meaning |
| --- | --- | --- |
| `inputs` | **yes** (or `elements`) | The fields, in order |
| `submit.api` | **yes** | The API file. It must be `POST`, `PUT`, `PATCH` or `DELETE` |
| `submit.label` | no | Button text (default: the form's `label`, else "Submit") |
| `submit.className` | no | Classes for the button; they replace its primary styling |
| `submit.include` | no | Client state to send along, e.g. `["STATE.cart.items"]` |
| `submit.success` | no | What happens after a 2xx response (below) |
| `elements` | no | Extra content shown after the inputs, before the button |

### success

| Key | Effect |
| --- | --- |
| `message` | Show this text under the form |
| `reset` | Clear the inputs |
| `navigate` | Go to this path on the site. May be an expression, e.g. `"=query.next ?? '/'"` (so is `message`) |
| `redirect` | Go to the URL in this **response field**. Only a path on this site, or an address on one of the project's http service origins, is allowed (for payment pages). Not together with `navigate` |
| `mutation` | Run a state mutation, written `store.mutation`, e.g. `cart.clear` |
| `reload` | Reload the page |

With none of these, a small "Saved" notice appears.

**Sign-in forms** (forms posting to an `auth.login` or `auth.register` API) return the visitor to where they came from: when IWC sends a visitor to the login page from a protected screen, it adds `?next=/that/page`, and after success the form goes there instead of `navigate`.

## Input properties

| Property | Meaning |
| --- | --- |
| `name` | **Required.** The payload key (letters, digits, `_`) |
| `type` | **Required.** `text` `email` `password` `number` `tel` `url` `date` `textarea` `select` `radio` `checkbox` `file` `image` `hidden` |
| `label` | Visible label (linked to the control for screen readers) |
| `placeholder` | Hint inside the control |
| `hint` | A short help line under the field, read by screen readers with the control (may be an expression) |
| `required` | Marks the field required in the browser UI. **Enforcement is the API's `required`** |
| `options` | For `select` and `radio`: strings, or `{label, value}` objects. A radio option may add `image` and `description`; a radio with option images shows each option as a clickable card (a theme or plan picker). A radio's `value` is checked |
| `optionsFrom` | For `select` and `radio`: options read from data, after any static ones: `{"source": "DATABASE.branches" | "API.<name>" | "=expression", "label": "name", "value": "id"}`. A radio may also name `description` and `image` fields, so choices that come from data (payment methods, plans, delivery slots) show as cards like static ones |
| `value` | Initial value. `"item.name"` fills from the current record, which is how edit forms are prefilled |
| `min`, `max` | For `number` and `date` |
| `accept` | For `file` and `image`: `"image/*"`, `"application/pdf,image/png"` |
| `upload` | For `image`: the [`storage.upload`](api-development.md#file-uploads) API the picked file is sent to |
| `autocomplete` | Browser autofill hint: `name`, `email`, `street-address`, `postal-code`, `current-password`, `new-password`… |
| `className` | Classes on the control itself |

What the server receives: text-like inputs as strings, `number` as a number (or `null` when empty), `checkbox` as `true`/`false`, `radio` as the checked value. A form containing a `file` input is sent as multipart and must post to a [`storage.upload`](api-development.md#file-uploads) API.

### Image uploads in any form

An `image` input is an **Upload image** button instead of a field for a pasted address. The picked file goes to the input's `upload` API at once, a thumbnail shows it, and the field sends the returned url (`/_iwc/files/<id>`) with the rest of the form, which still posts as JSON to its own API. So a settings or product form can hold any number of pictures:

```json iwc:element
{ "type": "form", "inputs": [
  { "name": "name", "type": "text", "label": "Store name" },
  { "name": "logo", "type": "image", "label": "Logo", "upload": "upload.api.iwc", "value": "item.logo" }
], "submit": { "api": "store-save.api.iwc", "label": "Save" } }
```

`value` prefills the current picture (the button then reads **Replace image**); **Remove** clears it. When `accept` allows other files (a PDF), the button reads **Upload file** and no thumbnail is shown. The upload's own limits apply (`app.storage`, the API's `upload.accept` and `maxSize`) and its errors appear under the field. The compiler requires `upload` and checks it is a `storage.upload` API.

## Validation rules

Declared in the API's `request.payload` (and an action's `input`) as **field specs**:

| Rule | Applies to | Error shown |
| --- | --- | --- |
| `type` | `string email url date datetime number integer boolean object array any` | "must be a valid email address", "must be a number", "must be a whole number", "must be true or false", "must be an http(s) URL", "must be a date (YYYY-MM-DD)", "must be a list"… |
| `required` | all | "is required" (missing, `null` or `""`) |
| `default` | all | (applied when missing) |
| `minLength` / `maxLength` | strings | "must be at least 8 characters". Strings are capped at 10,000 characters by default |
| `min` / `max` | numbers | "must be at least 1" |
| `pattern` | strings | "has an invalid format" |
| `enum` | strings, numbers | "is not an allowed value" |
| `minItems` / `maxItems` / `items` | arrays | "must have at least 1 items", per-item errors as `items[0].quantity` |
| `fields` | objects | nested specs |
| `trim` | strings | surrounding whitespace is removed unless `false` |

Emails are lowercased. Any key the API doesn't declare is rejected ("is not an accepted field"), so a form can never write a field it wasn't meant to, such as a `role`.

The response for a failed submission is always:

```json
{ "error": { "code": "validation_failed", "message": "Some fields are invalid", "fields": { "email": "must be a valid email address" } } }
```

Each `fields` entry appears under the input of the same name. The `message` (or an action's `error` text, like "Only 3 left of Oak Stool") appears above the button. While the request is in flight the button is disabled. Network failures show "Network error — please try again".

## Sending client state

```json iwc:element
{
  "type": "form",
  "inputs": [
    { "name": "shipName", "type": "text", "label": "Full name", "required": true },
    { "name": "address", "type": "text", "label": "Street address", "required": true }
  ],
  "submit": {
    "api": "checkout.api.iwc",
    "label": "Place order",
    "include": ["STATE.cart.items"],
    "success": { "mutation": "cart.clear", "navigate": "/checkout/complete" }
  }
}
```

The request body becomes `{"shipName": …, "address": …, "items": [...]}`. The API must declare `items`. The store's checkout action then re-reads every price and stock level from the database, so a tampered cart can't change what is charged.

## Edit forms

Inside a single-record data scope, `value` fills inputs from the record, and an API with `:id` in its path updates it:

```json iwc:element
{
  "type": "section",
  "data": { "source": "DATABASE.notes", "mode": "single", "columns": ["title", "body"], "filter": { "id": { "param": "id" } } },
  "elements": [
    {
      "type": "form",
      "inputs": [
        { "name": "title", "type": "text", "label": "Title", "value": "item.title" },
        { "name": "body", "type": "textarea", "label": "Note", "value": "item.body" }
      ],
      "submit": { "api": "note-update.api.iwc", "label": "Save", "success": { "message": "Saved." } }
    }
  ]
}
```

The form's API path parameters (`/notes/:id`) are filled from the current record, just as for `action: "api"` buttons, so the form updates the record on screen. A `db.update` API (`PATCH /notes/:id`) only writes the fields its payload declares.

## Security you get for free

- A CSRF token is embedded in every form and checked on every cookie-authenticated write. Cross-origin posts are refused.
- Sign-in and registration are rate-limited (10/minute per IP and per account by default); add `"rateLimit"` to any other API.
- Values are only ever bound as database parameters, never concatenated into SQL.

## Common mistakes

| Message | Fix |
| --- | --- |
| `forms submit to POST/PUT/PATCH/DELETE apis; x.api.iwc is GET` | Point the form at a write API |
| `form elements need "submit": {"api": ...}` | Add `submit` |
| `mutation is written store.mutation` | `"mutation": "cart.clear"` |
| `use "navigate" or "redirect", not both` | Pick one |
| `items[0].slug is not an accepted field` (dev log) | The included state has a field the API doesn't declare. Declare it (as display-only) or don't store it |
| 403 `csrf` | A raw HTTP client must send `X-IWC-CSRF`, or use a bearer token (see [authentication](authentication.md)) |
