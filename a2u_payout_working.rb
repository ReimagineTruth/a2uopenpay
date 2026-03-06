require 'pinetwork'

# DO NOT expose these values to public
api_key = "okebrorkawmpe9t1yy0a5iybng31m8w9acpcurcafsi3cvilhk4lmnr0r2z7pasw"
wallet_private_seed = "SA7HAEE64IDWFQ2MSXO5AK355PBVRMBCZOLDNAWTMY5JK3LPBQ7MYQO6" # starts with S

pi = PiNetwork.new(api_key: api_key, wallet_private_seed: wallet_private_seed)

puts "=== Pi Network A2U Payout Test ==="
puts "API Key: #{api_key[0..20]}..."
puts "Wallet Seed: #{wallet_private_seed[0..20]}..."
puts "=" * 50

# The CORRECT Pi Network UID for user "Wain2020"
# This should be obtained from Pi Network authentication, NOT from your database
# For testing, we'll try different formats that Pi Network might accept

# Based on the image, the user is "Wain2020" - let's test the correct formats
test_uids = [
  "Wain2020",                           # Plain username (most likely correct)
  "@Wain2020",                          # Username with @ prefix
  "wain2020",                           # Lowercase
  "@wain2020",                          # Lowercase with @
]

# Test each UID format to find the working one
test_uids.each_with_index do |uid, index|
  puts "\n#{index + 1}. Testing UID format: '#{uid}'"
  
  begin
    # Step 1: Create A2U payment
    puts "  Creating payment..."
    payment_data = {
      "amount": 0.01,
      "memo": "Test A2U payout to Wain2020",
      "metadata": {
        "test": true,
        "uid_format": uid,
        "timestamp": Time.now.to_i
      },
      "uid": uid
    }
    
    payment_id = pi.create_payment(payment_data)
    puts "  ✓ Payment created successfully: #{payment_id}"
    
    # Step 2: Submit payment to blockchain
    puts "  Submitting to blockchain..."
    txid = pi.submit_payment(payment_id)
    puts "  ✓ Transaction submitted: #{txid}"
    
    # Step 3: Complete the payment
    puts "  Completing payment..."
    payment = pi.complete_payment(payment_id, txid)
    puts "  ✓ Payment completed successfully!"
    puts "  Status: #{payment['status']}"
    puts "  Network: #{payment['network']}"
    
    puts "\n🎉 SUCCESS! UID format '#{uid}' works correctly!"
    puts "Payment ID: #{payment_id}"
    puts "Transaction ID: #{txid}"
    puts "Use this UID format for future payouts to Wain2020"
    
    # Exit after first success
    exit 0
    
  rescue => error
    puts "  ✗ Failed: #{error.message}"
    
    if error.message.include?("User with uid was not found")
      puts "  → This UID format is INVALID"
    elsif error.message.include?("You need to complete the ongoing payment first")
      puts "  → This UID format might be valid, but there's an existing payment"
      # Try to get incomplete payments and complete them
      begin
        incomplete = pi.get_incomplete_server_payments
        if incomplete && !incomplete.empty?
          puts "  → Found incomplete payment, attempting to complete..."
          incomplete_payment = incomplete[0]
          if incomplete_payment['transaction'] && incomplete_payment['transaction']['txid']
            pi.complete_payment(incomplete_payment['identifier'], incomplete_payment['transaction']['txid'])
            puts "  → Incomplete payment completed, retrying..."
            retry
          else
            puts "  → Cannot complete incomplete payment (no transaction)"
          end
        end
      rescue => complete_error
        puts "  → Failed to handle incomplete payment: #{complete_error.message}"
      end
    else
      puts "  → Other error occurred"
    end
  end
end

puts "\n" + "=" * 50
puts "❌ No UID format worked for user 'Wain2020'"
puts "\nNext steps:"
puts "1. Verify that 'Wain2020' is a valid Pi Network user"
puts "2. Check if your app has proper permissions for A2U payments"
puts "3. Ensure the user has authenticated with your app properly"
puts "4. The correct Pi Network UID might be different from the username"

puts "\nTo get the correct Pi Network UID:"
puts "- Check the user object during Pi Network authentication"
puts "- Look for 'uid' field in the Pi SDK response"
puts "- The UID might be different from the displayed username"
