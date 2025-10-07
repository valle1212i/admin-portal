# Customer Portal → Admin Portal Integration Guide

## Overview
This guide explains how to send ad briefs from the customer portal to the admin portal for centralized management.

## Environment Variables (Customer Portal)

Set these in your customer portal deployment:

```bash
ADMIN_INGEST_URL=https://admin-portal-rn5z.onrender.com/admin/api/ingest/ads
ADMIN_SHARED_SECRET=531270ad3174be71ac17c5f0c18f433b93e57c145f096b36d04dcf1f5f4e7d6a
```

## Payload Contract

When a user submits a marketing brief, POST to `ADMIN_INGEST_URL` with:

### Required Fields
- `idempotencyKey`: Unique identifier per submission (prevents duplicates)
- `platform`: One of `google`, `meta`, `tiktok`, `linkedin`
- `tenantId`: Customer/tenant identifier (e.g., `vattentrygg`)
- `answers`: Object with brief responses
  - `q1`, `q2`, `q3`, `q4`, `q5`, `q6`, `q7`: Question responses
  - `extraInfo`: Additional notes

### Optional Fields
- `userEmail`: Submitter's email
- `userId`: Submitter's user ID
- `meta`: Additional metadata object

## Authentication

Include these headers:
- `Content-Type: application/json`
- `x-signature: sha256=<HMAC_HEX>`

### HMAC Calculation
Sign the raw UTF-8 request body using `ADMIN_SHARED_SECRET`:

```javascript
const crypto = require('crypto');
const body = JSON.stringify(payload);
const signature = 'sha256=' + crypto.createHmac('sha256', ADMIN_SHARED_SECRET)
  .update(body)
  .digest('hex');
```

## Example Implementation

```javascript
async function sendBriefToAdmin(briefData) {
  const payload = {
    idempotencyKey: `brief-${Date.now()}-${briefData.userId}`,
    platform: briefData.platform,
    tenantId: briefData.tenantId,
    answers: {
      q1: briefData.goal,
      q2: briefData.budget,
      q3: briefData.targetAudience,
      q4: briefData.timeline,
      q5: briefData.brandGuidelines,
      q6: briefData.competitors,
      q7: briefData.successMetrics,
      extraInfo: briefData.additionalNotes
    },
    userEmail: briefData.userEmail,
    userId: briefData.userId
  };

  const body = JSON.stringify(payload);
  const signature = 'sha256=' + crypto.createHmac('sha256', process.env.ADMIN_SHARED_SECRET)
    .update(body)
    .digest('hex');

  const response = await fetch(process.env.ADMIN_INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-signature': signature
    },
    body
  });

  if (!response.ok) {
    throw new Error(`Admin ingest failed: ${response.status}`);
  }
}
```

## Response Codes

- `204 No Content`: Success (brief ingested)
- `400 Bad Request`: Invalid payload or missing idempotencyKey
- `401 Unauthorized`: Invalid signature
- `429 Too Many Requests`: Rate limited (60 requests/minute per IP)

## Verification

After sending a brief:
1. Check admin portal: `admin-marknadsforing.html`
2. Verify "Antal briefs" count increases
3. Confirm brief appears in the list with correct platform and timestamp

## Troubleshooting

### Customer Portal Logs
- Look for `[ADS PUSH] Skipping: ADMIN_INGEST_URL/ADMIN_SHARED_SECRET saknas` (should be gone after env setup)
- Check for network errors or HTTP status codes

### Admin Portal Logs
- Look for `[INGEST] error:` messages
- Verify `ADMIN_SHARED_SECRET` matches between both apps

### Common Issues
- **401 Unauthorized**: Secret mismatch or incorrect HMAC calculation
- **400 Bad Request**: Missing idempotencyKey or malformed JSON
- **Empty briefs list**: Check if briefs are being sent to correct URL

## Database Configuration (Optional)

If reading directly from customer portal DB instead of webhook:

```bash
ADS_DBNAME=customer_portal_db_name
ADS_COLLECTIONS=ads,adbriefs,marketingBriefs
```

Use `GET /api/admin/ads/_debug` to verify available collections and counts.
