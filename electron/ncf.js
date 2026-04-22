const { getDB } = require("./db/init");
const { ncfSequences } = require("./db/schema");
const { eq } = require("drizzle-orm");

// NCF Structure:
// B01: Crédito Fiscal (11 chars) -> B + 01 + Sequence (8 digits)
// B02: Consumo Final (11 chars) -> B + 02 + Sequence (8 digits)
// B15: Gubernamental (11 chars) -> B + 15 + Sequence (8 digits)

const getNextNCF = async (type) => {
  const db = getDB();

  // 1. Get current sequence
  const seq = db
    .select()
    .from(ncfSequences)
    .where(eq(ncfSequences.type, type))
    .get();

  if (!seq) throw new Error(`NCF Type ${type} not configured.`);

  if (seq.current >= seq.limit)
    throw new Error(`NCF Limit Reached for ${type}`);

  // 2. Generate NCF String
  // Format: B + type (01/02/15) + 00000001 (padded)
  // Actually the 'type' column stores 'B01', 'B02', so we just append padded sequence
  // But standard is: The 'type' is distinct from the prefix?
  // Usually B01 is the series.
  // Let's assume Type is 'B01', 'B02', 'B15'.

  // Series B is constant for standard invoices?
  // In DGII, NCF is 11 chars.
  // Position 1: Series (B)
  // Position 2-3: Type (01, 02, 14, 15)
  // Position 4-11: Sequence (8 digits)

  const prefix = type; // e.g., 'B01'
  const nextVal = seq.current + 1;
  const paddedSeq = nextVal.toString().padStart(8, "0");

  return `${prefix}${paddedSeq}`;
};

const incrementNCF = async (type) => {
  const db = getDB();
  const seq = db
    .select()
    .from(ncfSequences)
    .where(eq(ncfSequences.type, type))
    .get();
  if (seq) {
    db.update(ncfSequences)
      .set({ current: seq.current + 1 })
      .where(eq(ncfSequences.type, type))
      .run();
  }
};

module.exports = { getNextNCF, incrementNCF };
