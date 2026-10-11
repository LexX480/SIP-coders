const Distribution = require("../models/Distribution");
const DuplicationAlert = require("../models/DuplicationAlert");

/**
 * MVP duplication detection.
 *
 * Rule: if 2+ DISTINCT organizations log the same resourceType (and, when
 * given, the same subCategory) in the same ward within a rolling time
 * window, treat it as a likely duplicate cluster.
 *
 * subCategory is matched when the new entry has one, so that, say, torches
 * and batteries - both "electrical" - don't cross-flag each other just for
 * sharing a broad category. Matching falls back to category-only when the
 * new entry has no subCategory, which keeps old behavior for any record
 * that never set one.
 */
async function checkForDuplication(newDistribution) {
  const windowHours = Number(process.env.DUPLICATION_WINDOW_HOURS || 48);
  const orgThreshold = Number(process.env.DUPLICATION_ORG_THRESHOLD || 2);
  const windowStart = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const matchQuery = {
    ward: newDistribution.ward,
    resourceType: newDistribution.resourceType,
    loggedAt: { $gte: windowStart },
  };
  if (newDistribution.subCategory) {
    matchQuery.subCategory = newDistribution.subCategory;
  }

  const overlapping = await Distribution.find(matchQuery).select("_id organization");

  const distinctOrgIds = new Set(
    overlapping.map((d) => d.organization.toString())
  );

  if (distinctOrgIds.size < orgThreshold) {
    return { flagged: false };
  }

  const distributionIds = overlapping.map((d) => d._id);

  const itemLabel = newDistribution.subCategory
    ? newDistribution.subCategory.replace(/_/g, " ")
    : newDistribution.resourceType;

  await Distribution.updateMany(
    { _id: { $in: distributionIds } },
    {
      $set: {
        status: "possible_duplicate",
        duplicateNote: `${distinctOrgIds.size} organizations reported delivering ${itemLabel} here`,
      },
    }
  );

  const alert = await DuplicationAlert.findOneAndUpdate(
    {
      ward: newDistribution.ward,
      resourceType: newDistribution.resourceType,
      status: "pending",
    },
    {
      $set: { organizationCount: distinctOrgIds.size },
      $addToSet: { distributions: { $each: distributionIds } },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { flagged: true, alert };
}

module.exports = { checkForDuplication };