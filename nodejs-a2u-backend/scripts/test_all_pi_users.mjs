import piBackend from 'pi-backend';
import { loadEnv } from '../config/loadEnv.js';

loadEnv();

const PiNetwork = piBackend?.default ?? piBackend;

const apiKey = process.env.PI_API_KEY;
const walletPrivateSeed = process.env.PI_WALLET_PRIVATE_SEED;

if (!apiKey || !walletPrivateSeed) {
  throw new Error('Missing required env vars: PI_API_KEY, PI_WALLET_PRIVATE_SEED');
}

const pi = new PiNetwork(apiKey, walletPrivateSeed);

console.log("=== Comprehensive A2U Test for All Pi Users ===");
console.log("Testing various user scenarios to ensure A2U works for everyone");
console.log("=".repeat(60));

// Test different user scenarios that might occur in production
const testScenarios = [
  {
    name: "Standard Username",
    uids: ["Wain2020", "@Wain2020", "wain2020", "@wain2020"],
    description: "Regular Pi Network user"
  },
  {
    name: "UUID Format Users",
    uids: ["ccecc12e-76d1-41f4-a099-9173cce0c9f0"], // Your current problematic case
    description: "Users with database UUIDs (should fail)"
  },
  {
    name: "Edge Case Usernames",
    uids: ["TestUser123", "user_with_underscores", "User.With.Dots", "USER123"],
    description: "Various username formats"
  },
  {
    name: "Special Characters",
    uids: ["@user123", "user_123", "user-123"],
    description: "Users with special characters"
  },
  {
    name: "Numeric Usernames",
    uids: ["12345", "user12345", "@12345"],
    description: "Numeric-based usernames"
  }
];

async function testUserScenario(scenario, scenarioIndex) {
  console.log(`\n${scenarioIndex + 1}. Testing: ${scenario.name}`);
  console.log(`   Description: ${scenario.description}`);
  console.log(`   UIDs to test: ${scenario.uids.join(', ')}`);
  
  const results = [];
  
  for (let i = 0; i < scenario.uids.length; i++) {
    const uid = scenario.uids[i];
    console.log(`\n   ${i + 1}.1 Testing UID: "${uid}"`);
    
    try {
      // Create a small test payment
      const paymentData = {
        amount: 0.001, // Very small amount
        memo: `Test payment for ${scenario.name} - ${uid}`,
        metadata: {
          test_scenario: scenario.name,
          uid_format: uid,
          timestamp: Date.now(),
          test_type: "comprehensive_a2u"
        },
        uid: uid
      };
      
      const paymentId = await pi.createPayment(paymentData);
      console.log(`     ✓ SUCCESS: Payment created - ${paymentId}`);
      
      // Immediately cancel to avoid charges
      await pi.cancelPayment(paymentId);
      console.log(`     ✓ Test payment cancelled`);
      
      results.push({
        uid: uid,
        success: true,
        paymentId: paymentId,
        error: null
      });
      
      // If we found a working UID for this scenario, we can stop testing other formats
      if (scenario.name === "Standard Username" && results.some(r => r.success)) {
        console.log(`     → Found working UID for ${scenario.name}, skipping remaining formats`);
        break;
      }
      
    } catch (error) {
      console.log(`     ✗ FAILED: ${error.message}`);
      
      results.push({
        uid: uid,
        success: false,
        paymentId: null,
        error: error.message
      });
      
      // Analyze the error
      if (error.message.includes("User with uid was not found")) {
        console.log(`     → This UID format is invalid or user doesn't exist`);
      } else if (error.message.includes("You need to complete the ongoing payment first")) {
        console.log(`     → There's an existing incomplete payment`);
        
        // Try to handle incomplete payments
        try {
          const incomplete = await pi.getIncompleteServerPayments();
          if (incomplete && incomplete.length > 0) {
            console.log(`     → Found ${incomplete.length} incomplete payment(s)`);
            
            for (const incompletePayment of incomplete) {
              if (incompletePayment.transaction && incompletePayment.transaction.txid) {
                try {
                  await pi.completePayment(incompletePayment.identifier, incompletePayment.transaction.txid);
                  console.log(`     → Completed incomplete payment: ${incompletePayment.identifier}`);
                } catch (completeError) {
                  console.log(`     → Failed to complete: ${completeError.message}`);
                }
              } else {
                try {
                  await pi.cancelPayment(incompletePayment.identifier);
                  console.log(`     → Cancelled incomplete payment: ${incompletePayment.identifier}`);
                } catch (cancelError) {
                  console.log(`     → Failed to cancel: ${cancelError.message}`);
                }
              }
            }
            
            // Retry the test after handling incomplete payments
            console.log(`     → Retrying after handling incomplete payments...`);
            i--; // Retry this UID
            continue;
          }
        } catch (incompleteError) {
          console.log(`     → Failed to check incomplete payments: ${incompleteError.message}`);
        }
      } else {
        console.log(`     → Other error: ${error.message.substring(0, 100)}...`);
      }
    }
  }
  
  return results;
}

async function generateReport(allResults) {
  console.log("\n" + "=".repeat(60));
  console.log("COMPREHENSIVE TEST REPORT");
  console.log("=".repeat(60));
  
  let totalTests = 0;
  let successfulTests = 0;
  let failedTests = 0;
  
  const workingFormats = new Set();
  const failedFormats = new Set();
  
  allResults.forEach((scenarioResult, index) => {
    const scenario = testScenarios[index];
    console.log(`\n${index + 1}. ${scenario.name}:`);
    console.log(`   Description: ${scenario.description}`);
    
    scenarioResult.forEach(result => {
      totalTests++;
      if (result.success) {
        successfulTests++;
        workingFormats.add(result.uid);
        console.log(`   ✅ ${result.uid} - SUCCESS (${result.paymentId})`);
      } else {
        failedTests++;
        failedFormats.add(result.uid);
        console.log(`   ❌ ${result.uid} - FAILED (${result.error})`);
      }
    });
  });
  
  console.log(`\nSUMMARY:`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Successful: ${successfulTests} (${((successfulTests/totalTests)*100).toFixed(1)}%)`);
  console.log(`Failed: ${failedTests} (${((failedTests/totalTests)*100).toFixed(1)}%)`);
  
  console.log(`\nWORKING UID FORMATS:`);
  if (workingFormats.size > 0) {
    Array.from(workingFormats).forEach(format => {
      console.log(`   ✅ ${format}`);
    });
  } else {
    console.log(`   ❌ No working formats found`);
  }
  
  console.log(`\nFAILED UID FORMATS:`);
  if (failedFormats.size > 0) {
    Array.from(failedFormats).forEach(format => {
      console.log(`   ❌ ${format}`);
    });
  }
  
  console.log(`\nRECOMMENDATIONS:`);
  
  if (workingFormats.has("Wain2020") || workingFormats.has("@Wain2020")) {
    console.log(`   ✅ Standard usernames work - use plain username format`);
  }
  
  if (failedFormats.has("ccecc12e-76d1-41f4-a099-9173cce0c9f0")) {
    console.log(`   ❌ Database UUIDs don't work - must use Pi Network UIDs`);
  }
  
  if (workingFormats.size > 0) {
    console.log(`   ✅ IMPLEMENT: Use the working formats for your production system`);
    console.log(`   ✅ UPDATE: Store the correct Pi Network UID during authentication`);
  } else {
    console.log(`   ❌ CRITICAL: No working formats found - check API permissions and user existence`);
  }
  
  return {
    totalTests,
    successfulTests,
    failedTests,
    workingFormats: Array.from(workingFormats),
    failedFormats: Array.from(failedFormats)
  };
}

async function runComprehensiveTest() {
  console.log("Starting comprehensive A2U testing for all Pi user types...\n");
  
  const allResults = [];
  
  // Test each scenario
  for (let i = 0; i < testScenarios.length; i++) {
    const scenario = testScenarios[i];
    const results = await testUserScenario(scenario, i);
    allResults.push(results);
    
    // Small delay between scenarios to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate comprehensive report
  const report = await generateReport(allResults);
  
  console.log(`\n` + "=".repeat(60));
  console.log("TEST COMPLETED");
  console.log("=".repeat(60));
  
  if (report.successfulTests > 0) {
    console.log(`🎉 SUCCESS: Found ${report.successfulTests} working UID format(s)`);
    console.log(`   Your A2U system can work for Pi users with proper UID handling`);
  } else {
    console.log(`❌ CRITICAL: No working UID formats found`);
    console.log(`   Check your API permissions, network settings, and user existence`);
  }
  
  return report;
}

// Run the comprehensive test
runComprehensiveTest()
  .then(report => {
    console.log(`\nTest completed successfully. Check the report above for implementation guidance.`);
  })
  .catch(error => {
    console.error(`Comprehensive test failed:`, error);
    process.exit(1);
  });
