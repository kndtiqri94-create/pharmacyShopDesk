# Department Project Manager Application

A comprehensive Project management system built with Angular 18+ and Azure Functions.

## 🤖 Agentic Delivery Team

This project is built by a named team of Claude Code subagents defined in `.claude/agents/`
and routed via `CLAUDE.md`. Talk to **Sanjeewa (Team Lead)** or **Shiham (Product Owner)**
directly — e.g. *"Tell Sanjeewa to implement workstream 3"* or *"Ask Shiham to update the PRD"*
— and they coordinate the Business Analyst, Backend/Frontend/DevOps Developers, and Code
Reviewer for you. See `CLAUDE.md` for the full roster and routing rules.

## 🏗️ Project Structure

```
root/
├── frontend-app/          # Angular 18+ application
│   ├── src/
│   │   ├── app/          # Application components and services
│   │   ├── assets/       # Static assets
│   │   └── environments/ # Environment configurations
│   ├── package.json      # Frontend dependencies
│   └── angular.json      # Angular CLI configuration
├── mobile-pwa/           # PWA Web App for mobile 
├── backend-app/          # Azure Functions backend
│   ├── src/
│   │   └── functions/    # Azure Functions
│   ├── package.json      # Backend dependencies
│   └── schema.prisma     # Database schema
├── .claude/              # Claude agent team and configuration
└── docs/                 # Project documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Angular CLI 18+
- Azure Functions Core Tools
- Azure CLI (for deployment)

### Frontend Setup
```bash
cd frontend-app
npm install
ng serve
```

### Backend Setup
```bash
cd backend-app
npm install
npm run start
```

## 🛠️ Technology Stack

### Frontend
- **Framework**: Angular 18+
- **UI Library**: Angular Material
- **Authentication**: Azure AD (MSAL)
- **Styling**: SCSS
- **Testing**: Jasmine + Karma

### Backend
- **Runtime**: Azure Functions (Node.js)
- **Language**: TypeScript
- **Database**: Azure SQL
- **ORM**: Prisma
- **Authentication**: Azure AD

## 📁 Key Files for Cursor AI

### Configuration Files
- `CLAUDE.md` - Root-level agent routing rules
- `.claude/agents/` - The agent team (Team Lead, Product Owner, and specialists) and dev standards config
- `tsconfig.json` - TypeScript configuration
- `angular.json` - Angular CLI configuration
- `package.json` - Dependencies and scripts

### Documentation
- `README.md` - Project overview and setup
- `GETTING_STARTED.md` - Detailed setup instructions
- `Projecting_App_PRD.md` - Product requirements

### Environment Files
- `frontend-app/src/environments/` - Environment configurations
- `backend-app/local.settings.json` - Local Azure Functions settings

## 🔧 Development Workflow

1. **Feature Development**
   - Create feature branch
   - Implement frontend components
   - Add backend functions
   - Write tests
   - Update documentation

2. **Testing**
   - Unit tests with Jasmine
   - Integration tests
   - E2E tests (if applicable)

3. **Deployment**
   - Frontend: Azure Static Web Apps
   - Backend: Azure Functions
   - Database: Azure SQL

## 📚 Documentation

- [Angular Documentation](https://angular.dev/)
- [Azure Functions Documentation](https://docs.microsoft.com/en-us/azure/azure-functions/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Azure AD Documentation](https://docs.microsoft.com/en-us/azure/active-directory/)

## 🤝 Contributing

1. Follow the coding standards in `docs/development-standards/`
2. Write comprehensive tests
3. Update documentation
4. Use conventional commits

## 📄 License

This project is proprietary and confidential.
