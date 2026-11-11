# SEO and sharing

IWC pages are rendered on the server, so search engines, social networks and AI crawlers read the finished content without running any script. On top of that, IWC writes the technical metadata for you: titles and descriptions, canonical links, robots rules, Open Graph and Twitter tags, structured data, `robots.txt`, `sitemap.xml` and correct status codes. None of it adds JavaScript.

## Site settings

```json iwc:app
{
  "name": "Field Notes",
  "head": { "title": "%s · Field Notes", "description": "Essays on making things.", "lang": "en" },
  "seo": {
    "siteUrl": { "env": "SITE_URL" },
    "siteName": "Field Notes",
    "image": "/assets/share.png",
    "twitter": "@fieldnotes",
    "robots": { "disallow": ["/search"] },
    "structuredData": { "@context": "https://schema.org", "@type": "Organization", "name": "Field Notes", "url": "https://notes.example.com" }
  }
}
```

| Property | Meaning |
| --- | --- |
| `siteUrl` | The public address, including any base path, with no trailing slash. A literal or `{"env": "NAME"}`. Canonical links, `og:url`, sharing images and the sitemap are absolute URLs under it. Without it, canonical links and `og:url` are left out, and the sitemap uses the request's own host |
| `siteName` | `og:site_name` (default: the app's `name`) |
| `image` | The sharing image for pages without their own |
| `twitter` | `twitter:site` |
| `index` | `false` keeps search engines away (for a staging site): `robots.txt` disallows everything and every page says `noindex, nofollow` |
| `sitemap` | `false` turns off `/sitemap.xml` |
| `robots.disallow` | Extra paths `robots.txt` asks crawlers to skip |
| `structuredData` | JSON-LD on every page. Values may be [expressions](expressions.md) |

## Per page

```json iwc:ui
{
  "name": "Article",
  "route": "/articles/:slug",
  "data": { "article": { "source": "DATABASE.articles", "mode": "single", "required": true, "filter": { "slug": { "param": "slug" }, "draft": false }, "include": { "author": {} } } },
  "title": "=article.title",
  "description": "=article.summary",
  "meta": { "type": "article", "image": "=article.cover" },
  "structuredData": {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "=article.title",
    "datePublished": "=article.publishedAt",
    "dateModified": "=article.updatedAt",
    "author": { "@type": "Person", "name": "=article.author.name" }
  },
  "sections": [{ "type": "text", "variant": "h1", "content": "=article.title" }]
}
```

| Property | Meaning |
| --- | --- |
| `title`, `description` | Literal text or expressions over [page data](expressions.md#page-data). `head.title`'s `%s` wraps the title |
| `canonical` | Overrides the canonical URL (a path or an expression). By default it is the page's own path. The query string is dropped, except a pagination parameter past page 1 (page 2 is its own document) |
| `meta.image` | `og:image`. A path becomes absolute under `siteUrl` |
| `meta.type` | `og:type` (default `website`) |
| `meta.robots` | The robots meta, e.g. `noindex`. Pages behind sign-in (`auth`, `roles`) are `noindex` automatically |
| `structuredData` | JSON-LD (an object, or a list of them). Values may be expressions. A key whose value is `null` or empty is **dropped**, so a missing field never becomes an empty claim |
| `sitemap` | `false` leaves the page out of the sitemap; an object lists its URLs (below) |

The tags are written into `<head>` and marked so that [SPA navigation](routing-and-navigation.md#spa-navigation) replaces them when it changes screens. Structured data is written inside a non-executable `<script type="application/ld+json">`, with `<`, `>` and `&` escaped so content can't end the element.

IWC writes only what you declare, from your real data. It never invents ratings, reviews, prices or authors.

## Status codes

- An unknown URL answers **404** with your `notFound` screen.
- A page whose `required` page data finds nothing (or nothing the visitor may read) answers **404** too, so `/products/no-such-thing` is not a soft 404 that search engines index.
- A protected page sends signed-out visitors to sign in (303), and signed-in visitors without the role get 403.

## robots.txt

`/robots.txt` is generated:

```
User-agent: *
Disallow: /_iwc/
Disallow: /api/
Disallow: /search

Sitemap: https://notes.example.com/sitemap.xml
```

Protected areas are not listed (robots.txt is public, so listing them would only advertise them). They are `noindex` instead.

## sitemap.xml

`/sitemap.xml` lists:

- every page without route parameters that a signed-out visitor can open, except the `notFound` screen, pages marked `noindex` and pages with `"sitemap": false`;
- one URL per record for pages with parameters. When a page's data fills each parameter from a field (`"filter": {"slug": {"param": "slug"}}`), IWC lists the records that page can show, using the same source and literal filters. Otherwise give it a `sitemap`:

```json iwc:ui
{
  "name": "Event",
  "route": "/events/:year/:slug",
  "sitemap": { "source": "DATABASE.events", "filter": { "public": true }, "params": { "year": "=slice(startsAt, 0, 4)", "slug": "=slug" }, "lastmod": "=updatedAt" },
  "sections": []
}
```

Records are read as a signed-out visitor would read them: owner rules, roles and tenancy all apply, so the sitemap never lists a record the visitor can't open. `lastmod` defaults to the record's `updatedAt`. A sitemap holds at most 50,000 URLs (the protocol's limit for one file); beyond that it is truncated and the server logs a warning.

## Semantic HTML

Text variants map to real headings (`h1`–`h6`), lists to `ul`/`li`, navigation to `nav`, the page content to `main`, and links to `<a href>`, so internal navigation is crawlable even though IWC moves between screens without reloading. `iwc check` warns about images without `alt` text and pages with more than one `h1`.
