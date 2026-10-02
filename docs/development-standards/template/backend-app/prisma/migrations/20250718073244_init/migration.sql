BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Organization] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Code] VARCHAR(255) NOT NULL,
    [Name] VARCHAR(500) NOT NULL,
    [Email] VARCHAR(500),
    [UserAllowedDomain] VARCHAR(500),
    [IsActive] BIT NOT NULL CONSTRAINT [Organization_IsActive_df] DEFAULT 0,
    [IsArchived] BIT NOT NULL CONSTRAINT [Organization_IsArchived_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [Organization_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [CreatedBy] VARCHAR(255) NOT NULL,
    [UpdatedAt] DATETIME2 NOT NULL,
    [UpdatedBy] VARCHAR(255) NOT NULL,
    [ArchivedAt] DATETIME2,
    [ArchivedBy] VARCHAR(255),
    CONSTRAINT [Organization_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[SystemUser] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [Name] VARCHAR(500) NOT NULL,
    [Email] VARCHAR(500) NOT NULL,
    [ProfileId] VARCHAR(500) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [SystemUser_IsActive_df] DEFAULT 0,
    [IsArchived] BIT NOT NULL CONSTRAINT [SystemUser_IsArchived_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [SystemUser_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [CreatedBy] VARCHAR(255) NOT NULL,
    [UpdatedAt] DATETIME2 NOT NULL,
    [UpdatedBy] VARCHAR(255) NOT NULL,
    [ArchivedAt] DATETIME2,
    [ArchivedBy] VARCHAR(255),
    CONSTRAINT [SystemUser_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- CreateTable
CREATE TABLE [dbo].[OrganizationUserAllocation] (
    [Id] INT NOT NULL IDENTITY(1,1),
    [OrganizationId] INT NOT NULL,
    [SystemUserId] INT NOT NULL,
    [AllocationKey] VARCHAR(255) NOT NULL,
    [IsActive] BIT NOT NULL CONSTRAINT [OrganizationUserAllocation_IsActive_df] DEFAULT 0,
    [IsArchived] BIT NOT NULL CONSTRAINT [OrganizationUserAllocation_IsArchived_df] DEFAULT 0,
    [CreatedAt] DATETIME2 NOT NULL CONSTRAINT [OrganizationUserAllocation_CreatedAt_df] DEFAULT CURRENT_TIMESTAMP,
    [CreatedBy] VARCHAR(255) NOT NULL,
    [UpdatedAt] DATETIME2 NOT NULL,
    [UpdatedBy] VARCHAR(255) NOT NULL,
    [ArchivedAt] DATETIME2,
    [ArchivedBy] VARCHAR(255),
    CONSTRAINT [OrganizationUserAllocation_pkey] PRIMARY KEY CLUSTERED ([Id])
);

-- AddForeignKey
ALTER TABLE [dbo].[OrganizationUserAllocation] ADD CONSTRAINT [OrganizationUserAllocation_OrganizationId_fkey] FOREIGN KEY ([OrganizationId]) REFERENCES [dbo].[Organization]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[OrganizationUserAllocation] ADD CONSTRAINT [OrganizationUserAllocation_SystemUserId_fkey] FOREIGN KEY ([SystemUserId]) REFERENCES [dbo].[SystemUser]([Id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
