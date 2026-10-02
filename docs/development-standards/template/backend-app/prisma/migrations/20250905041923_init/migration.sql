/*
  Warnings:

  - You are about to drop the `budget_actuals` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budget_allocations` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budget_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budget_request_audit_logs` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budget_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budget_sub_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `budgets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `monthly_budget_requests` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `user_departments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `users` table. If the table is not empty, all the data it contains will be lost.

*/
BEGIN TRY

BEGIN TRAN;

-- DropForeignKey
ALTER TABLE [dbo].[budget_actuals] DROP CONSTRAINT [budget_actuals_budgetId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_actuals] DROP CONSTRAINT [budget_actuals_budgetSubCategoryId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_allocations] DROP CONSTRAINT [budget_allocations_budgetId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_allocations] DROP CONSTRAINT [budget_allocations_budgetSubCategoryId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_request_audit_logs] DROP CONSTRAINT [budget_request_audit_logs_budgetRequestId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_request_audit_logs] DROP CONSTRAINT [budget_request_audit_logs_performedBy_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_requests] DROP CONSTRAINT [budget_requests_departmentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_requests] DROP CONSTRAINT [budget_requests_requestedBy_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budget_sub_categories] DROP CONSTRAINT [budget_sub_categories_budgetCategoryId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budgets] DROP CONSTRAINT [budgets_approvedBy_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[budgets] DROP CONSTRAINT [budgets_departmentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[departments] DROP CONSTRAINT [departments_parentDepartmentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[monthly_budget_requests] DROP CONSTRAINT [monthly_budget_requests_budgetRequestId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[monthly_budget_requests] DROP CONSTRAINT [monthly_budget_requests_budgetSubCategoryId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[user_departments] DROP CONSTRAINT [user_departments_departmentId_fkey];

-- DropForeignKey
ALTER TABLE [dbo].[user_departments] DROP CONSTRAINT [user_departments_userId_fkey];

-- DropTable
DROP TABLE [dbo].[budget_actuals];

-- DropTable
DROP TABLE [dbo].[budget_allocations];

-- DropTable
DROP TABLE [dbo].[budget_categories];

-- DropTable
DROP TABLE [dbo].[budget_request_audit_logs];

-- DropTable
DROP TABLE [dbo].[budget_requests];

-- DropTable
DROP TABLE [dbo].[budget_sub_categories];

-- DropTable
DROP TABLE [dbo].[budgets];

-- DropTable
DROP TABLE [dbo].[departments];

-- DropTable
DROP TABLE [dbo].[monthly_budget_requests];

-- DropTable
DROP TABLE [dbo].[user_departments];

-- DropTable
DROP TABLE [dbo].[users];

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
