# IsokoLink

IsokoLink is a digital platform designed to connect farmers and buyers in Rwanda, facilitating secure and efficient trade of different agricultural produce. The application provides dedicated dashboards for farmers to manage inventory and for buyers to browse and purchase produce.

## Tech Stack

**Frontend**
*   React (Vite)
*   TypeScript
*   TailwindCSS

**Backend**
*   Node.js
*   Express
*   MongoDB (Mongoose)
*   JWT Authentication

## Prerequisites

*   Node.js (v16 or higher)
*   MongoDB (local or Atlas connection string)

## Installation & Setup

### 1. Backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory with the following variables:

```env
PORT=4000
DB_URL=mongodb://localhost:27017/d2p-agri
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

Start the backend server:

```bash
npm run dev
```

### 2. Frontend

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Create a `.env` file (or rename `.env.example`) in the `frontend` directory:

```env
VITE_API_URL=http://localhost:4000
```

Start the frontend development server:

```bash
npm run dev
```

## features

*   **Role-based Access:** Distinct portals for Farmers and Buyers.
*   **Authentication:** Secure registration and login.
*   **Inventory Management:** Farmers can track stock levels.
*   **Marketplace:** Buyers can view available produce.
