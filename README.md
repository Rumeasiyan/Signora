# Signora– Online Document Signing System

## 📌 Project Overview

Signora is a web-based electronic document signing system that allows users to upload, send, sign, and manage PDF documents online.

The system simplifies the document approval process by replacing manual paperwork with a digital signing workflow.

## 🎯 Main Objectives

- Upload PDF documents.
- Send documents to recipients for signing.
- Allow users to sign documents electronically.
- Track document signing status.
- Download completed signed documents.
- Maintain document activity history.

## 🚀 Main Features

### 1. User Authentication

- User Registration
- User Login
- Secure Password Hashing
- JWT Authentication

### 2. Document Management

- Upload PDF Documents
- View Uploaded Documents
- Download Documents
- Delete Documents

### 3. Electronic Signature

- Sign PDF Documents Online
- Save Signature Details
- Manage Signed Documents

### 4. Document Tracking

- Pending Documents
- Signed Documents
- Rejected Documents
- Expired Documents

### 5. Dashboard

- Total Documents
- Pending Documents
- Signed Documents
- User Activity

### 6. Notifications

- Notify recipients about signature requests.
- Notify users when documents are signed.

### 7. Audit Logs

- Track document activities.
- Record upload and signing timestamps.
- Maintain document history.

  

## 🛠️ Technologies Used

| Technology     | Purpose             |
| -------------- | ------------------- |
| Next.js        | Frontend            |
| Go (Golang)    | Backend             |
| PostgreSQL     | Database            |
| JWT            | Authentication      |
| PDF Processing | Document Management |
| Git & GitHub   | Version Control     |

## 📂 Project Structure

```text
eViaSign/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── cmd/
│   ├── config/
│   ├── handlers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── go.mod
│
├── database/
│   └── migrations/
│
└── README.md
```

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone YOUR_REPOSITORY_URL
cd eViaSign
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3. Backend Setup

```bash
cd backend
go mod tidy
go run ./cmd
```

### 4. Database Setup

- Install PostgreSQL.
- Create a database.
- Configure database connection details.
- Run database migrations.

## 🔐 Environment Variables

Configure the required environment variables in the backend `.env` file.

```env
PORT=8080
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=evisign
JWT_SECRET=your_secret_key
```

## 👥 Contributors
  ELAVENY: feature/auth-upload
  DIVARANAN: feature/signing-ui
  KISHO: feature/email-pdf


Implement User Authentication System with Registration, Login, and JWT-Based Session Handling
Build Signer Signing Page with Token-Based Access, Signature Pad, and Submission Flow
Implement Audit Trail Logging and Timeline Data for Document Activity Tracking








