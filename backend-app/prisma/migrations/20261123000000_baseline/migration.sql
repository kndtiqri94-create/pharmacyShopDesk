-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "entities" (
    "collection" TEXT NOT NULL,
    "id" TEXT NOT NULL,
    "unique_key" TEXT,
    "date_key" TEXT,
    "data" JSONB NOT NULL,
    "ord" BIGINT NOT NULL,
    "seq" BIGINT NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("collection","id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "seq" BIGINT NOT NULL,
    "product_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "qty_delta" INTEGER NOT NULL,
    "ref_id" TEXT,
    "user_id" TEXT,
    "device_code" TEXT NOT NULL,
    "occurred_at" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_changes" (
    "change_id" TEXT NOT NULL,
    "device_code" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_changes_pkey" PRIMARY KEY ("change_id")
);

-- CreateIndex
CREATE INDEX "entities_seq_idx" ON "entities"("seq");

-- CreateIndex
CREATE INDEX "entities_collection_ord_idx" ON "entities"("collection", "ord");

-- CreateIndex
CREATE INDEX "entities_collection_date_key_idx" ON "entities"("collection", "date_key");

-- CreateIndex
CREATE UNIQUE INDEX "entities_collection_unique_key_key" ON "entities"("collection", "unique_key");

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_seq_key" ON "stock_movements"("seq");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_batch_id_idx" ON "stock_movements"("product_id", "batch_id");

-- CreateIndex
CREATE INDEX "stock_movements_type_idx" ON "stock_movements"("type");

-- CreateIndex
CREATE INDEX "stock_movements_ref_id_idx" ON "stock_movements"("ref_id");


-- Shared change sequence: orders every entity and stock movement change for the sync cursor.
CREATE SEQUENCE IF NOT EXISTS "change_seq" AS BIGINT START 1;
