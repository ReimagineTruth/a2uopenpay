# Pi Network A2U Backend Service

A complete Node.js backend service for Pi Network App-to-User (A2U) payments using the official pi-backend SDK.

## 🚀 Features

- **Complete A2U Payment Flow**: Create → Submit → Complete
- **Error Handling**: Comprehensive error handling for Pi Network errors
- **Database Integration**: SQLite database with audit logging
- **API Validation**: Input validation using Joi
- **Modular Architecture**: Clean separation of concerns
- **Production Ready**: Security, logging, and monitoring

## 📁 Project Structure

```
pi-a2u-backend/
│
├── server.js              # Express server setup
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables
├── README.md              # Documentation
│
├── routes/
│   └── payments.js        # Payment API routes
│
├── services/
│   └── piService.js       # Pi Network SDK integration
│
├── models/
│   └── paymentModel.js    # Database operations
│
└── db/
    └── database.js        # Database setup and connection
```

## 🛠️ Installation

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env` file and update with your Pi Network credentials:

```bash
cp .env.example .env
```

Update the `.env` file:

```env
PORT=3000

# Pi Network Configuration
PI_API_KEY=your_pi_api_key_here
PI_WALLET_PRIVATE_SEED=S_your_wallet_private_seed_here

# Database Configuration
DB_PATH=./database.sqlite

# Environment
NODE_ENV=development
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm start
```

## 📡 API Endpoints

### Create Payment
```http
POST /payments/create
Content-Type: application/json

{
  "uid": "pi_user_uid",
  "amount": 1.0,
  "productId": "reward001",
  "memo": "Optional payment memo"
}
```

### Submit Payment to Blockchain
```http
POST /payments/submit
Content-Type: application/json

{
  "paymentId": "payment_identifier_from_pi_network"
}
```

### Complete Payment
```http
POST /payments/complete
Content-Type: application/json

{
  "paymentId": "payment_identifier",
  "txid": "blockchain_transaction_id"
}
```

### Get Payment Details
```http
GET /payments/:paymentId
```

### Get User Payments
```http
GET /payments/user/:uid?limit=20&offset=0
```

### Get Payment Statistics
```http
GET /payments/stats
```

### Get Recent Payments
```http
GET /payments/recent?limit=10
```

### Cancel Payment
```http
POST /payments/cancel/:paymentId
```

### Cleanup Incomplete Payments
```http
POST /payments/cleanup
```

## 🔄 Payment Flow

### 1. Create Payment
```bash
curl -X POST http://localhost:3000/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "your_pi_user_uid",
    "amount": 0.01,
    "productId": "test_reward_001"
  }'
```

### 2. Submit to Blockchain
```bash
curl -X POST http://localhost:3000/payments/submit \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment_id_from_step_1"
  }'
```

### 3. Complete Payment
```bash
curl -X POST http://localhost:3000/payments/complete \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "payment_id_from_step_1",
    "txid": "txid_from_step_2"
  }'
```

## 🗄️ Database Schema

### Payments Table
```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  product_id TEXT NOT NULL,
  amount REAL NOT NULL,
  memo TEXT,
  payment_id TEXT UNIQUE,
  txid TEXT,
  status TEXT DEFAULT 'pending',
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Log Table
```sql
CREATE TABLE payment_audit_log (
  id TEXT PRIMARY KEY,
  payment_id TEXT,
  action TEXT NOT NULL,
  status_before TEXT,
  status_after TEXT,
  details TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🔧 Error Handling

The service includes comprehensive error handling for common Pi Network errors:

- **"User with uid was not found"** - Invalid user UID
- **"Insufficient balance"** - Not enough Pi in wallet
- **"You need to complete the ongoing payment"** - Another payment is in progress
- **"Network error"** - Blockchain network issues
- **"Authentication failed"** - Invalid API credentials

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Payment Statistics
```bash
curl http://localhost:3000/payments/stats
```

### Recent Activity
```bash
curl http://localhost:3000/payments/recent
```

## 🧪 Testing

### Test Complete Flow
```bash
# 1. Create payment
CREATE_RESPONSE=$(curl -s -X POST http://localhost:3000/payments/create \
  -H "Content-Type: application/json" \
  -d '{"uid": "test_user", "amount": 0.01, "productId": "test_001"}')

PAYMENT_ID=$(echo $CREATE_RESPONSE | jq -r '.payment.paymentId')

# 2. Submit payment
SUBMIT_RESPONSE=$(curl -s -X POST http://localhost:3000/payments/submit \
  -H "Content-Type: application/json" \
  -d "{\"paymentId\": \"$PAYMENT_ID\"}")

TXID=$(echo $SUBMIT_RESPONSE | jq -r '.txid')

# 3. Complete payment
curl -s -X POST http://localhost:3000/payments/complete \
  -H "Content-Type: application/json" \
  -d "{\"paymentId\": \"$PAYMENT_ID\", \"txid\": \"$TXID\"}"
```

## 🚀 Production Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=3000
PI_API_KEY=your_production_api_key
PI_WALLET_PRIVATE_SEED=S_your_production_wallet_seed
DB_PATH=/var/lib/pi-a2u/database.sqlite
```

### Security Considerations
- Use HTTPS in production
- Secure your API endpoints with authentication
- Store secrets in environment variables
- Implement rate limiting
- Monitor for suspicious activity

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🐛 Troubleshooting

### Common Issues

1. **"User with uid was not found"**
   - Verify the user UID is correct
   - Check if user is authenticated in Pi Network
   - Ensure user exists in Pi Network

2. **"Insufficient balance"**
   - Check wallet balance
   - Ensure wallet is funded with Pi
   - Verify wallet private seed is correct

3. **"You need to complete the ongoing payment"**
   - Call `/payments/cleanup` to clear stuck payments
   - Check for incomplete payments in Pi Network dashboard

4. **Database errors**
   - Ensure SQLite file has proper permissions
   - Check disk space
   - Verify database schema

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

## 📝 Logs

The service provides detailed logging:
- 📝 Payment creation
- ⛓️ Blockchain submission
- 🎯 Payment completion
- ❌ Error details
- 💾 Database operations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Links

- [Pi Network Developer Documentation](https://developers.minepi.com/docs)
- [pi-nodejs GitHub Repository](https://github.com/pi-apps/pi-nodejs)
- [Pi Network Community](https://community.minepi.com)

---

## 🎯 Quick Start

1. **Install**: `npm install`
2. **Configure**: Update `.env` with your Pi Network credentials
3. **Start**: `npm run dev`
4. **Test**: `curl http://localhost:3000/health`
5. **Create Payment**: See API examples above

Your Pi Network A2U backend is now ready! 🚀
