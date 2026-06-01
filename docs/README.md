# DSI Connect — Documentation Index

> **DSI Connect** is the internal enterprise resource platform for **Disruptive Solutions Inc.**
> It manages the full workflow between Sales, Engineering, and Management teams.

---

## 📚 Documentation Files

| File | Audience | Description |
|------|----------|-------------|
| [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) | Developers | Architecture, setup, codebase structure, APIs, data models, deployment |
| [USER_GUIDE.md](./USER_GUIDE.md) | End Users | How to use every feature, role-by-role walkthrough |
| [ADMIN_GUIDE.md](./ADMIN_GUIDE.md) | System Admins | Staff management, permissions, system configuration |
| [API_REFERENCE.md](./API_REFERENCE.md) | Developers | All API routes, request/response schemas |
| [DATA_MODELS.md](./DATA_MODELS.md) | Developers | Firebase, MongoDB, and Supabase data schemas |
| [ROLES_AND_PERMISSIONS.md](./ROLES_AND_PERMISSIONS.md) | Admins & Devs | Role hierarchy, permission matrix, access control |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | DevOps / Developers | Build, environment variables, Netlify/Vercel deployment |
| [CHANGELOG.md](../CHANGELOG.md) | All | Version history and release notes |

---

## 🚀 Quick Start (Developers)

```bash
# 1. Clone and install
git clone <repo-url>
cd engineer-ticketing
npm install

# 2. Set up environment variables
cp .env.local.example .env.local
# Fill in all required keys (see DEPLOYMENT.md)

# 3. Run development server
npm run dev
# App runs at http://localhost:3000
```

---

## 🏗️ Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Real-time DB | Firebase Firestore |
| User DB | MongoDB |
| Auth | Custom (bcrypt + localStorage sessions) |
| File Storage | Cloudinary |
| Push Notifications | Firebase FCM + web-push |
| Deployment | Netlify / Vercel |

---

## 📞 Support

For technical issues, contact the IT Department or refer to the relevant documentation file above.
