import PiNetwork from 'pi-backend';

// DO NOT expose these values to public
const apiKey = "okebrorkawmpe9t1yy0a5iybng31m8w9acpcurcafsi3cvilhk4lmnr0r2z7pasw";
const walletPrivateSeed = "SA7HAEE64IDWFQ2MSXO5AK355PBVRMBCZOLDNAWTMY5JK3LPBQ7MYQO6"; // starts with S

const pi = new PiNetwork(apiKey, walletPrivateSeed);

console.log("=== Pi Network A2U Payout Test (Node.js) ===");
console.log("API Key:", apiKey.substring(0, 20) + "...");
console.log("Wallet Seed:", walletPrivateSeed.substring(0, 20) + "...");
console.log("=".repeat(50));

// Test different UID formats for user "Wain2020"
const testUids = [
  "Wain2020",                           // Plain username (most likely correct)
  "@Wain2020",                          // Username with @ prefix
  "wain2020",                           // Lowercase
  "@wain2020",                          // Lowercase with @
];

async function testUidFormat(uid, index) {
  console.log(`\n${index + 1}. Testing UID format: '${uid}'`);
  
  try {
    // Step 1: Create A2U payment
    console.log("  Creating payment...");
    const paymentData = {
      amount: 0.01,
      memo: "Test A2U payout to Wain2020",
      metadata: {
        test: true,
        uid_format: uid,
        timestamp: Date.now()
      },
      uid: uid
    };
    
    const paymentId = await pi.createPayment(paymentData);
    console.log(`  ✓ Payment created successfully: ${paymentId}`);
    
    // Step 2: Submit payment to blockchain
    console.log("  Submitting to blockchain...");
    const txid = await pi.submitPayment(paymentId);
    console.log(`  ✓ Transaction submitted: ${txid}`);
    
    // Step 3: Complete the payment
    console.log("  Completing payment...");
    const payment = await pi.completePayment(paymentId, txid);
    console.log("  ✓ Payment completed successfully!");
    console.log(`  Status: ${JSON.stringify(payment.status)}`);
    console.log(`  Network: ${payment.network}`);
    
    console.log(`\n🎉 SUCCESS! UID format '${uid}' works correctly!`);
    console.log(`Payment ID: ${paymentId}`);
    console.log(`Transaction ID: ${txid}`);
    console.log("Use this UID format for future payouts to Wain2020");
    
    return { success: true, uid, paymentId, txid };
    
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}`);
    
    if (error.message.includes("User with uid was not found")) {
      console.log("  → This UID format is INVALID");
    } else if (error.message.includes("You need to complete the ongoing payment first")) {
      console.log("  → This UID format might be valid, but there's an existing payment");
      
      // Try to handle incomplete payments
      try {
        console.log("  → Checking for incomplete payments...");
        const incomplete = await pi.getIncompleteServerPayments();
        if (incomplete && incomplete.length > 0) {
          console.log("  → Found incomplete payment, attempting to complete...");
          const incompletePayment = incomplete[0];
          if (incompletePayment.transaction && incompletePayment.transaction.txid) {
            await pi.completePayment(incompletePayment.identifier, incompletePayment.transaction.txid);
            console.log("  → Incomplete payment completed, retrying...");
            return testUidFormat(uid, index); // Retry after completing
          } else {
            console.log("  → Cannot complete incomplete payment (no transaction)");
          }
        }
      } catch (completeError) {
        console.log(`  → Failed to handle incomplete payment: ${completeError.message}`);
      }
    } else {
      console.log("  → Other error occurred");
    }
    
    return { success: false, uid, error: error.message };
  }
}

async function testProblematicUid() {
  console.log("\n" + "=".repeat(50));
  console.log("Testing the problematic UID from your logs:");
  
  const problematicUid = "ccecc12e-76d1-41f4-a099-9173cce0c9f0";
  console.log(`❌ Problematic UID: ${problematicUid}`);
  console.log("This is a Supabase UUID, NOT a Pi Network UID");
  
  try {
    const paymentData = {
      amount: 0.001,
      memo: "Test with problematic Supabase UUID",
      metadata: {
        test_type: "problematic_uid",
        uid_type: "supabase_uuid",
        timestamp: Date.now()
      },
      uid: problematicUid
    };
    
    const paymentId = await pi.createPayment(paymentData);
    console.log(`❌ Unexpected success with problematic UID: ${paymentId}`);
    
    // Cancel immediately if it somehow worked
    await pi.cancelPayment(paymentId);
    console.log("  → Test payment cancelled");
    
  } catch (error) {
    if (error.message.includes("User with uid was not found")) {
      console.log("✅ Confirmed: Supabase UUID is NOT a valid Pi Network UID");
      console.log(`   Error: ${error.message}`);
    } else {
      console.log(`⚠ Different error: ${error.message}`);
    }
  }
}

async function runTests() {
  // First test the problematic UID
  await testProblematicUid();
  
  console.log("\n" + "=".repeat(50));
  console.log("Testing correct Pi Network UID formats for 'Wain2020':");
  
  // Test each UID format
  for (let i = 0; i < testUids.length; i++) {
    const result = await testUidFormat(testUids[i], i);
    
    if (result.success) {
      console.log("\n" + "=".repeat(50));
      console.log("🎉 FOUND WORKING SOLUTION!");
      console.log(`✅ Working UID for 'Wain2020': ${result.uid}`);
      console.log(`✅ Payment ID: ${result.paymentId}`);
      console.log(`✅ Transaction ID: ${result.txid}`);
      
      console.log("\nTo fix your application:");
      console.log("1. Update your database to store the correct Pi Network UID");
      console.log("2. Use this UID instead of the Supabase UUID for payouts");
      console.log(`3. SQL fix: UPDATE user_profiles SET pi_uid = '${result.uid}' WHERE pi_username = 'Wain2020';`);
      
      return; // Exit after finding working solution
    }
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("❌ No UID format worked for user 'Wain2020'");
  console.log("\nPossible reasons:");
  console.log("1. 'Wain2020' is not a valid Pi Network user");
  console.log("2. Your app doesn't have proper A2U permissions");
  console.log("3. The user hasn't authenticated with your app properly");
  console.log("4. The Pi Network UID is completely different from the username");
  
  console.log("\nNext steps:");
  console.log("1. Check your Pi Network app dashboard for user authentication");
  console.log("2. Verify the user exists and has authorized your app");
  console.log("3. Look at the actual UID returned during authentication");
}

// Run all tests
runTests().catch(console.error);
