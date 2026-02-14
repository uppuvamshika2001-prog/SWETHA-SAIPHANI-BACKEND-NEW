# Swetha Saiphani Clinics - Hospital Management System Backend

Enterprise-grade backend API for a Hospital Management System with role-based access control, JWT authentication, and modular service architecture.

## 🏗 Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **ORM**: Prisma with PostgreSQL
- **Authentication**: JWT (Access + Refresh Tokens)
- **Validation**: Zod
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, CORS, Rate Limiting
- **Logging**: Pino

## 📁 Project Structure

```
/src
├── app.ts                    # Express app bootstrap
├── server.ts                 # Server startup
├── config/                   # Environment & database config
├── middleware/               # Auth, role, error handlers
├── utils/                    # JWT, crypto, response helpers
├── modules/
│   ├── auth/                 # Authentication
│   ├── users/                # User management
│   ├── staff/                # Staff profiles
│   ├── patients/             # Patient portal
│   ├── appointments/         # Scheduling
│   ├── doctors/              # Medical records, prescriptions
│   ├── pharmacy/             # Inventory, billing
│   └── lab/                  # Test orders, results
└── docs/                     # Swagger config
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

1. Clone and install dependencies:
   ```bash
   npm install
   ```

2. Copy environment file and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and secrets
   ```

3. Generate Prisma client and push schema:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

5. Visit:
   - API: http://localhost:8080
   - Swagger Docs: http://localhost:8080/docs
   - Health Check: http://localhost:8080/health

### Using Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api
```

## 🔐 Authentication

### Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full system access |
| `DOCTOR` | Medical records, prescriptions, patients |
| `RECEPTIONIST` | Patients, appointments, staff (read) |
| `PHARMACIST` | Inventory, billing |
| `LAB_TECHNICIAN` | Lab orders, results |
| `PATIENT` | Own profile, prescriptions, bills, results |

### Auth Flow

1. **Login**: `POST /api/auth/login` → returns access + refresh tokens
2. **Use Access Token**: Include in `Authorization: Bearer <token>` header
3. **Refresh**: When access token expires, `POST /api/auth/refresh`
4. **Logout**: `POST /api/auth/logout`

## 📚 API Endpoints

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Users
- `GET /api/users/me` - Current user profile
- `PATCH /api/users/me` - Update profile
- `GET /api/users` - List users (Admin)

### Staff
- `POST /api/staff` - Create staff (Admin)
- `GET /api/staff` - List staff
- `PATCH /api/staff/:id` - Update staff
- `DELETE /api/staff/:id` - Disable staff

### Patients
- `POST /api/patients` - Register patient
- `GET /api/patients` - List patients
- `GET /api/patients/:id/prescriptions` - Patient prescriptions
- `GET /api/patients/:id/bills` - Patient bills
- `GET /api/patients/:id/lab-results` - Patient lab results

### Appointments
- `POST /api/appointments` - Create appointment
- `GET /api/appointments` - List appointments
- `PATCH /api/appointments/:id` - Update appointment
- `DELETE /api/appointments/:id` - Cancel appointment

### Medical Records & Prescriptions
- `POST /api/medical-records` - Create medical record (Doctor)
- `POST /api/prescriptions` - Create prescription (Doctor)
- `GET /api/prescriptions/:id` - Get prescription

### Pharmacy
- `POST /api/pharmacy/medicines` - Add medicine
- `GET /api/pharmacy/medicines` - List medicines
- `PATCH /api/pharmacy/medicines/:id` - Update medicine/stock
- `POST /api/pharmacy/bills` - Create bill (auto-decrements stock)
- `GET /api/pharmacy/bills/:id` - Get bill

### Lab
- `POST /api/lab/orders` - Create lab order
- `GET /api/lab/orders` - List orders
- `POST /api/lab/results` - Submit result (Lab Tech)
- `GET /api/lab/results/:id` - Get result

## 🔧 Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:push      # Push schema to database
npm run prisma:studio    # Open Prisma Studio
```

## 📦 Deployment

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `JWT_ACCESS_SECRET` | JWT access token secret | ✅ (prod) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | ✅ (prod) |
| `PORT` | Server port (default: 8080) | ❌ |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | ❌ |

### Production

```bash
# Build
npm run build

# Run with migrations
./start.sh
```

## 📄 License

ISC
