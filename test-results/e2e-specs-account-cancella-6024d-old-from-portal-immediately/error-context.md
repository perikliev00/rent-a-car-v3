# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e\specs\account-cancellation.spec.ts >> account-cancel-hold >> CUST-005 Cancel own active hold immediately >> customer cancels pending_payment hold from portal immediately
- Location: e2e\specs\account-cancellation.spec.ts:41:9

# Error details

```
Error: apiRequestContext.get: connect ECONNREFUSED ::1:3000
Call log:
  - → GET http://localhost:3000/api/v1/auth/csrf
    - user-agent: Playwright/1.61.1 (x64; windows 10.0) node/22.17
    - accept: */*
    - accept-encoding: gzip,deflate,br

```