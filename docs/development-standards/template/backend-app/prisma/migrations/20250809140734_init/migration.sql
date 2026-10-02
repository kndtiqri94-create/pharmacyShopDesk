BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [email] NVARCHAR(1000) NOT NULL,
    [displayName] NVARCHAR(1000) NOT NULL,
    [role] NVARCHAR(1000) NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [users_isActive_df] DEFAULT 1,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [users_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [users_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [users_email_key] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[departments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [isFinanceDepartment] BIT NOT NULL CONSTRAINT [departments_isFinanceDepartment_df] DEFAULT 0,
    [parentDepartmentId] INT,
    [budgetPeriod] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [departments_isActive_df] DEFAULT 1,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [departments_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [departments_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [departments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [departments_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[user_departments] (
    [id] INT NOT NULL IDENTITY(1,1),
    [userId] INT NOT NULL,
    [departmentId] INT NOT NULL,
    [isPrimary] BIT NOT NULL CONSTRAINT [user_departments_isPrimary_df] DEFAULT 0,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [user_departments_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [user_departments_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [user_departments_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [user_departments_userId_departmentId_key] UNIQUE NONCLUSTERED ([userId],[departmentId])
);

-- CreateTable
CREATE TABLE [dbo].[budget_categories] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [accountCode] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [budget_categories_isActive_df] DEFAULT 1,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_categories_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_categories_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [budget_categories_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[budget_sub_categories] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(1000) NOT NULL,
    [accountCode] NVARCHAR(1000),
    [description] NVARCHAR(1000),
    [budgetCategoryId] INT NOT NULL,
    [isActive] BIT NOT NULL CONSTRAINT [budget_sub_categories_isActive_df] DEFAULT 1,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_sub_categories_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_sub_categories_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_sub_categories_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [budget_sub_categories_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[budgets] (
    [id] INT NOT NULL IDENTITY(1,1),
    [departmentId] INT NOT NULL,
    [fiscalYear] INT NOT NULL,
    [month] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [approvedBy] INT,
    [approvedAt] DATETIME2,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budgets_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budgets_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budgets_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [budgets_departmentId_fiscalYear_month_key] UNIQUE NONCLUSTERED ([departmentId],[fiscalYear],[month])
);

-- CreateTable
CREATE TABLE [dbo].[budget_requests] (
    [id] INT NOT NULL IDENTITY(1,1),
    [departmentId] INT NOT NULL,
    [requestedBy] INT NOT NULL,
    [status] NVARCHAR(1000) NOT NULL,
    [departmentManagerApprovedBy] INT,
    [departmentManagerApprovedAt] DATETIME2,
    [financeApprovedBy] INT,
    [financeApprovedAt] DATETIME2,
    [rejectionReason] NVARCHAR(1000),
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_requests_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_requests_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[monthly_budget_requests] (
    [id] INT NOT NULL IDENTITY(1,1),
    [budgetRequestId] INT NOT NULL,
    [budgetSubCategoryId] INT NOT NULL,
    [requestedAmount] DECIMAL(18,2) NOT NULL,
    [reason] NVARCHAR(1000) NOT NULL,
    [month] INT NOT NULL,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [monthly_budget_requests_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [monthly_budget_requests_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [monthly_budget_requests_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateTable
CREATE TABLE [dbo].[budget_allocations] (
    [id] INT NOT NULL IDENTITY(1,1),
    [budgetId] INT NOT NULL,
    [budgetSubCategoryId] INT NOT NULL,
    [allocatedAmount] DECIMAL(18,2) NOT NULL,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_allocations_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_allocations_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_allocations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [budget_allocations_budgetId_budgetSubCategoryId_key] UNIQUE NONCLUSTERED ([budgetId],[budgetSubCategoryId])
);

-- CreateTable
CREATE TABLE [dbo].[budget_actuals] (
    [id] INT NOT NULL IDENTITY(1,1),
    [budgetId] INT NOT NULL,
    [budgetSubCategoryId] INT NOT NULL,
    [actualAmount] DECIMAL(18,2) NOT NULL,
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_actuals_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_actuals_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_actuals_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [budget_actuals_budgetId_budgetSubCategoryId_key] UNIQUE NONCLUSTERED ([budgetId],[budgetSubCategoryId])
);

-- CreateTable
CREATE TABLE [dbo].[budget_request_audit_logs] (
    [id] INT NOT NULL IDENTITY(1,1),
    [budgetRequestId] INT NOT NULL,
    [action] NVARCHAR(1000) NOT NULL,
    [performedBy] INT NOT NULL,
    [performedAt] DATETIME2 NOT NULL CONSTRAINT [budget_request_audit_logs_performedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [previousStatus] NVARCHAR(1000),
    [newStatus] NVARCHAR(1000),
    [comments] NVARCHAR(1000),
    [additionalData] NVARCHAR(1000),
    [dateCreated] DATETIME2 NOT NULL CONSTRAINT [budget_request_audit_logs_dateCreated_df] DEFAULT CURRENT_TIMESTAMP,
    [userCreated] NVARCHAR(1000) NOT NULL,
    [dateLastUpdated] DATETIME2 NOT NULL,
    [lastUpdatedBy] NVARCHAR(1000) NOT NULL,
    [isArchived] BIT NOT NULL CONSTRAINT [budget_request_audit_logs_isArchived_df] DEFAULT 0,
    [archivedBy] NVARCHAR(1000),
    [dateArchived] DATETIME2,
    CONSTRAINT [budget_request_audit_logs_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- AddForeignKey
ALTER TABLE [dbo].[departments] ADD CONSTRAINT [departments_parentDepartmentId_fkey] FOREIGN KEY ([parentDepartmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_departments] ADD CONSTRAINT [user_departments_userId_fkey] FOREIGN KEY ([userId]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[user_departments] ADD CONSTRAINT [user_departments_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_sub_categories] ADD CONSTRAINT [budget_sub_categories_budgetCategoryId_fkey] FOREIGN KEY ([budgetCategoryId]) REFERENCES [dbo].[budget_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budgets] ADD CONSTRAINT [budgets_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budgets] ADD CONSTRAINT [budgets_approvedBy_fkey] FOREIGN KEY ([approvedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_requests] ADD CONSTRAINT [budget_requests_departmentId_fkey] FOREIGN KEY ([departmentId]) REFERENCES [dbo].[departments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_requests] ADD CONSTRAINT [budget_requests_requestedBy_fkey] FOREIGN KEY ([requestedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[monthly_budget_requests] ADD CONSTRAINT [monthly_budget_requests_budgetRequestId_fkey] FOREIGN KEY ([budgetRequestId]) REFERENCES [dbo].[budget_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[monthly_budget_requests] ADD CONSTRAINT [monthly_budget_requests_budgetSubCategoryId_fkey] FOREIGN KEY ([budgetSubCategoryId]) REFERENCES [dbo].[budget_sub_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_allocations] ADD CONSTRAINT [budget_allocations_budgetId_fkey] FOREIGN KEY ([budgetId]) REFERENCES [dbo].[budgets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_allocations] ADD CONSTRAINT [budget_allocations_budgetSubCategoryId_fkey] FOREIGN KEY ([budgetSubCategoryId]) REFERENCES [dbo].[budget_sub_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_actuals] ADD CONSTRAINT [budget_actuals_budgetId_fkey] FOREIGN KEY ([budgetId]) REFERENCES [dbo].[budgets]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_actuals] ADD CONSTRAINT [budget_actuals_budgetSubCategoryId_fkey] FOREIGN KEY ([budgetSubCategoryId]) REFERENCES [dbo].[budget_sub_categories]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_request_audit_logs] ADD CONSTRAINT [budget_request_audit_logs_budgetRequestId_fkey] FOREIGN KEY ([budgetRequestId]) REFERENCES [dbo].[budget_requests]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[budget_request_audit_logs] ADD CONSTRAINT [budget_request_audit_logs_performedBy_fkey] FOREIGN KEY ([performedBy]) REFERENCES [dbo].[users]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
