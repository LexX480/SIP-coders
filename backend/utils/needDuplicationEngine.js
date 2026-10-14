const NeedReport = require("../models/NeedReport");
const DuplicationAlert = require("../models/DuplicationAlert");

/**
 * MVP duplication detection for need reports - the counterpart to
 * utils/duplicationEngine.js, which does the same thing for distributions.
 *
 * Rule (confirmed): 2+ still-open need reports for the same resourceType
 * (and, when given, the same subCategory) in the same ward within a
 * rolling time window are treated as a likely duplicate cluster - e.g.
 * several neighbors, or several members of the same family, each
 * separately reporting what is really one household's need. Unlike the
 * distribution engine, this does NOT require distinct reporter identities.
 */
async function checkNeedForDuplication(newNeed) {
  const windowHours = Number(process.env.DUPLICATION_WINDOW_HOURS || 48);
  const reportThreshold = Number(process.env.NEED_DUPLICATION_REPORT_THRESHOLD || 2);
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const matchQuery = {
    ward: newNeed.ward,
    resourceType: newNeed.resourceType,
    status: { $ne: "addressed" },
    createdAt: { $gte: windowStart },
  };
  if (newNeed.subCategory) {
    matchQuery.subCategory = newNeed.subCategory;
  }

  const overlapping = await NeedReport.find(matchQuery).select("_id");

  if (overlapping.length < reportThreshold) {
    return { flagged: false };
  }

  const needIds = overlapping.map((n) => n._id);

  const alert = await DuplicationAlert.findOneAndUpdate(
    {
      kind: "need",
      ward: newNeed.ward,
      resourceType: newNeed.resourceType,
      status: "pending",
    },
    {
      $set: { reportCount: overlapping.length },
      $addToSet: { needs: { $each: needIds } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { flagged: true, alert };
}

module.exports = { checkNeedForDuplication };