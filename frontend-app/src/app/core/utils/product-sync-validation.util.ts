import {
  MAX_SERVER_ONLY_PRODUCTS,
  MAX_SYNC_CENTS,
  MAX_SYNC_MATCH_KEY_LENGTH,
  MAX_SYNC_NAME_LENGTH,
  MAX_SYNC_STOCK,
  MAX_SYNC_TEXT_LENGTH,
  ProductSyncBatchRequest,
  ProductSyncBatchResponse,
  ProductSyncServerRecord,
} from '../models/domain/product-sync.model';

function isBoundedWholeNumber(value: unknown, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= max;
}

function isBoundedText(value: unknown, max: number, required: boolean): boolean {
  if (typeof value !== 'string' || value.length > max) return false;
  return !required || value.trim().length > 0;
}

export function isValidServerRecord(record: ProductSyncServerRecord): boolean {
  return (
    typeof record === 'object' &&
    record !== null &&
    isBoundedText(record.matchKey, MAX_SYNC_MATCH_KEY_LENGTH, true) &&
    isBoundedText(record.name, MAX_SYNC_NAME_LENGTH, true) &&
    isBoundedText(record.category, MAX_SYNC_TEXT_LENGTH, false) &&
    isBoundedText(record.unit, MAX_SYNC_TEXT_LENGTH, false) &&
    isBoundedWholeNumber(record.priceCents, MAX_SYNC_CENTS) &&
    isBoundedWholeNumber(record.costCents, MAX_SYNC_CENTS) &&
    isBoundedWholeNumber(record.stockOnHand, MAX_SYNC_STOCK) &&
    typeof record.active === 'boolean'
  );
}

function recordsMatchRequest(
  request: ProductSyncBatchRequest,
  response: ProductSyncBatchResponse
): boolean {
  if (!Array.isArray(response.records) || response.records.length !== request.records.length) {
    return false;
  }
  return response.records.every(
    (record, index) =>
      isValidServerRecord(record) && record.matchKey === request.records[index].matchKey
  );
}

function serverOnlyRecordsAreValid(
  request: ProductSyncBatchRequest,
  response: ProductSyncBatchResponse
): boolean {
  if (!Array.isArray(response.serverOnlyRecords)) return false;
  if (response.serverOnlyRecords.length === 0) return true;
  const isFinal = request.batchNumber === request.totalBatches;
  if (!isFinal || response.serverOnlyRecords.length > MAX_SERVER_ONLY_PRODUCTS) return false;
  const appKeys = new Set(request.appMatchKeys ?? []);
  const seen = new Set<string>();
  return response.serverOnlyRecords.every(record => {
    const unique =
      isValidServerRecord(record) && !appKeys.has(record.matchKey) && !seen.has(record.matchKey);
    seen.add(record?.matchKey);
    return unique;
  });
}

export function isBatchResponseUsable(
  request: ProductSyncBatchRequest,
  response: ProductSyncBatchResponse
): boolean {
  if (typeof response !== 'object' || response === null) return false;
  if (response.batchNumber !== request.batchNumber) return false;
  return recordsMatchRequest(request, response) && serverOnlyRecordsAreValid(request, response);
}
