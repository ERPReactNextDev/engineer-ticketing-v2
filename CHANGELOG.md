# Changelog

All notable changes to this project will be documented in this file.

## [2026-05-18]

### New Features
- **Dynamic Department & Role System**: The platform now supports dynamic departments and roles without manual coding!
  - Added a new `department_configs` collection in Firestore for storing department configurations
  - Departments and their roles can be managed directly from the Access Rights page using the "Departments" button
  - Supports adding, editing, and removing departments
  - Default departments are automatically initialized if no config exists (IT, Engineering, Sales, Procurement, Warehouse Operations)
- **Staff Directory Improvements**:
  - Now displays ALL staff, including resigned/terminated employees
  - Added Active/Inactive/All tabs to filter by employment status
  - Dashboard cards now show Active, Inactive, Authorized, and Total counts
  - Dynamic departments from Firestore are now used for staff management
  - Added `employmentStatus` field to staff data for better filtering
  - Added View Mode toggle: List View (default) and Org Tree View!
  - Organization Tree View shows staff grouped by department!
  - Simplified all wording to market-standard, non-technical terms!
  - Improved UI for better PWA experience on mobile and desktop!
  - Larger touch targets, better spacing, and cleaner controls!

### UI/UX Improvements
- **Access Rights Page Overhaul**:
  - Simplified all wording to be user-friendly and market-standard
  - Changed technical terms like "Service Access" → "App Features", "Configuration Overview" → "Access Overview"
  - Fixed sticky header and search/filter bar to stay at the top when scrolling
  - Improved UI for better PWA experience on both mobile and desktop
  - Larger touch targets, better spacing, and improved contrast

- **Product Request Page**:
  - Improved visibility of packaging dimensions (larger text, better color)
  - Made "PD Original" cost more prominent (blue background, larger text, border)

- **Page Header Component**:
  - Fixed sticky behavior with higher z-index (50)
  - Increased height to h-14 (mobile) / h-16 (desktop)
  - Added solid white background and stronger shadow

### Bug Fixes
- **Staff Directory Page**:
  - Fixed "departments is not defined" error by using `departmentsFromStaff` instead of undefined `departments` variable
  - Fixed duplicate `getRolesForDepartment` function declaration
- **Access Rights Page**: Fixed sticky header positioning
