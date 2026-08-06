# 🌐 Inventory Management System - Deployment Guide

This guide provides step-by-step instructions for hosting your **Inventory Management System** online so that someone at a long distance can view and test the live application 24/7.

---

## 🗄️ Step 1: Set Up a Free Remote MySQL Database

Since cloud web servers do not run local MySQL instances, you need a free cloud-hosted MySQL database.

### Recommended Free Providers:

#### Option A: Aiven (Recommended - Free MySQL 8.0)
1. Go to [Aiven.io](https://aiven.io/) and create a free account.
2. Create a new service and select **MySQL**. Choose the free tier plan.
3. Once provisioned, copy the connection details:
   - **Host**
   - **Port**
   - **User** (`avnadmin` or custom)
   - **Password**
   - **Database Name** (`defaultdb`)
4. Open the Aiven Query Editor (or use MySQL Workbench / DBeaver / `mysql` CLI) and execute the contents of [`schema.sql`](file:///d:/Inventory_Management_System/schema.sql) (Skip the `CREATE DATABASE` and `USE inventory_system;` lines if using the default database).

#### Option B: Railway.app
1. Go to [Railway.app](https://railway.app/).
2. Create a new project -> Add **MySQL**.
3. Go to the **Variables** tab to view your `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`.
4. Connect via MySQL Workbench or Query tab and import [`schema.sql`](file:///d:/Inventory_Management_System/schema.sql).

---

## 🚀 Step 2: Deploy the Web Application to Render (Free 24/7 Hosting)

[Render](https://render.com/) is a popular platform that hosts Node.js applications for free.

### Setup Instructions:
1. **Push Code to GitHub**:
   - Create a GitHub repository (e.g., `inventory-management-system`).
   - Push your code to GitHub:
     ```bash
     git init
     git add .
     git commit -m "Initial commit for production"
     git branch -M main
     git remote add origin https://github.com/YOUR_USERNAME/inventory-management-system.git
     git push -u origin main
     ```

2. **Create Web Service on Render**:
   - Go to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
   - Connect your GitHub repository.

3. **Configure Build & Deployment**:
   - **Name**: `inventory-system` (or any custom name)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

4. **Set Environment Variables**:
   Under the **Environment Variables** section in Render, add:
   - `DB_HOST`: *(Your remote MySQL host, e.g., mysql-xxxx.aivencloud.com)*
   - `DB_PORT`: *(Your remote MySQL port, e.g., 3306 or assigned port)*
   - `DB_USER`: *(Your DB username)*
   - `DB_PASSWORD`: *(Your DB password)*
   - `DB_NAME`: *(Your database name)*
   - `DB_SSL`: `true`

5. **Deploy**:
   - Click **Create Web Service**.
   - Render will build and launch your application. Once finished, you will receive a public HTTPS URL (e.g. `https://inventory-system.onrender.com`).
   - Anyone anywhere in the world can open this link in their web browser!

---

## ⚡ Bonus Option: 10-Second Instant Tunnel (For Immediate Live Demos)

If you need someone to look at the app **right now** while your computer is running, you can share a live tunnel directly from your PC without setting up cloud databases:

1. Start your local server:
   ```bash
   npm start
   ```
2. In a separate terminal, run:
   ```bash
   npx localtunnel --port 3000
   ```
3. Copy the generated URL (e.g., `https://random-name.loca.lt`) and send it to your viewer!
