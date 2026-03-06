require 'pinetwork'

# DO NOT expose these values to public
api_key = "okebrorkawmpe9t1yy0a5iybng31m8w9acpcurcafsi3cvilhk4lmnr0r2z7pasw"
wallet_private_seed = "SB2FQGTI7LYZKDDEFTBCBW2GUVPLDTXPM5NPOCLDEVRBXCCE4JA4PHCD"

pi = PiNetwork.new(api_key: api_key, wallet_private_seed: wallet_private_seed)

# Test different UID formats to find the correct one
test_uids = [
  "Wain2020",           # Plain username (current approach - likely incorrect)
  "@Wain2020",          # Username with @ prefix
  "3e1af49e-5e79-4aa7-8800-2e76a434ea74",  # UUID format (from your image filename)
  "uid_Wain2020",       # Prefixed format
  "user_Wain2020",      # Another prefixed format
]

puts "Testing different UID formats..."
puts "API Key: #{api_key[0..20]}..."
puts "Wallet Seed: #{wallet_private_seed[0..20]}..."
puts "=" * 50

test_uids.each_with_index do |uid, index|
  puts "\n#{index + 1}. Testing UID: '#{uid}'"
  
  begin
    # Create a small test payment (0.01 Pi)
    payment_data = {
      "amount": 0.01,
      "memo": "Test payment to validate UID format",
      "metadata": {"test": true, "uid_format": uid},
      "uid": uid
    }
    
    puts "  Creating payment..."
    payment_id = pi.create_payment(payment_data)
    puts "  ✓ SUCCESS: Payment created with ID: #{payment_id}"
    
    # Clean up - cancel the test payment
    begin
      pi.cancel_payment(payment_id)
      puts "  ✓ Test payment cancelled"
    rescue => cancel_error
      puts "  ⚠ Warning: Could not cancel payment: #{cancel_error.message}"
    end
    
  rescue => error
    puts "  ✗ FAILED: #{error.message}"
    
    # Check if it's the specific "User with uid was not found" error
    if error.message.include?("User with uid was not found")
      puts "  → This UID format is INVALID"
    elsif error.message.include?("You need to complete the ongoing payment first")
      puts "  → This UID format might be VALID, but there's an existing payment"
    else
      puts "  → Other error occurred"
    end
  end
end

puts "\n" + "=" * 50
puts "UID Validation Complete!"
puts "Look for the format that returns 'SUCCESS' above."
puts "If none succeed, you may need to:"
puts "1. Get the actual user UID from Pi Network authentication"
puts "2. Verify the user exists on Pi Network"
puts "3. Check if your app has proper permissions"
