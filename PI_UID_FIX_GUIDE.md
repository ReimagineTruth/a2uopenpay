# Pi Network UID Fix Guide

## Problem Analysis

Based on the error logs, the issue is **NOT** just about UID format - it's about **invalid user UIDs**.

### Key Findings from Logs:

1. **Empty UID in API calls**: The error shows `"User with uid  was not found"` - the UID is completely empty
2. **UUID format being used**: Your logs show UUIDs like `ccecc12e-76d1-41f4-a099-9173cce0c9f0` as `piUsername`
3. **These are NOT Pi Network UIDs**: These appear to be Supabase user IDs, not Pi Network user UIDs

## The Real Issue

Your application is passing **Supabase user IDs** (UUIDs) to the Pi Network API instead of **Pi Network user UIDs**.

Pi Network UIDs are typically:
- Pi usernames (like `Wain2020`) 
- Or specific Pi Network user identifiers
- **NOT** random UUIDs

## Solution Options

### Option 1: Store Pi Network UID During Authentication

When users authenticate with your app, you need to capture and store their actual Pi Network UID:

```typescript
// During Pi Network authentication flow
const piUser = await pi.authenticate();
const piUid = piUser.uid; // This is the real Pi Network UID

// Store this in your database alongside the Supabase user ID
await supabase.from('user_profiles').insert({
  supabase_user_id: userId,
  pi_uid: piUid,
  pi_username: piUser.username
});
```

### Option 2: Update Your Frontend to Send Correct UID

Modify your frontend to send the actual Pi Network UID instead of the Supabase user ID:

```typescript
// Frontend should send the Pi Network UID obtained during authentication
const payoutRequest = {
  amount: 0.01,
  piUsername: user.pi_uid, // Use stored Pi Network UID, not Supabase ID
  memo: "Test payout"
};
```

### Option 3: UID Mapping System

Create a mapping table to associate Supabase IDs with Pi Network UIDs:

```sql
CREATE TABLE user_pi_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID REFERENCES auth.users(id),
  pi_uid TEXT NOT NULL,
  pi_username TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Immediate Fix Steps

1. **Apply the database migration** to add the `pi_uid` column:
   ```sql
   -- Run the database_migration.sql file
   ```

2. **Update your authentication flow** to capture and store Pi Network UIDs

3. **Modify the payout function** to use the stored Pi Network UID

4. **Test with a real Pi Network user** who has authenticated through your app

## Testing the Fix

Use the Ruby validation script to test different UID formats:

```bash
ruby validate_uid.rb
```

This will help you identify the correct UID format that Pi Network expects.

## Important Notes

- **Supabase user IDs ≠ Pi Network UIDs**: These are completely different systems
- **Pi Network UIDs come from Pi authentication**: You must capture them during the Pi Network login flow
- **The UUIDs in your logs are internal database IDs**, not Pi Network identifiers

## Next Steps

1. Check how users authenticate in your application
2. Ensure you're capturing the Pi Network UID during authentication
3. Store the Pi Network UID in your database
4. Update the payout function to use the correct UID
5. Test with real Pi Network users
