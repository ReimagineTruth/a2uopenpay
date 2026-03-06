# Pi Network A2U Testing with Node.js

## Quick Setup

### 1. Install Dependencies
```bash
npm install pi-backend
```

### 2. Run the Node.js Test
```bash
node a2u_payout_nodejs.mjs
```

## What This Script Does

The `a2u_payout_nodejs.mjs` script will:

1. **Test the problematic UID**: Confirms that `ccecc12e-76d1-41f4-a099-9173cce0c9f0` (Supabase UUID) fails
2. **Test correct formats**: Ties different UID formats for "Wain2020":
   - `Wain2020` (plain username)
   - `@Wain2020` (with @ prefix)
   - `wain2020` (lowercase)
   - `@wain2020` (lowercase with @)
3. **Complete A2U flow**: For working UIDs, it tests the full payment process
4. **Auto-cancel**: Test payments are automatically cancelled to avoid charges

## Expected Results

### If UID Format Works:
```
🎉 SUCCESS! UID format 'Wain2020' works correctly!
Payment ID: abc123...
Transaction ID: def456...
```

### If UID Format Fails:
```
✗ Failed: User with uid was not found. Please check the uid again.
→ This UID format is INVALID
```

## Troubleshooting

### If All UID Formats Fail:
1. **Check user existence**: Verify "Wain2020" is a real Pi Network user
2. **App permissions**: Ensure your app has A2U payment permissions
3. **User authorization**: Confirm the user has authorized your app
4. **Network**: Check if you're on the correct network (testnet vs mainnet)

### Common Errors:
- `"User with uid was not found"`: Invalid UID format or user doesn't exist
- `"You need to complete the ongoing payment first"`: Existing incomplete payment
- API key errors: Invalid or expired API credentials

## Next Steps After Testing

1. **Find working UID**: The script will tell you which format works
2. **Update database**: Store the correct Pi Network UID
3. **Fix your code**: Use the working UID format in your application

```sql
-- Example SQL fix if "Wain2020" works:
UPDATE user_profiles SET pi_uid = 'Wain2020' WHERE pi_username = 'Wain2020';
```

## Alternative: Ruby Version

If you prefer Ruby, you can also run:
```bash
ruby a2u_payout_working.rb
```

Both scripts test the same functionality but use different Pi Network SDKs.
