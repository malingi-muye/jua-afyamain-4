# Platform Logic Review & Security Audit

This workflow documents the comprehensive review and fixes implemented for the JuaAfya platform logic, focusing on RBAC, Multitenancy, and the Team Invitation System.

## 1. Team Invitation System (Revamped)

The invitation system has been moved to a dedicated table to solve ID mismatches and unique email conflicts.

### Logic Flow:
1.  **Invite**: Admin creates an invitation (stored in `public.invitations`).
2.  **Signup**: Invited user joins via `/signup`.
3.  **Automatic Linking**: A database trigger `handle_new_user_signup` detects the invitation by email.
    *   Links user to the correct `clinic_id`.
    *   Assigns the correct `role` from the invitation.
    *   Sets invitation status to `accepted`.
4.  **Security**: RLS policies ensure only clinic admins can manage invitations for their clinic.

### Key Files:
- `supabase/migrations/20260114000000_fix_invitation_system.sql`: Schema and Trigger logic.
- `services/enterprise-db.ts`: `getInvitations`, `createInvitation`, `cancelInvitation`.
- `services/teamService.ts`: Higher-level team management.

## 2. RBAC & Role Normalization

Role-Based Access Control has been standardized to handle case-insensitivity and different casing formats across the stack.

### Standards:
- **Database**: Stores roles in `snake_case` (e.g., `super_admin`, `lab_tech`).
- **Frontend Types**: Standardized on capitalized roles (e.g., `SuperAdmin`, `Lab Tech`).
- **Normalization**: Utilities in `lib/auth-context.tsx` and `lib/rbac-server.ts` handle conversion and case-insensitive checks.

### Case-Insensitive Checks:
The following functions now use normalized lowercase/underscore checks:
- `isSuperAdmin`
- `isOrgAdmin`
- `usePermission`
- `requireClinicAdmin` (server-side)
- `requireSuperAdmin` (server-side)

## 3. Multitenancy & Data Isolation

Data isolation between clinics is strictly enforced via Supabase Row Level Security (RLS).

### Secured Tables:
- `public.patients`
- `public.appointments`
- `public.visits`
- `public.inventory`
- `public.suppliers`
- `public.invitations`

### Enforcement Logic:
All operational tables now have RLS policies that check if `clinic_id = public.get_user_clinic_id()`. This ensures that even with a direct API request, a user can never access data belonging to another clinic.

## 4. Payment & Integration Flow

The generic payment webhook handler has been updated to handle specific operational updates.

### Supported Events:
- **Visit Payment**: Automatically updates `public.visits.payment_status` to 'Paid' when a transaction is successful (detected via `metadata.invoiceId`).
- **SaaS Plan Upgrade**: Upgrades the clinic's plan and status when a subscription payment is received.

## 5. Reporting Logic

Fixed a critical issue in `components/Reports.tsx` where completed visits were excluded from financial and clinical reports. Reports now reflect the full history of the clinic.

---

## Verification Steps (Mental Audit)

1.  [x] **Invite Flow**: Trigger correctly handles `public.invitations` and normalization.
2.  [x] **Signup Flow**: `clinicName` made optional to support invited users.
3.  [x] **RBAC**: Case-insensitive checks implemented in frontend and server utilities.
4.  [x] **RLS**: Policies enabled on all tenant-specific tables.
5.  [x] **AI Assistant**: Permitted data context checked against normalized roles.
