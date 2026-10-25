# Test Report

## Final Verification

- Verification date: 25 October 2026
- Tested commit: `REPLACE_WITH_TESTED_COMMIT_SHA`
- [Successful GitHub Actions run](REPLACE_WITH_FINAL_CI_RUN_URL)

## Results

| Check                                   | Result                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Prettier formatting                     | REPLACE_WITH_ACTUAL_RESULT                                                |
| ESLint                                  | REPLACE_WITH_ACTUAL_RESULT                                                |
| Backend TypeScript check                | REPLACE_WITH_ACTUAL_RESULT                                                |
| Backend tests                           | REPLACE_WITH_PASSED_TEST_COUNT tests across REPLACE_WITH_FILE_COUNT files |
| Frontend tests                          | REPLACE_WITH_PASSED_TEST_COUNT tests across REPLACE_WITH_FILE_COUNT files |
| Frontend production build and typecheck | REPLACE_WITH_ACTUAL_RESULT                                                |

## Automated Test Scope

### Authentication and Accounts

- Registration and login input validation.
- Email normalization and password preservation.
- Argon2id hashing and password verification.
- Duplicate-email rejection.
- JWT signing and verification, including invalid and expired tokens.
- Bearer authentication and administrator authorization.

### Database and Inventory

- Dedicated test database configuration and connection safeguards.
- Database migrations, constraints, history, and rollback.
- Vehicle creation and inventory listing.
- Brand/model/category filtering and inclusive price limits.
- Purchasing the last unit and rejecting purchases when stock is zero.
- Restocking and missing-vehicle handling.
- Administrator editing and deletion.
- Rejection of unauthorized inventory changes.

### Frontend

- Inventory heading and sign-in form rendering.
- Inventory loading after successful login.
- Disabled purchase controls for vehicles with zero stock.
- Administrator creation controls absent from the ordinary-user view.

## Manual Verification

The following flows were checked through the browser without reported failures:

- Registration, login, and sign out.
- Inventory search.
- Administrator vehicle creation, editing, deletion, and restocking.
- Ordinary-user purchasing.
- Zero-stock purchase button disabling.
- Administrator controls hidden from ordinary users.

Screenshots are included in the README.

## Verification Commands

Run from the repository root:

```sh
npm run format:check
npm run lint
npm run typecheck --workspace=@car-dealership/backend
npm run test --workspace=@car-dealership/backend
npm run test --workspace=@car-dealership/frontend
npm run build --workspace=@car-dealership/frontend
```
