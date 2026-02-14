# Swetha Saiphani Clinics - Backend API Documentation

## Base Configuration

| Property | Value |
|----------|-------|
| **Base URL** | `http://localhost:3001` |
| **API Prefix** | `/api` |
| **Swagger Docs** | `http://localhost:3001/docs` |
| **Content-Type** | `application/json` |

---

## Authentication

All protected endpoints require the `Authorization` header:
```
Authorization: Bearer <access_token>
```

### User Roles
| Role | Value |
|------|-------|
| Admin | `ADMIN` |
| Doctor | `DOCTOR` |
| Receptionist | `RECEPTIONIST` |
| Pharmacist | `PHARMACIST` |
| Lab Technician | `LAB_TECHNICIAN` |
| Patient | `PATIENT` |

---

## 1. Auth Endpoints (`/api/auth`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ Public | Register new user |
| `POST` | `/api/auth/login` | ❌ Public | Login user |
| `POST` | `/api/auth/refresh` | ❌ Public | Refresh access token |
| `POST` | `/api/auth/logout` | ✅ Required | Logout current session |
| `POST` | `/api/auth/logout-all` | ✅ Required | Logout all sessions |
| `POST` | `/api/auth/change-password` | ✅ Required | Change password |
| `GET` | `/api/auth/me` | ✅ Required | Get current user info |

### Request/Response Examples

#### POST `/api/auth/register`
```json
// Request
{
  "email": "patient@example.com",
  "password": "Password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "9876543210",
  "role": "PATIENT"  // Optional, defaults to PATIENT
}

// Response
{
  "status": "success",
  "data": {
    "user": {
      "id": "uuid",
      "email": "patient@example.com",
      "role": "PATIENT"
    },
    "tokens": {
      "accessToken": "eyJhbG...",
      "refreshToken": "eyJhbG...",
      "expiresIn": "15m"
    }
  }
}
```

#### POST `/api/auth/login`
```json
// Request
{
  "email": "patient@example.com",
  "password": "Password123"
}

// Response (same as register)
```

#### POST `/api/auth/refresh`
```json
// Request
{
  "refreshToken": "eyJhbG..."
}

// Response
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG...",
    "expiresIn": "15m"
  }
}
```

#### POST `/api/auth/change-password`
```json
// Request
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456"
}
```

---

## 2. Users Endpoints (`/api/users`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/users/me` | ✅ Required | Any | Get current user profile |
| `PATCH` | `/api/users/me` | ✅ Required | Any | Update current user profile |
| `GET` | `/api/users` | ✅ Required | `ADMIN` | List all users |
| `GET` | `/api/users/:id` | ✅ Required | `ADMIN` | Get user by ID |

---

## 3. Staff Endpoints (`/api/staff`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/staff` | ✅ Required | `ADMIN`, `RECEPTIONIST` | List all staff |
| `GET` | `/api/staff/:id` | ✅ Required | Clinical Staff | Get staff by ID |
| `POST` | `/api/staff` | ✅ Required | `ADMIN` | Create new staff |
| `PATCH` | `/api/staff/:id` | ✅ Required | `ADMIN` | Update staff |
| `DELETE` | `/api/staff/:id` | ✅ Required | `ADMIN` | Delete staff |

### Request Example

#### POST `/api/staff`
```json
{
  "email": "doctor@clinic.com",
  "password": "Doctor123",
  "firstName": "Dr. Ravi",
  "lastName": "Kumar",
  "role": "DOCTOR",
  "phone": "9876543210",
  "specialization": "Neurosurgery",
  "department": "Neurology",
  "licenseNo": "MCI-12345"
}
```

---

## 4. Patients Endpoints (`/api/patients`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `GET` | `/api/patients/me` | ✅ Required | `PATIENT` | Get own profile |
| `GET` | `/api/patients` | ✅ Required | Staff Only | List all patients |
| `GET` | `/api/patients/:id` | ✅ Required | Staff Only | Get patient by ID |
| `POST` | `/api/patients` | ✅ Required | Staff Only | Create patient (walk-in) |
| `PATCH` | `/api/patients/:id` | ✅ Required | Patient/Staff | Update patient |
| `GET` | `/api/patients/:id/prescriptions` | ✅ Required | Any | Get patient prescriptions |
| `GET` | `/api/patients/:id/bills` | ✅ Required | Any | Get patient bills |
| `GET` | `/api/patients/:id/lab-results` | ✅ Required | Any | Get patient lab results |

### Request Example

#### POST `/api/patients`
```json
{
  "firstName": "Ramesh",
  "lastName": "Kumar",
  "dateOfBirth": "1990-05-15",
  "gender": "MALE",
  "phone": "9876543210",
  "email": "ramesh@example.com",
  "address": "123 Main St, Hyderabad",
  "emergencyContact": "9876543211",
  "bloodGroup": "O+",
  "allergies": "Penicillin"
}
```

---

## 5. Appointments Endpoints (`/api/appointments`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/appointments` | ✅ Required | Clinical Staff | Create appointment |
| `GET` | `/api/appointments` | ✅ Required | Clinical Staff | List appointments |
| `GET` | `/api/appointments/:id` | ✅ Required | Clinical Staff | Get appointment by ID |
| `PATCH` | `/api/appointments/:id` | ✅ Required | Clinical Staff | Update appointment |
| `DELETE` | `/api/appointments/:id` | ✅ Required | Clinical Staff | Cancel appointment |

### Request Example

#### POST `/api/appointments`
```json
{
  "patientId": "patient-uuid",
  "doctorId": "doctor-uuid",
  "scheduledAt": "2026-01-24T10:30:00.000Z",
  "duration": 30,
  "reason": "Follow-up consultation",
  "notes": "Patient reported improvement"
}
```

### Appointment Statuses
| Status | Description |
|--------|-------------|
| `SCHEDULED` | Appointment created |
| `CONFIRMED` | Patient confirmed |
| `IN_PROGRESS` | Consultation started |
| `COMPLETED` | Consultation finished |
| `CANCELLED` | Cancelled |
| `NO_SHOW` | Patient didn't arrive |

---

## 6. Medical Records & Prescriptions (`/api`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/medical-records` | ✅ Required | Medical Staff | Create medical record |
| `GET` | `/api/medical-records/patient/:patientId` | ✅ Required | Medical Staff | Get patient records |
| `POST` | `/api/prescriptions` | ✅ Required | Medical Staff | Create prescription |
| `GET` | `/api/prescriptions/:id` | ✅ Required | Medical Staff | Get prescription |

### Request Examples

#### POST `/api/medical-records`
```json
{
  "patientId": "patient-uuid",
  "diagnosis": "Lumbar disc herniation",
  "treatment": "Conservative management with physiotherapy",
  "notes": "MRI scheduled for next week",
  "vitalSigns": {
    "bp": "120/80",
    "temp": "98.6",
    "pulse": "72",
    "weight": "70",
    "height": "175"
  }
}
```

#### POST `/api/prescriptions`
```json
{
  "patientId": "patient-uuid",
  "notes": "Take medicines after food",
  "medicines": [
    {
      "name": "Paracetamol 500mg",
      "dosage": "1 tablet",
      "frequency": "3 times daily",
      "duration": "5 days",
      "instructions": "After meals"
    },
    {
      "name": "Omeprazole 20mg",
      "dosage": "1 capsule",
      "frequency": "Once daily",
      "duration": "7 days",
      "instructions": "Before breakfast"
    }
  ]
}
```

---

## 7. Pharmacy Endpoints (`/api/pharmacy`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/pharmacy/medicines` | ✅ Required | `ADMIN`, `PHARMACIST` | Add medicine |
| `GET` | `/api/pharmacy/medicines` | ✅ Required | `ADMIN`, `PHARMACIST` | List medicines |
| `GET` | `/api/pharmacy/medicines/low-stock` | ✅ Required | `ADMIN`, `PHARMACIST` | Get low stock items |
| `GET` | `/api/pharmacy/medicines/:id` | ✅ Required | `ADMIN`, `PHARMACIST` | Get medicine by ID |
| `PATCH` | `/api/pharmacy/medicines/:id` | ✅ Required | `ADMIN`, `PHARMACIST` | Update medicine |
| `POST` | `/api/pharmacy/bills` | ✅ Required | `ADMIN`, `PHARMACIST` | Create pharmacy bill |
| `GET` | `/api/pharmacy/bills/:id` | ✅ Required | `ADMIN`, `PHARMACIST` | Get bill by ID |
| `PATCH` | `/api/pharmacy/bills/:id` | ✅ Required | `ADMIN`, `PHARMACIST` | Update bill (payment) |

### Request Examples

#### POST `/api/pharmacy/medicines`
```json
{
  "name": "Paracetamol 500mg",
  "genericName": "Acetaminophen",
  "manufacturer": "Cipla",
  "category": "Analgesic",
  "unit": "tablet",
  "pricePerUnit": 2.50,
  "stockQuantity": 500,
  "reorderLevel": 50,
  "expiryDate": "2027-12-31"
}
```

#### POST `/api/pharmacy/bills`
```json
{
  "patientId": "patient-uuid",
  "items": [
    {
      "medicineId": "medicine-uuid",
      "description": "Paracetamol 500mg x 10",
      "quantity": 10,
      "unitPrice": 2.50
    }
  ],
  "discount": 5.00,
  "gstPercent": 12
}
```

### Bill Statuses
| Status | Description |
|--------|-------------|
| `PENDING` | Payment not received |
| `PAID` | Fully paid |
| `PARTIALLY_PAID` | Partial payment |
| `CANCELLED` | Bill cancelled |

---

## 8. Lab Endpoints (`/api/lab`)

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/lab/orders` | ✅ Required | `ADMIN`, `DOCTOR`, `LAB_TECHNICIAN` | Create lab order |
| `GET` | `/api/lab/orders` | ✅ Required | `ADMIN`, `DOCTOR`, `LAB_TECHNICIAN` | List lab orders |
| `GET` | `/api/lab/orders/:id` | ✅ Required | `ADMIN`, `DOCTOR`, `LAB_TECHNICIAN` | Get order by ID |
| `PATCH` | `/api/lab/orders/:id/status` | ✅ Required | `ADMIN`, `LAB_TECHNICIAN` | Update order status |
| `POST` | `/api/lab/results` | ✅ Required | `ADMIN`, `LAB_TECHNICIAN` | Submit lab result |
| `GET` | `/api/lab/results/:id` | ✅ Required | `ADMIN`, `DOCTOR`, `LAB_TECHNICIAN` | Get result by ID |

### Request Examples

#### POST `/api/lab/orders`
```json
{
  "patientId": "patient-uuid",
  "testName": "Complete Blood Count",
  "testCode": "CBC-001",
  "priority": "normal",
  "notes": "Fasting sample required"
}
```

#### POST `/api/lab/results`
```json
{
  "orderId": "order-uuid",
  "interpretation": "All values within normal range",
  "result": {
    "parameters": [
      { "name": "Hemoglobin", "value": "14.5", "unit": "g/dL", "normalRange": "12-16" },
      { "name": "WBC Count", "value": "7500", "unit": "/μL", "normalRange": "4000-11000" },
      { "name": "Platelet Count", "value": "250000", "unit": "/μL", "normalRange": "150000-400000" }
    ]
  },
  "attachments": ["/uploads/reports/cbc-report.pdf"]
}
```

### Lab Test Statuses
| Status | Description |
|--------|-------------|
| `ORDERED` | Test ordered |
| `SAMPLE_COLLECTED` | Sample taken |
| `IN_PROGRESS` | Test running |
| `COMPLETED` | Results ready |
| `CANCELLED` | Test cancelled |

---

## 9. Health Check

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | ❌ Public | Server health status |

```json
// Response
{
  "status": "success",
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-23T10:00:00.000Z",
    "uptime": 3600.5
  }
}
```

---

## Error Response Format

All errors follow this structure:
```json
{
  "status": "error",
  "message": "Error description",
  "code": 400,
  "errors": [
    { "field": "email", "message": "Invalid email address" }
  ]
}
```

### Common HTTP Status Codes
| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `400` | Bad Request (validation error) |
| `401` | Unauthorized (missing/invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `429` | Too Many Requests (rate limited) |
| `500` | Internal Server Error |

---

## Frontend Integration Checklist

### 1. Environment Setup
Add to frontend `.env`:
```env
VITE_API_BASE_URL=http://localhost:3001/api
```

### 2. API Client Setup
```typescript
// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'API Error');
  }

  return response.json();
}
```

### 3. Auth Functions
```typescript
// src/lib/auth.ts
export async function login(email: string, password: string) {
  const { data } = await apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  return data.user;
}

export async function logout() {
  await apiRequest('/auth/logout', { method: 'POST' });
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}
```

---

## Total Endpoints Summary

| Module | Endpoints |
|--------|-----------|
| Auth | 7 |
| Users | 4 |
| Staff | 5 |
| Patients | 8 |
| Appointments | 5 |
| Medical Records & Prescriptions | 4 |
| Pharmacy | 8 |
| Lab | 6 |
| Health | 1 |
| **Total** | **48 endpoints** |
