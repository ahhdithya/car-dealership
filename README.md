# Car Dealership Inventory System

A full-stack inventory application being developed for the Incubyte
TDD kata using TypeScript, Express, PostgreSQL, React, and Tailwind CSS.

## Current Status

Development environment setup is in progress. Business features have
not yet been implemented.

Verified locally:

- Node.js, npm, Git, and PostgreSQL are available.
- Separate development and test database accounts can connect.
- Backend type checking, linting, and formatting checks pass.
- Two backend tests pass, including a real PostgreSQL connection test.
- One frontend rendering test passes.
- The React frontend builds successfully.
- Development and production-preview pages display correctly.
- Local environment files are excluded from Git.

A GitHub Actions workflow has been configured but has not yet been
executed or verified remotely.

## Planned Features

- User registration and token-based login.
- Vehicle listing and filtering by make, model, category, and price.
- Purchasing one unit of a vehicle while preventing negative stock.
- Administrator controls for creating, editing, deleting, and restocking vehicles.
- A responsive React interface with disabled purchase controls for zero stock.

## Permission Interpretation

The assignment explicitly restricts deletion and restocking to admins
and places vehicle creation and editing in the admin interface.

This implementation will consistently restrict creation, editing,
deletion, and restocking to admins. Authenticated users may browse,
search, and purchase vehicles.

Public registration will create ordinary users only.

## Planned Technology Stack

- Frontend: React, TypeScript, Vite, HTML5, CSS3, Tailwind CSS.
- Backend: Node.js, TypeScript, Express.
- Database: PostgreSQL with parameterized SQL.
- Authentication: JWT and Argon2id password hashing.
- Validation: Zod.
- Testing: Vitest, Supertest, React Testing Library, Playwright.
- Quality checks: TypeScript, ESLint, Prettier.
- Continuous integration: GitHub Actions.

## Repository Structure

- `backend/`: API, business logic, database access, and backend tests.
- `frontend/`: React application and component tests.
- `e2e/`: planned browser workflow tests.
- `docs/`: planned requirements, architecture, decisions, and test evidence.

Directories will be created progressively as their functionality is developed.

## Development Workflow

Features will be implemented incrementally using Red-Green-Refactor:

1. Write a behavioral test.
2. Run it and verify that it fails for the intended reason.
3. Implement the smallest correct solution.
4. Run the relevant tests.
5. Refactor while preserving passing behavior.
6. Review the change and record actual verification results.

## Local Setup

Full installation and startup instructions will be added as the
application tooling is configured and verified.

Development and test databases are separate:

- Development: `dealership_dev`
- Test: `dealership_test`

Credentials belong in ignored local environment files.
Do not commit passwords, tokens, or connection strings containing secrets.

## Testing

Run commands from the repository root:

```powershell
npm.cmd run format:check
npm.cmd run lint
npm.cmd run typecheck --workspace=@car-dealership/backend
npm.cmd run test --workspace=@car-dealership/backend
npm.cmd run test --workspace=@car-dealership/frontend
npm.cmd run build --workspace=@car-dealership/frontend
```

The database integration test requires a running local PostgreSQL server
and an ignored `backend/.env.test` file configured for `dealership_test`
with the `dealership_test_user` account.

Latest verified local results:

- Backend: 2 tests passed.
- Frontend: 1 test passed.
- Formatting, linting, type checking, and frontend build: passed.

These tests verify infrastructure and the starter screen. They do not
establish that authentication or inventory functionality is implemented.

CI provisions its own disposable test database. Remote execution remains
unverified until a GitHub Actions run succeeds.

## My AI Usage

### Tools Used

ChatGPT has assisted with project planning and development setup.

### Assistance So Far

- Analysis of the assignment and job description.
- Requirements, architecture, and technology recommendations.
- Step-by-step Windows and PostgreSQL setup guidance.
- Initial npm workspace configuration and documentation drafts.

Local commands have been executed by the developer, with terminal
outputs supplied for review. Suggested behavior and expected results
are distinguished from verified execution.

### Reflection So Far

AI assistance has provided structured explanations and setup guidance.
Its suggestions still require review, local execution, and testing.
The effect on implementation quality has not yet been evaluated because
application development has not started.

### Conversation Records

The required root `PROMPTS.md` will contain actual raw AI conversation
records or public conversation links before submission. Generated
summaries will not substitute for those records.

## Submission Status

Pending:

- Application implementation.
- Automated tests and test report.
- Final setup and execution instructions.
- Application screenshots.
- Complete AI conversation records.
- Final repository review.

Live deployment is optional and has not been performed.
