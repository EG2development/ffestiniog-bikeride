# Security policy

This repository is a concept visualisation: video and data pipelines that run on a contributor's own machine. There
is no hosted service, no user accounts and no credentials in the build. Security problems are still possible: in the
pipeline scripts that fetch open data, in the Blender and Remotion build scripts, in the CI workflow, and in the
dependencies.

## Supported versions

Only the `main` branch is maintained. There are no versioned releases to patch; fixes land on `main`.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

1. Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
   **Report a vulnerability**. The report is visible only to the maintainers until it is resolved.
2. Include what you found, where (file and line, or the command that triggers it), what it allows, and how to
   reproduce it. A proof of concept is welcome; please do not include real secrets or personal data.
3. You will receive an acknowledgement within seven days. Fixes are published on `main` with a note in the advisory;
   if a CVE is warranted, it is requested through the GitHub advisory.

If private vulnerability reporting is unavailable for any reason, open an issue that says only "security: please
contact me" without details, and a maintainer will reach out.

## What is in scope

- Code in `src/`, `scripts/` and `tests/`, and the CI workflow in `.github/`.
- The data-fetching scripts: they read public endpoints only and must never need or leak credentials.
- Dependency vulnerabilities reachable from the build or render (Dependabot and `npm audit` run on every push).

Out of scope: the accuracy of the route, terrain or captions (those are documented limitations, not security
issues; see `README.md`), and vulnerabilities in third-party services the pipeline reads from.

## Safe harbour

Good-faith research that stays within this repository and does not access other people's data, degrade public
services or exploit the issue beyond demonstrating it will not be reported to the authorities or pursued.
