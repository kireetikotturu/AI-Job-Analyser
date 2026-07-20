const Job = require("../models/Job");

// Same access rule as jobController: signed-in users only ever see their
// own uploaded jobs on the dashboard; guests only ever see the public
// sample dataset. Never mix the two.
function ownerScope(req) {
  return req.user ? { owner: req.user._id } : { isSample: true };
}

// Many sheets list a job as open across several cities in one cell, e.g.
// "Hyderabad, Bengaluru, Chennai" (common for campus/bulk hiring rows).
// Grouping on the raw string turns that combo into its own bucket instead
// of counting toward each city — that's why "Top Locations" was showing
// a combined string as if it were one place. This splits on comma/slash/
// pipe and counts the job once for every city it lists, same approach as
// how skills are unwound (one count per skill per job, not divided).
function splitLocationString(raw) {
  const parts = String(raw || "")
    .split(/[,/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : ["Not specified"];
}

async function getLocationCounts(scope) {
  const jobs = await Job.find(scope, { location: 1 }).lean();
  const counts = new Map();
  for (const job of jobs) {
    for (const loc of splitLocationString(job.location)) {
      counts.set(loc, (counts.get(loc) || 0) + 1);
    }
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return {
    totalUnique: counts.size,
    top: sorted.slice(0, 8).map(([location, count]) => ({ location, count })),
  };
}

// Sheets list the same skill under different casings ("python" vs "Python"),
// which used to make the group-by count them as two separate skills. This
// groups all casings of a skill together (case-insensitive) and picks
// whichever original casing appeared most often as the display label, so
// "Python" and "python" become one combined entry instead of two.
async function getSkillCounts(limit, scope) {
  const raw = await Job.aggregate([
    { $match: scope },
    { $unwind: "$skills" },
    { $match: { skills: { $nin: [null, ""] } } },
    { $group: { _id: "$skills", count: { $sum: 1 } } },
  ]);

  const merged = new Map(); // lowercased skill -> { label, count, bestVariantCount }
  for (const { _id: skill, count } of raw) {
    const key = String(skill).trim().toLowerCase();
    if (!key) continue;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { label: skill, count, bestVariantCount: count });
    } else {
      existing.count += count;
      if (count > existing.bestVariantCount) {
        existing.label = skill;
        existing.bestVariantCount = count;
      }
    }
  }

  return [...merged.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map(({ label, count }) => ({ skill: label, count }));
}

// Companies with the highest average salary (midpoint of salaryMin/salaryMax).
// Requires at least 2 salaried postings from a company so one single
// high-salary listing can't crown a company "top paying" on its own.
async function getTopPayingCompanies(scope, limit = 8) {
  const rows = await Job.aggregate([
    { $match: { ...scope, salaryMin: { $ne: null }, salaryMax: { $ne: null } } },
    {
      $group: {
        _id: "$company",
        avgSalary: { $avg: { $avg: ["$salaryMin", "$salaryMax"] } },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gte: 2 } } },
    { $sort: { avgSalary: -1 } },
    { $limit: limit },
  ]);
  return rows.map((r) => ({ company: r._id, avgSalary: Math.round(r.avgSalary), count: r.count }));
}

const getDashboardStats = async (req, res) => {
  try {
    const scope = ownerScope(req);
    const [
      totalJobs,
      companiesAgg,
      avgSalaryAgg,
      topSkills,
      topCompaniesAgg,
      topPayingCompanies,
      jobsByExperience,
      jobsByIndustry,
      jobsTimeline,
      jobsByType,
      locationCounts,
    ] = await Promise.all([
      Job.countDocuments(scope),

      Job.distinct("company", scope),

      Job.aggregate([
        { $match: { ...scope, salaryMin: { $ne: null }, salaryMax: { $ne: null } } },
        {
          $group: {
            _id: null,
            avg: { $avg: { $avg: ["$salaryMin", "$salaryMax"] } },
          },
        },
      ]),

      // Case-insensitive: "python" and "Python" are now counted as one skill.
      getSkillCounts(10, scope),

      Job.aggregate([
        { $match: scope },
        { $group: { _id: "$company", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      getTopPayingCompanies(scope, 8),

      Job.aggregate([
        { $match: scope },
        { $group: { _id: "$experience", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      Job.aggregate([
        { $match: scope },
        { $group: { _id: "$industry", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      // Weekly posting trend (ISO year/week) instead of monthly — gives a
      // more useful, denser trend line for the "Jobs Posted Timeline"
      // chart, which used to look flat/uninteresting bucketed by month.
      Job.aggregate([
        { $match: scope },
        {
          $group: {
            _id: {
              isoYear: { $isoWeekYear: "$postedDate" },
              isoWeek: { $isoWeek: "$postedDate" },
            },
            count: { $sum: 1 },
            weekStart: { $min: "$postedDate" },
          },
        },
        { $sort: { "_id.isoYear": 1, "_id.isoWeek": 1 } },
        { $limit: 26 },
      ]),

      Job.aggregate([
        { $match: scope },
        { $group: { _id: "$jobType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      getLocationCounts(scope),
    ]);

    res.json({
      success: true,
      data: {
        totalJobs,
        totalCompanies: companiesAgg.length,
        totalLocations: locationCounts.totalUnique,
        averageSalary: avgSalaryAgg[0]?.avg ? Math.round(avgSalaryAgg[0].avg) : 0,
        topSkills,
        mostHiringCompanies: topCompaniesAgg.map((c) => ({ company: c._id, count: c.count })),
        topLocations: locationCounts.top,
        topPayingCompanies,
        // Same de-duped skill counts as topSkills, just trimmed to 8 entries
        // so each bar on the "Jobs by Skill" chart keeps enough room for its
        // label to stay readable instead of overlapping its neighbor.
        jobsBySkill: topSkills.slice(0, 8),
        jobsByExperience: jobsByExperience.map((e) => ({ experience: e._id || "Unknown", count: e.count })),
        jobsByIndustry: jobsByIndustry.map((i) => ({ industry: i._id || "Unknown", count: i.count })),
        jobsTimeline: jobsTimeline.map((t) => ({
          label: `Wk ${t._id.isoWeek} '${String(t._id.isoYear).slice(-2)}`,
          count: t.count,
        })),
        jobsByType: jobsByType.map((j) => ({ type: j._id, count: j.count })),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats };