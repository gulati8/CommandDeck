# Privacy & Data Compliance Checklist

Use this checklist to evaluate privacy, data handling, and compliance risks during feature work.

## Data Inventory
- [ ] Identify data types collected (PII, PHI, financial, telemetry)
- [ ] Document data sources and destinations (client, server, third parties)
- [ ] Map data flows and storage locations

## Collection & Minimization
- [ ] Collect only required fields
- [ ] Avoid sensitive fields unless necessary
- [ ] Provide defaults that reduce data capture

## Consent & Transparency
- [ ] User consent/notice documented where required
- [ ] Privacy policy updates flagged (if applicable)
- [ ] Purpose of processing is explicit

## Retention & Deletion
- [ ] Retention period defined
- [ ] Deletion workflow exists (user request or TTL)
- [ ] Backups and logs follow retention policy

## Access & Security
- [ ] Access controls reviewed (least privilege)
- [ ] Sensitive data masked/redacted in logs
- [ ] Encryption at rest and in transit validated

## Third-Party Sharing
- [ ] Third-party processors identified
- [ ] Data processing agreements reviewed (if required)
- [ ] Data exports are scoped and auditable

## Regional Compliance
- [ ] GDPR/CCPA applicability considered
- [ ] Data residency constraints captured
- [ ] Cross-border transfer risks documented

## Testing & Monitoring
- [ ] Tests cover redaction and data handling
- [ ] Audit logging enabled for sensitive operations
