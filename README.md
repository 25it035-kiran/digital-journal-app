# MindLog - Digital Journal Application 📓

An elegant, encrypted digital journaling solution designed for my internship timeline. This full-stack infrastructure provides personal authentication gates, encrypted account tracking, custom mood metric tagging, and complete string-search text queries against database contexts.

## 🛠️ Infrastructure Build Settings

* **Runtime Framework:** Next.js (Functional Server Action API Pipelines)
* **Data Integration:** Prisma Client linking seamlessly with a local serverless SQLite instance
* **Auth Protocol:** JSON Web Tokens structured safely via stateless client browser cookies (`jose`)
* **Security Module:** 10-round multi-pass structural password salting execution (`bcryptjs`)
* **Visual Layer:** Clean typographic interface built with Tailwind CSS utility bindings

## 🚀 Execution Guide

1. **Install Local Packages:**
   ```bash
   npm install @prisma/client bcryptjs jose
   npm install --save-dev prisma @types/bcryptjs
