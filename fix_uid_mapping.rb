require 'pinetwork'
require 'json'

# DO NOT expose these values to public
api_key = "okebrorkawmpe9t1yy0a5iybng31m8w9acpcurcafsi3cvilhk4lmnr0r2z7pasw"
wallet_private_seed = "SA7HAEE64IDWFQ2MSXO5AK355PBVRMBCZOLDNAWTMY5JK3LPBQ7MYQO6"

pi = PiNetwork.new(api_key: api_key, wallet_private_seed: wallet_private_seed)

puts "=== Pi Network UID Mapping Fix ==="
puts "This script helps identify the correct Pi Network UID for user 'Wain2020'"
puts "=" * 60

# The problematic UID from your logs
problematic_uid = "ccecc12e-76d1-41f4-a099-9173cce0c9f0"
puts "❌ Problematic UID from database: #{problematic_uid}"
puts "This is a Supabase UUID, NOT a Pi Network UID"
puts

# Test the correct Pi Network username formats
correct_formats = [
  { uid: "Wain2020", description: "Plain username" },
  { uid: "@Wain2020", description: "Username with @ prefix" },
  { uid: "wain2020", description: "Lowercase username" },
  { uid: "@wain2020", description: "Lowercase with @ prefix" }
]

puts "Testing correct Pi Network UID formats for 'Wain2020':"
puts "-" * 60

working_uid = nil

correct_formats.each_with_index do |format, index|
  puts "\n#{index + 1}. Testing: #{format[:uid]} (#{format[:description]})"
  
  begin
    # Create a small test payment to validate the UID
    payment_data = {
      "amount": 0.001,  # Very small amount for testing
      "memo": "UID validation test for Wain2020",
      "metadata": {
        "test_type": "uid_validation",
        "original_problematic_uid": problematic_uid,
        "correct_uid": format[:uid],
        "timestamp": Time.now.to_i
      },
      "uid": format[:uid]
    }
    
    payment_id = pi.create_payment(payment_data)
    puts "  ✓ SUCCESS: Payment created with ID: #{payment_id}"
    
    # Cancel the test payment immediately to avoid actual charges
    begin
      pi.cancel_payment(payment_id)
      puts "  ✓ Test payment cancelled successfully"
    rescue => cancel_error
      puts "  ⚠ Warning: Could not cancel test payment: #{cancel_error.message}"
    end
    
    working_uid = format[:uid]
    puts "\n🎉 FOUND WORKING UID: '#{working_uid}'"
    puts "This is the correct format for user 'Wain2020'"
    break
    
  rescue => error
    puts "  ✗ Failed: #{error.message}"
    
    if error.message.include?("User with uid was not found")
      puts "  → This UID format is invalid"
    elsif error.message.include?("You need to complete the ongoing payment first")
      puts "  → This UID might work, but there's an existing payment"
    else
      puts "  → Other error: #{error.message[0..100]}..."
    end
  end
end

puts "\n" + "=" * 60

if working_uid
  puts "✅ SOLUTION FOUND!"
  puts "Working UID for 'Wain2020': #{working_uid}"
  puts
  puts "To fix your application:"
  puts "1. Update your database to store the correct Pi Network UID"
  puts "2. Use this UID instead of the Supabase UUID for payouts"
  puts
  puts "SQL to fix existing records:"
  puts "UPDATE user_profiles SET pi_uid = '#{working_uid}' WHERE pi_username = 'Wain2020';"
  puts
  puts "Or update your authentication flow to capture the real Pi Network UID"
else
  puts "❌ No working UID format found"
  puts
  puts "Possible reasons:"
  puts "1. 'Wain2020' is not a valid Pi Network user"
  puts "2. Your app doesn't have proper A2U permissions"
  puts "3. The user hasn't authenticated with your app properly"
  puts "4. The Pi Network UID is completely different from the username"
  puts
  puts "Next steps:"
  puts "1. Check your Pi Network app dashboard for user authentication"
  puts "2. Verify the user exists and has authorized your app"
  puts "3. Look at the actual UID returned during authentication"
end

puts "\n" + "=" * 60
puts "For reference:"
puts "❌ Wrong: #{problematic_uid} (Supabase UUID)"
puts "✅ Right: #{working_uid || 'NOT_FOUND'} (Pi Network UID)" if working_uid
puts "✅ Right: NOT_FOUND (Pi Network UID)" unless working_uid
