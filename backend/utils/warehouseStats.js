const InventoryTransaction = require("../models/InventoryTransaction");

// Total units currently held per warehouse, summed from the inventory
// ledger (never stored directly). Returns a Map of warehouseId string ->
// total, floored at 0 so a bad manual removal can't show negative stock.
async function getStockTotals(warehouseIds) {
  const rows = await InventoryTransaction.aggregate([
    { $match: { warehouse: { $in: warehouseIds } } },
    { $group: { _id: "$warehouse", total: { $sum: "$quantityChange" } } },
  ]);

  const totals = new Map();
  for (const r of rows) totals.set(String(r._id), Math.max(0, r.total));
  return totals;
}

// Plain-object copy of a warehouse plus its capacity usage, so the frontend
// can show "64% full" / "Full" without doing its own maths.
function withStats(warehouse, stockTotal = 0) {
  const obj = typeof warehouse.toObject === "function" ? warehouse.toObject() : { ...warehouse };
  const capacity = obj.capacity || null;

  return {
    ...obj,
    stockTotal,
    percentFull: capacity ? Math.min(100, Math.round((stockTotal / capacity) * 100)) : null,
    spaceLeft: capacity ? Math.max(0, capacity - stockTotal) : null,
    isFull: capacity ? stockTotal >= capacity : false,
  };
}

module.exports = { getStockTotals, withStats };