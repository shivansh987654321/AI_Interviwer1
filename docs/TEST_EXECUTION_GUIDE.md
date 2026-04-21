# Test Execution Guide

## Objective
Use this guide with the master suite in docs/MASTER_TEST_CASES_150.md to prevent production failures.

## Environment Prep
1. Start backend:
   - cd backend
   - /tmp/apache-maven-3.9.6/bin/mvn clean spring-boot:run
2. Start frontend:
   - cd frontend
   - npm install
   - npm run dev
3. Confirm health:
   - GET http://localhost:5001/api/interview/health
   - Open http://localhost:3000

## Recommended Automation Order
1. P0 backend integration cases
2. P0 socket realtime cases
3. P0 auth/security cases
4. P1 regression coverage
5. P2 edge and soak coverage

## Suggested Tooling to Add
- Backend: JUnit5 + MockMvc + SpringBootTest + JaCoCo
- Frontend: Jest + React Testing Library
- E2E: Playwright
- Load: k6 or Artillery

## Release Gate
- Must pass: All P0 cases
- Conditional pass: Max 2 P1 failures with approved mitigation
- Auto block: Any P0 auth, security, socket, or session failure

## Daily Smoke Run
Execute the 20 smoke IDs defined at the bottom of docs/MASTER_TEST_CASES_150.md.

## Tracking Template
For each run, capture:
- Test ID
- Build version
- Environment
- Result (PASS/FAIL/BLOCKED)
- Evidence (screenshot/log/link)
- Owner
- Defect ID (if failed)

## Defect Severity Mapping
- Critical: Any P0 fail in auth, security, realtime, data integrity
- High: Other P0 fail or repeated P1 fail in same area
- Medium: Single P1 fail with workaround
- Low: P2 fail
