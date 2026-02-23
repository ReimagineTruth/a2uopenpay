DO $$
DECLARE
  v_getting_started UUID;
  v_account UUID;
  v_wallet UUID;
  v_merchant UUID;
  v_channels UUID;
  v_virtual_card UUID;
  v_security UUID;
  v_fees UUID;
  v_troubleshooting UUID;
  v_legal UUID;
  v_support UUID;
BEGIN
  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Getting Started', 'Learn the basics of OpenPay and first-time setup.', 10
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'getting started'
  )
  RETURNING id INTO v_getting_started;

  IF v_getting_started IS NULL THEN
    SELECT id INTO v_getting_started
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'getting started'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Account and Sign-In', 'Account access, profile setup, and sign-in concerns.', 20
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'account and sign-in'
  )
  RETURNING id INTO v_account;

  IF v_account IS NULL THEN
    SELECT id INTO v_account
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'account and sign-in'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Wallet and Transfers', 'Balance, send/receive, and internal OpenPay transfer rules.', 30
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'wallet and transfers'
  )
  RETURNING id INTO v_wallet;

  IF v_wallet IS NULL THEN
    SELECT id INTO v_wallet
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'wallet and transfers'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Merchant Portal and Checkout', 'Merchant setup, checkout links, and settlement flow.', 40
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'merchant portal and checkout'
  )
  RETURNING id INTO v_merchant;

  IF v_merchant IS NULL THEN
    SELECT id INTO v_merchant
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'merchant portal and checkout'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Payment Links and Channels', 'Direct links, references, and channel payments.', 50
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'payment links and channels'
  )
  RETURNING id INTO v_channels;

  IF v_channels IS NULL THEN
    SELECT id INTO v_channels
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'payment links and channels'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Virtual Card', 'OpenPay virtual card usage and limits.', 60
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'virtual card'
  )
  RETURNING id INTO v_virtual_card;

  IF v_virtual_card IS NULL THEN
    SELECT id INTO v_virtual_card
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'virtual card'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Security and Safety', 'How to protect your account and avoid scams.', 70
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'security and safety'
  )
  RETURNING id INTO v_security;

  IF v_security IS NULL THEN
    SELECT id INTO v_security
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'security and safety'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Fees and Limits', 'Platform fees, transfer limits, and payout notes.', 80
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'fees and limits'
  )
  RETURNING id INTO v_fees;

  IF v_fees IS NULL THEN
    SELECT id INTO v_fees
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'fees and limits'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Troubleshooting', 'Common technical issues and recovery steps.', 90
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'troubleshooting'
  )
  RETURNING id INTO v_troubleshooting;

  IF v_troubleshooting IS NULL THEN
    SELECT id INTO v_troubleshooting
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'troubleshooting'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Legal and Compliance', 'Policy, terms, and permitted use of OpenPay.', 100
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'legal and compliance'
  )
  RETURNING id INTO v_legal;

  IF v_legal IS NULL THEN
    SELECT id INTO v_legal
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'legal and compliance'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_categories (title, description, sort_order)
  SELECT 'Support and Contact', 'How to contact OpenPay support and response expectations.', 110
  WHERE NOT EXISTS (
    SELECT 1 FROM public.support_faq_categories c WHERE LOWER(c.title) = 'support and contact'
  )
  RETURNING id INTO v_support;

  IF v_support IS NULL THEN
    SELECT id INTO v_support
    FROM public.support_faq_categories
    WHERE LOWER(title) = 'support and contact'
    LIMIT 1;
  END IF;

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_getting_started, 'What is OpenPay?',
    'OpenPay is a Pi-powered internal payment platform for users and merchants. It supports in-app balance transfers, merchant checkout, payment links, and wallet tools.',
    ARRAY['openpay', 'intro']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'what is openpay?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_getting_started, 'How do I start using OpenPay?',
    'Sign in, complete your profile, review the usage agreement, and use Wallet, Send, Receive, and Merchant tools from the dashboard and menu.',
    ARRAY['getting-started', 'signup']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i start using openpay?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_getting_started, 'Does OpenPay support external wallets or bank transfer rails?',
    'No. OpenPay is designed for internal OpenPay balance flows. External wallet rails and direct bank transfer rails are not supported in standard user transfer flow.',
    ARRAY['limits', 'rails']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'does openpay support external wallets or bank transfer rails?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_account, 'I cannot sign in. What should I check first?',
    'Confirm your login method, network connection, and correct account credentials. If still blocked, use support chat and include your username and error screenshot.',
    ARRAY['signin', 'access']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'i cannot sign in. what should i check first?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_account, 'How do I update my OpenPay profile?',
    'Open Profile or Settings, then update your display information. Keep your username accurate because merchants and customers use it for verification.',
    ARRAY['profile', 'settings']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i update my openpay profile?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_wallet, 'How are wallet balances displayed?',
    'Balances are shown in supported OpenPay currencies and converted for UI display using OpenPay currency rates. Internal transfer values are recorded in platform ledger units.',
    ARRAY['wallet', 'currency']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how are wallet balances displayed?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_wallet, 'How do I send money to another OpenPay user?',
    'Go to Send, choose a recipient, enter amount and note, review details, then confirm. Transfers are internal to OpenPay accounts.',
    ARRAY['send', 'transfer']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i send money to another openpay user?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_wallet, 'Why did my transfer fail?',
    'Common reasons are insufficient balance, invalid recipient, session expiration, or temporary network/API issues. Retry after refresh and verify recipient account.',
    ARRAY['failed-transfer', 'errors']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'why did my transfer fail?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_merchant, 'How do I access Merchant Portal?',
    'Open Menu, then Merchant Portal. You can manage API keys, product catalog, checkout links, payment channels, balances, and analytics.',
    ARRAY['merchant', 'portal']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i access merchant portal?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_merchant, 'How does merchant checkout settlement work?',
    'When a checkout succeeds, payment records are saved and merchant available balance updates based on merchant payment and transfer events.',
    ARRAY['checkout', 'settlement']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how does merchant checkout settlement work?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_merchant, 'Can merchant transfer available balance to wallet or savings?',
    'Yes. Merchant available balance can be moved to merchant wallet or savings from merchant balances controls and dashboard merchant tools.',
    ARRAY['merchant-balance', 'savings']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'can merchant transfer available balance to wallet or savings?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_channels, 'What are payment channel links?',
    'Payment channel links are one-time customer payment links with a reference number, description, remarks, amount, and currency, managed inside Merchant Portal.',
    ARRAY['payment-link', 'channels']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'what are payment channel links?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_channels, 'How do I share payment links?',
    'Use copy link, share actions, direct URL, QR, or embed options from payment link tools. Always verify title, amount, and currency before sharing.',
    ARRAY['share', 'qr', 'embed']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i share payment links?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_channels, 'Can I archive payment links?',
    'Yes. Archived links are hidden from active lists and can be viewed by enabling archived filters in Payment Channels.',
    ARRAY['archive', 'links']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'can i archive payment links?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_virtual_card, 'Where can I use OpenPay Virtual Card?',
    'OpenPay virtual card is intended for OpenPay merchant checkout flows. It should not be used for ATM, external card rails, or unsupported external networks.',
    ARRAY['virtual-card', 'checkout']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'where can i use openpay virtual card?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_virtual_card, 'Why does virtual card checkout fail?',
    'Verify card number, expiry, CVC, card owner session, and sufficient balance. Failures can also happen when checkout session is expired or not open.',
    ARRAY['virtual-card', 'failed-payment']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'why does virtual card checkout fail?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_security, 'How do I keep my account safe?',
    'Never share OTP, PIN, secret keys, or private credentials. Verify recipients and merchant details before confirming payments.',
    ARRAY['security', 'fraud']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how do i keep my account safe?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_security, 'How should merchants handle API keys?',
    'Keep secret keys server-side only, rotate keys periodically, and revoke exposed keys immediately from Merchant API key controls.',
    ARRAY['api-key', 'merchant-security']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how should merchants handle api keys?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_security, 'What should I do if I suspect fraud?',
    'Stop transactions, collect evidence, and contact support immediately with transaction IDs, screenshots, and timestamps.',
    ARRAY['fraud', 'incident']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'what should i do if i suspect fraud?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_fees, 'Does OpenPay charge platform fees?',
    'Core in-app features may have zero platform fee depending on current policy. Merchant-specific and partner terms can apply in some flows.',
    ARRAY['fees', 'pricing']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'does openpay charge platform fees?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_fees, 'Are there transfer limits?',
    'Limits may depend on account state, security checks, and product rules. If blocked by limits, contact support with amount and intended use.',
    ARRAY['limits', 'transfers']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'are there transfer limits?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_troubleshooting, 'QR code checkout is not working. What should I check?',
    'Confirm the link is valid, unexpired, and accessible from your device. If using local URLs, external devices cannot open localhost links.',
    ARRAY['qr', 'checkout', 'localhost']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'qr code checkout is not working. what should i check?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_troubleshooting, 'I see API or network timeout errors. What now?',
    'Refresh the page, verify internet connection, and retry. If errors continue, include console/network logs in support chat.',
    ARRAY['timeout', 'network', 'api']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'i see api or network timeout errors. what now?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_troubleshooting, 'Why is a new column not found in schema cache?',
    'Apply the latest database migration and allow schema cache refresh. Then reload the app.',
    ARRAY['schema-cache', 'migration']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'why is a new column not found in schema cache?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_legal, 'Is OpenPay a bank or financial institution?',
    'No. OpenPay is a payment technology platform. It is not a bank and does not provide bank deposit or investment services unless explicitly stated under applicable law.',
    ARRAY['legal', 'banking']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'is openpay a bank or financial institution?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_legal, 'What transactions are not allowed?',
    'Fraud, abuse, illegal transactions, misuse of credentials, and unsupported external transfer flows are prohibited.',
    ARRAY['policy', 'compliance']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'what transactions are not allowed?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_legal, 'Where can I read Terms, Privacy, and Legal notices?',
    'Open Menu and visit Terms, Privacy, and Legal pages. Merchant and API docs are also available in OpenPay documentation routes.',
    ARRAY['terms', 'privacy', 'legal']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'where can i read terms, privacy, and legal notices?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_support, 'How can I contact live support?',
    'Use the floating support widget and open Messages. Send complete details so support can respond faster.',
    ARRAY['support', 'chat']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'how can i contact live support?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_support, 'What details should I include in a support request?',
    'Include account username, transaction ID, amount, date/time, issue summary, and screenshots or logs when available.',
    ARRAY['support', 'ticket']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'what details should i include in a support request?');

  INSERT INTO public.support_faq_items (category_id, question, answer, tags)
  SELECT v_support, 'Who can reply to support messages?',
    'Official support agents such as @openpay and @wainfoundation can reply to all support conversations.',
    ARRAY['agent', 'openpay', 'wainfoundation']
  WHERE NOT EXISTS (SELECT 1 FROM public.support_faq_items f WHERE LOWER(f.question) = 'who can reply to support messages?');
END $$;
