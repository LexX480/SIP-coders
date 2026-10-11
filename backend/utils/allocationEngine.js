const Ward = require("../models/Ward");
const Distribution = require("../models/Distribution");
const NeedReport = require("../models/NeedReport");

/**
 * MVP need-based allocation scoring (Section 3.5 / 4.3 of the proposal).
 *
 * The real model is a weighted / lightly-trained scoring model built and
 * evaluated in a Jupyter Notebook against damage severity, population,
 * supply already logged, reported unmet needs, and time since last
 * distribution. This function is that same weighted formula reimplemented
 * for the live backend so the Coordination Dashboard's priority list
 * (Screen 9) works end-to-end today; swap in real model output later
 * without changing the route contract.
 *
 * Higher score = higher priority (more unmet need).
 */
async function computeWardPriorities() {
  const wards = await Ward.find().lean();

  const scored = await Promise.all(
    wards.map(async (ward) => {
      const distributions = await Distribution.find({ ward: ward._id });
      const openNeeds = await NeedReport.find({
        ward: ward._id,
        status: "open",
      });

      const supplyLogged = distributions.reduce(
        (sum, d) => sum + d.quantity,
        0
      );

      const urgencyWeight = { low: 1, medium: 2, urgent: 3 };
      const unmetNeedScore = openNeeds.reduce(
        (sum, n) => sum + (urgencyWeight[n.urgency] || 1),
        0
      );

      const lastDistribution = distributions
        .map((d) => d.loggedAt)
        .sort((a, b) => b - a)[0];
      const hoursSinceLastDistribution = lastDistribution
        ? (Date.now() - new Date(lastDistribution).getTime()) / 3.6e6
        : 168; // treat "never served" as a full week stale

      // Weighted formula - tune freely once the notebook model is ready.
      const score =
        ward.damageSeverity * 20 +
        Math.min(ward.population / 1000, 20) +
        unmetNeedScore * 10 +
        Math.min(hoursSinceLastDistribution / 24, 10) * 5 -
        Math.min(supplyLogged / 50, 20);

      const topNeed = openNeeds.sort(
        (a, b) => (urgencyWeight[b.urgency] || 0) - (urgencyWeight[a.urgency] || 0)
      )[0];

      // Every distinct resource type currently requested in this ward, not
      // just the single highest-urgency one - so a second/third reported
      // need is never silently hidden behind needSummary.
      const resourceTypesNeeded = [...new Set(openNeeds.map((n) => n.resourceType))];

      return {
        ward: { _id: ward._id, name: ward.name, district: ward.district },
        score: Math.round(score * 10) / 10,
        openNeedsCount: openNeeds.length,
        resourceTypesNeeded,
        needSummary: topNeed
          ? `${topNeed.resourceType} needed`
          : "No open reports",
        urgency: topNeed ? topNeed.urgency : "low",
        location: ward.location,
      };
    })
  );

  return scored.sort((a, b) => b.score - a.score);
}

module.exports = { computeWardPriorities };
