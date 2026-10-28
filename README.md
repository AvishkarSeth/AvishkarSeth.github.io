# Avishkar Seth - personal site

Jekyll site served by GitHub Pages at https://avishkarseth.github.io.

## Where to edit

| To change | Edit |
|---|---|
| Publications on the Research page | `_data/publications.yml` |
| Courses on the Teaching page | `_data/teaching.yml` |
| Homepage News | `_data/news.yml` (newest first, top 4 shown) |
| Navigation / footer social links | `_data/nav.yml`, `_data/social.yml` |
| Page shell (head, header, footer) | `_layouts/site.html`, `_includes/` |
| Site-wide title, description, URL | `_config.yml` |

Each page sets `layout: site`, `title`, `description`, `nav` and `section` in its front matter.

## Images

Use WebP, max about 1600 px wide, and give every image meaningful `alt` text. Keep the whole repo well under GitHub Pages' 1 GB limit.

## Local preview

    bundle install
    bundle exec jekyll serve
