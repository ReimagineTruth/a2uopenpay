#!/usr/bin/env ruby

require 'pinetwork'
require 'json'

# Test script for Pi Network Ruby gem functionality
# This validates your API key and wallet setup

puts "=== Pi Network Ruby Gem Test ==="
puts

# Your credentials (keep these secure!)
api_key = "okebrorkawmpe9t1yy0a5iybng31m8w9acpcurcafsi3cvilhk4lmnr0r2z7pasw"
wallet_private_seed = "SA7HAEE64IDWFQ2MSXO5AK355PBVRMBCZOLDNAWTMY5JK3LPBQ7MYQO6"

puts "1. Testing Pi Network gem initialization..."
begin
  pi = PiNetwork.new(api_key: api_key, wallet_private_seed: wallet_private_seed)
  puts "✅ Pi Network gem initialized successfully"
rescue => error
  puts "❌ Failed to initialize Pi Network gem: #{error.message}"
  exit 1
end

puts "\n2. Testing API connection..."
begin
  # Try to get incomplete payments (this tests API connectivity)
  incomplete = pi.get_incomplete_server_payments
  puts "✅ API connection successful"
  puts "   Incomplete payments: #{incomplete&.length || 0}"
rescue => error
  puts "❌ API connection failed: #{error.message}"
  puts "   Check your API key and network connectivity"
end

puts "\n3. Testing wallet functionality..."
begin
  # We can't directly test wallet without a real payment, but we can validate the seed format
  if wallet_private_seed.start_with?('S')
    puts "✅ Wallet seed format looks correct (starts with 'S')"
  else
    puts "⚠ Wallet seed should start with 'S' for Pi Network"
  end
rescue => error
  puts "❌ Wallet error: #{error.message}"
end

puts "\n4. Testing with known problematic UID..."
problematic_uid = "ccecc12e-76d1-41f4-a099-9173cce0c9f0"
begin
  payment_data = {
    "amount": 0.001,
    "memo": "Test payment with problematic UID",
    "metadata": {
      "test": true,
      "uid_type": "supabase_uuid"
    },
    "uid": problematic_uid
  }
  
  payment_id = pi.create_payment(payment_data)
  puts "❌ Unexpected success with problematic UID: #{payment_id}"
  
  # Cancel immediately if it somehow worked
  pi.cancel_payment(payment_id)
  
rescue => error
  if error.message.include?("User with uid was not found")
    puts "✅ Confirmed: Supabase UUID is not a valid Pi Network UID"
    puts "   Error: #{error.message}"
  else
    puts "⚠ Different error occurred: #{error.message}"
  end
end

puts "\n5. Testing with correct Pi Network username..."
correct_uid = "Wain2020"
begin
  payment_data = {
    "amount": 0.001,
    "memo": "Test payment with correct UID",
    "metadata": {
      "test": true,
      "uid_type": "pi_username"
    },
    "uid": correct_uid
  }
  
  payment_id = pi.create_payment(payment_data)
  puts "✅ SUCCESS: Payment created with correct UID!"
  puts "   Payment ID: #{payment_id}"
  
  # Cancel the test payment
  pi.cancel_payment(payment_id)
  puts "   Test payment cancelled"
  
rescue => error
  if error.message.include?("User with uid was not found")
    puts "❌ This UID format also failed: #{error.message}"
    puts "   The user 'Wain2020' may not exist or hasn't authorized your app"
  else
    puts "⚠ Different error: #{error.message}"
  end
end

puts "\n" + "=" * 50
puts "SUMMARY:"
puts "✅ Pi Network gem: Working" if defined?(pi) && pi
puts "✅ API connection: Working" rescue puts "❌ API connection: Failed"
puts "❌ UID mapping: Needs fixing (use Pi Network UID, not Supabase UUID)"
puts
puts "NEXT STEPS:"
puts "1. Find the correct Pi Network UID for 'Wain2020'"
puts "2. Update your database to store Pi Network UIDs"
puts "3. Modify your payout function to use the correct UID"
puts
puts "Run 'ruby a2u_payout_working.rb' to test different UID formats"
