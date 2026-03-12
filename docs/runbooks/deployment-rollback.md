# Deployment rollback runbook

- Validate alert source and blast radius.
- Freeze production writes if data integrity is at risk.
- Promote previous stable release using `/api/deploy` with `status=rolled_back`.
- Verify tracing and error budget panels recover.
- Publish customer update and incident summary.
