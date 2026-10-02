# 🚀 Getting Started with TIQRI Agentic Development Framework

## 🤖 Agentic Delivery Team — Features & Capabilities

This template ships with a working "agentic delivery team" — named Claude Code subagents
(defined in `.claude/agents/`, routed via `CLAUDE.md`) that turn a requirement into shipped,
reviewed code. Talk to **Sanjeewa (Team Lead)** or **Shiham (Product Owner)** directly; they
coordinate the rest of the team for you. See `CLAUDE.md` for the full roster and routing rules.

| Person | Role | Notes |
|---|---|---|
| **Sanjeewa** | Team Lead | Orchestrates end-to-end delivery via `*implement-workstream` |
| **Shiham** | Product Owner | Owns `docs/SOLUTION_PRD.md` and `docs/SOLUTION_TASKS.md` |
| Thilina | Business Analyst | Writes user stories (invoked internally by Sanjeewa) |
| Harinda | Backend Developer | API/entity/migration/Azure Functions work |
| Hasika | Frontend Developer | UI/screens against `docs/development-standards/FRONTEND_STANDARDS.md` |
| Milinda | DevOps Developer | Bicep infra and Azure DevOps pipeline YAML |
| Ravindu | Code Reviewer | Final gatekeeper — OWASP Top 10, threat model, DoD |

Key capabilities built into this framework:

- **Scope gate**: Sanjeewa will not delegate a change/feature that isn't already an item in
  `docs/SOLUTION_PRD.md` / `docs/SOLUTION_TASKS.md`. He'll flag it and ask whether to bring in
  Shiham to add it to the backlog first — new work always leaves a paper trail.
- **User story confirmation loop**: once Thilina drafts or updates a user story, Sanjeewa pauses
  and asks you to confirm it (or describe changes) before any plan/code is written — looping
  until you approve. Say **"continue with workstream/task N"** to skip straight to the plan phase
  if you've already reviewed that story.
- **No auto-handoff**: asking Shiham to update the PRD/Tasks does not automatically kick off
  implementation — that only happens when you (or an in-flight Sanjeewa orchestration) explicitly
  ask for it.
- **Threat model + security gate**: every plan includes a mandatory STRIDE-lite threat model;
  every review runs a full OWASP Top 10 pass before a workstream can be marked APPROVED.
- **Definition of Done tracking**: each workstream gets a per-workstream DoD checklist
  (`docs/checklists/`) with file:line evidence, validated by Ravindu before sign-off.
- **Design-folder precedence**: if `docs/design/` defines stylesheets/tokens/mockups for a
  screen, Hasika uses those exclusively — the reference template's styling is only a fallback
  for projects with no design folder of their own.
- **Latest-framework scaffolding**: for a brand-new frontend project, Hasika scaffolds with the
  latest stable framework/CLI version; the reference template under
  `docs/development-standards/template/` is used for coding standards/patterns only, never for
  framework or dependency versions.
- **Auto-regenerated progress page**: `docs/SOLUTION_PROGRESS.html` is rebuilt automatically
  every time `docs/SOLUTION_TASKS.md` changes — never hand-edit it.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **pnpm** (Package manager) - Install with: `npm install -g pnpm`
- **Azure CLI** - [Download here](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- **Git** - [Download here](https://git-scm.com/)

### Azure Setup
- **Azure Subscription** - Active subscription required
- **Azure Active Directory** - For authentication
- **Azure SQL Database** - For data storage

## 🎯 Step-by-Step Setup Guide

### 1. **Frontend Setup (Angular)**

```bash
# Navigate to frontend directory
cd frontend-app

# Create new Angular project
npx @angular/cli@latest new Projecting-app --routing --style=scss --skip-git --package-manager=pnpm --yes

# Navigate to project
cd Projecting-app

# Install Angular Material
pnpm add @angular/material @angular/cdk @angular/animations

# Install additional dependencies
pnpm add @angular/flex-layout @angular/common/http
pnpm add chart.js ng2-charts
pnpm add @azure/msal-angular @azure/msal-browser
```

### 2. **Backend Setup (Azure Functions)**

```bash
# Navigate to backend directory
cd ../backend-app

# Install Azure Functions Core Tools
npm install -g azure-functions-core-tools@4

# Create new Azure Functions project
func init Projecting-api --typescript --worker-runtime node

# Navigate to project
cd Projecting-api

# Install dependencies
npm install @azure/functions
npm install prisma @prisma/client
npm install @azure/identity @azure/keyvault-secrets
npm install jsonwebtoken @types/jsonwebtoken
npm install cors @types/cors
npm install helmet
npm install express-rate-limit
```

### 3. **Database Setup (Prisma)**

```bash
# In backend directory
npx prisma init

# Create schema file (see schema.prisma below)
# Generate Prisma client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init
```

### 4. **Environment Configuration**

Create `.env` files for both frontend and backend:

#### Frontend (.env)
```env
# Azure AD Configuration
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_REDIRECT_URI=http://localhost:4200

# API Configuration
API_BASE_URL=http://localhost:7071/api
```

#### Backend (.env)
```env
# Database
DATABASE_URL="sqlserver://your-server.database.windows.net:1433;database=Projecting-db;user=your-username;password=your-password;encrypt=true"

# Azure AD
AZURE_AD_TENANT_ID=your-tenant-id
AZURE_AD_CLIENT_ID=your-client-id
AZURE_AD_CLIENT_SECRET=your-client-secret

# Azure Key Vault
AZURE_KEY_VAULT_URL=https://your-keyvault.vault.azure.net/

# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string
```

## 🏗️ Project Structure

```
TestProject1/
├── .claude/agents/                   # Claude agent team (already set up)
├── frontend-app/
│   └── Projecting-app/
│       ├── src/
│       │   ├── app/
│       │   │   ├── core/             # Core services, guards, interceptors
│       │   │   ├── shared/           # Shared components, pipes, directives
│       │   │   ├── features/         # Feature modules
│       │   │   │   ├── auth/         # Authentication
│       │   │   │   ├── dashboard/    # Dashboard
│       │   │   │   ├── departments/  # Department management
│       │   │   │   ├── Projects/      # Project management
│       │   │   │   ├── requests/     # Project requests
│       │   │   │   └── reports/      # Reports & analytics
│       │   │   └── models/           # TypeScript interfaces
│       │   └── assets/
│       └── package.json
├── backend-app/
│   └── Projecting-api/
│       ├── src/
│       │   ├── functions/            # Azure Functions
│       │   ├── services/             # Business logic services
│       │   ├── models/               # Data models
│       │   ├── middleware/           # Custom middleware
│       │   └── utils/                # Utility functions
│       ├── prisma/
│       │   └── schema.prisma         # Database schema
│       └── package.json
└── Projecting_App_PRD.md
```

## 🎨 Key Features to Implement

> This is an illustrative phase plan for the sample app. The actual source of truth for scope
> is `docs/SOLUTION_PRD.md` (requirements) and `docs/SOLUTION_TASKS.md` (the task backlog,
> owned by Shiham). To add or change scope, ask Shiham to update the PRD/Tasks rather than
> editing this list directly — Sanjeewa's scope gate will only let a workstream proceed once
> it's backed by an item there.

### Phase 1: Foundation (Weeks 1-2)
- [ ] Azure infrastructure setup
- [ ] Authentication system (Azure AD)
- [ ] Basic user and department management
- [ ] Core database schema

### Phase 2: Core Features (Weeks 3-4)
- [ ] Project creation and management
- [ ] Basic reporting functionality
- [ ] User interface development
- [ ] API development

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Approval workflows
- [ ] Advanced reporting and analytics
- [ ] Mobile responsiveness
- [ ] Performance optimization

### Phase 4: Testing & Deployment (Weeks 7-8)
- [ ] User acceptance testing
- [ ] Security testing and compliance
- [ ] Performance testing
- [ ] Production deployment

## 🚀 Quick Start Commands

### Frontend Development
```bash
cd frontend-app/Projecting-app
pnpm install
pnpm start
```

### Backend Development
```bash
cd backend-app/Projecting-api
npm install
npm run start
```

### Database Management
```bash
cd backend-app/Projecting-api
npx prisma studio          # Database GUI
npx prisma migrate dev     # Run migrations
npx prisma generate        # Generate client
```

## 📋 Next Immediate Steps

1. **Set up Azure Resources**:
   - Create Azure SQL Database
   - Set up Azure Active Directory app registration
   - Configure Azure Key Vault
   - Set up Azure Application Insights

2. **Initialize Projects**:
   - Run the frontend setup commands
   - Run the backend setup commands
   - Configure environment variables

3. **Start Development**:
   - Begin with authentication setup
   - Create basic user management
   - Implement department structure

## 🛠️ Development Tools

- **VS Code Extensions**:
  - Angular Language Service
  - Prisma
  - Azure Functions
  - Azure Account
  - Cursor (already configured with rules)

- **Browser Extensions**:
  - Angular DevTools
  - Redux DevTools (if using state management)

## 📞 Support

- **Documentation**: Check `docs/SOLUTION_PRD.md` for detailed requirements
- **Agent Team**: See `CLAUDE.md` and `.claude/agents/` for the delivery team, routing rules, and coding standards — talk to Sanjeewa or Shiham to get started
- **Azure Docs**: [Azure Functions](https://docs.microsoft.com/en-us/azure/azure-functions/)
- **Angular Docs**: [Angular Documentation](https://angular.io/docs)

---

**Ready to start?** Begin with the Azure resource setup and then move to the project initialization steps above! 🎉


