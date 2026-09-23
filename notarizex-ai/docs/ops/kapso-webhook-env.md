# Kapso webhook environment

Production Netlify Functions require the following secret environment variables with context `production` and scope `functions`:

- `KAPSO_PROJECT_WEBHOOK_SECRET`
- `KAPSO_MESSAGE_WEBHOOK_SECRET`

These values are managed in Netlify and must never be committed to the repository.
