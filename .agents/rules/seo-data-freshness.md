# Data Freshness, SEO Authenticity & Content Categorization Rules

## 1. No Deceptive Date Auto-Bumping
- **Strict Prohibition**: Never run automated scripts, database queries, or theme overrides that replace original post creation dates (`createdAt` / `post_date`) with the current date (`NOW()`) on static or old historical content.
- **Authentic Timestamps**: Posts must display their true creation date or actual major revision date (`updatedAt`).
- **Googlebot Compliance**: Enforce 100% adherence to Google's Helpful Content & Freshness algorithms to prevent search index de-ranking and bounce-rate spikes.

## 2. Dynamic Content & Grid Filtering Rules
- **Live Latest Alerts Grid**:
  - Filter strictly for active, current-year notifications (`createdAt >= CurrentYear` or active deadline dates).
  - Exclude multi-year static schemes (e.g. 2020-2023 legacy posts) from top live alert feeds.
- **Citizen Utility Services / Static Tools Section**:
  - Move evergreen utility topics (e.g. Aadhar-PAN Link, Learning License, Voter ID, Certificates) into a dedicated "Citizen Services & Tools" section.
  - Maintain clear separation between time-sensitive job alerts and evergreen static tools.

## 3. Title & Content Alignment
- Card titles, badges, and snippet summaries must 100% match the underlying post year, content, and notification context.
