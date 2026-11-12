# Deploy Blocks to Cloudflare

Blocks deploys as a Cloudflare Worker with a D1 database. It is not a static Pages upload because time entries need persistent storage.

## First deployment

1. Install Node.js 22.13.0 or newer and open a terminal in this `Blocks-Cloudflare/` folder.
2. Run `npm run install:ci` and then `npx wrangler login`.
3. Copy the example configuration. The real file name is ignored by Git, so your IDs stay local:

   ```text
   cp wrangler.example.jsonc wrangler.cloudflare.jsonc
   ```

4. Replace `<YOUR_CLOUDFLARE_ACCOUNT_ID>` in `wrangler.cloudflare.jsonc` with your Cloudflare account ID (`npx wrangler whoami` prints it).
5. Create the database with `npx wrangler d1 create blocks-time-tracker-db` and copy the returned `database_id` into `wrangler.cloudflare.jsonc`, replacing `<YOUR_D1_DATABASE_ID>`.
6. Build, apply every migration in filename order, and deploy:

   ```text
   npm run build
   npx wrangler d1 execute blocks-time-tracker-db --remote --config wrangler.cloudflare.jsonc --file drizzle/0000_dry_roughhouse.sql
   npx wrangler d1 execute blocks-time-tracker-db --remote --config wrangler.cloudflare.jsonc --file drizzle/0001_clumsy_silverclaw.sql
   npx wrangler d1 execute blocks-time-tracker-db --remote --config wrangler.cloudflare.jsonc --file drizzle/0002_nappy_siren.sql
   npx wrangler deploy --config wrangler.cloudflare.jsonc
   ```

Wrangler prints the live URL when deployment finishes.

## Add login without building authentication

Use Cloudflare Access as the login gate:

1. In Cloudflare Zero Trust, open **Access → Applications → Add an application → Self-hosted**.
2. Enter the hostname you will use for Blocks. A custom domain on the Worker is the clearest setup.
3. Add an **Allow** policy containing only the email addresses that should use the app.
4. Choose an identity provider, or enable the one-time PIN option for email login.

Access sends the verified email to Blocks, and Blocks uses it to keep each user's data separate. Blocks has no password system of its own and trusts the identity header that Access adds, so **every** hostname that reaches the Worker must sit behind Access. In the Worker's settings, disable the default Worker subdomain route and preview URLs, or protect them with the same Access application. Never expose the Worker publicly without Access.

## Later updates

After changing the source, run:

```text
npm run build
npx wrangler deploy --config wrangler.cloudflare.jsonc
```

Only run a new SQL migration when an update adds one. Apply each migration once per database, in filename order.
