# Engineer Ticketing Platform

This is a Next.js project for managing engineer ticketing, staff directories, and access rights.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

### Dynamic Department & Role System
The platform supports fully dynamic departments and roles without any manual coding!

- **Firestore Collection**: Uses a new `department_configs` collection in Firestore
- **Department Management**: Add, edit, and remove departments directly from the Access Rights page
- **Role Customization**: Each department can have its own unique set of role names
- **Default Departments**: Automatically initializes with 5 default departments if no config exists:
  - IT
  - Engineering
  - Sales
  - Procurement
  - Warehouse Operations

### Access Rights Management
- Manage permissions for any department and role combination
- Control access to:
  - App Features (Site Visits, Job Requests, DIAlux Simulations, etc.)
  - Navigation (Team Directory, Analytics, System Settings, etc.)
  - Security (Change Password, Login PIN, Biometrics, etc.)
  - Profile (View Profile, Edit Profile, App Preferences)
  - Home Screen (Stats Cards, Recent Activity, Schedule, etc.)

### Staff Directory
- Fetches employees from ERP (MongoDB) and combines with access rights (Firebase)
- Batch operations for granting/revoking access and updating roles
- Filter and search functionality

### Product Request Page
- Improved UI with better visibility for packaging dimensions
- Prominent PD Original cost display

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

