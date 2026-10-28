# AvishkarSeth.github.io
I build physical systems that operate in the real world.

I'm [Avishkar Seth](https://avishkarseth.github.io/#home), a Robotics Research Engineer at Macquarie University. My work sits at the edge of aerial autonomy, sensing systems, and hardware-software integration. Simulations set the baseline, but my focus is getting hardware off the bench, testing under real physical constraints, and iterating fast until it works reliably in the field.

What I do:

Field Robotics & Autonomy: Prototyping and deploying autonomous aerial systems built for complex, real-world environments.

Engineering Execution: Leading teams through hands-on build loops, fast feedback, and practical problem-solving. No egos, just getting the job done.

Technology to Impact: Bridging technical breakthroughs with commercial viability to build solutions that actually scale.

Driven by curiosity and a bias for physical reality. Always open to connecting with engineers, founders, and teams building critical technology that moves atoms, not just bits.

---

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
