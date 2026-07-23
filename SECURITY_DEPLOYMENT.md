# Security deployment gates

These checks are mandatory before a production release. They intentionally do
not change local test credentials or the local development signup workflow.

## Authentication

- Disable public signup in the deployed Supabase Auth project.
- Require a production password policy of at least 12 characters and breached
  password protection.
- Enable secure password change and MFA for platform and organization
  administrators.
- Keep refresh-token rotation enabled, use a short JWT lifetime, and define
  absolute and inactivity session limits at the identity-provider boundary.
- Verify the deployed Auth configuration directly; `supabase/config.toml` is a
  local-development configuration and is not evidence of production settings.

## Application origin and proxy

- Set `APP_ORIGIN` to the single canonical HTTPS origin.
- Set `TRUST_PROXY_HEADERS=1` only when the application is behind a proxy that
  overwrites forwarded headers. Leave it disabled for direct hosting.
- Production now emits an enforcing CSP. Development keeps report-only mode for
  local tooling. Run a production browser smoke test before every release.

## Database and storage

- Apply migrations 128 through 132 using the deployment migration role.
- Run `npm run test:security-catalog` against the target database.
- Confirm that both `postgres` and `supabase_admin` default ACLs grant no
  privileges to `anon` or `authenticated`.
- Confirm that `inventory-item-photos` is private and anonymous object access
  fails.

## Release evidence

- `npm run security:release-check` passes with the production environment.
- `REQUIRE_SMS_PROVIDER=1 npm run test:sms` passes against the configured phone provider.
- Supabase Auth settings are inspected in the deployed project; the local
  repository cannot prove remote Auth settings.
- `npm audit --omit=dev` returns zero known vulnerabilities.
- Focused security and database integration tests pass.
- The complete build and test suite pass, or unrelated baseline failures have a
  named owner and a separately approved exception.
