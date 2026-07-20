const Job = require("../models/Job");

// Every job list/search/dashboard endpoint is scoped by who's asking:
// signed-in users only ever see their OWN uploaded jobs; guests only ever
// see the public sample/demo dataset. This is the single choke point for
// that rule — every query in this file starts from this filter.
function ownerScope(req) {
  return req.user ? { owner: req.user._id } : { isSample: true };
}

// Shared query builder for filters used across /jobs, /jobs/filter, /jobs/search
function buildFilterQuery(q, req) {
  const query = { ...ownerScope(req) };

  if (q.location) query.location = { $regex: q.location, $options: "i" };
  if (q.company) query.company = { $regex: q.company, $options: "i" };
  if (q.industry) query.industry = { $regex: q.industry, $options: "i" };
  if (q.employmentType) query.employmentType = { $regex: q.employmentType, $options: "i" };
  if (q.education) query.education = { $regex: q.education, $options: "i" };
  if (q.jobType) query.jobType = q.jobType;
  if (q.experience) query.experience = { $regex: q.experience, $options: "i" };
  if (q.remote === "true") query.remote = true;

  if (q.skill) {
    const skillsArr = Array.isArray(q.skill) ? q.skill : String(q.skill).split(",");
    query.skills = { $in: skillsArr.map((s) => new RegExp(s.trim(), "i")) };
  }

  if (q.minSalary || q.maxSalary) {
    query.salaryMin = {};
    if (q.minSalary) query.salaryMin.$gte = Number(q.minSalary);
    if (q.maxSalary) query.salaryMax = { $lte: Number(q.maxSalary) };
  }

  if (q.search) {
    query.$or = [
      { jobTitle: { $regex: q.search, $options: "i" } },
      { company: { $regex: q.search, $options: "i" } },
      { skills: { $regex: q.search, $options: "i" } },
      { description: { $regex: q.search, $options: "i" } },
      { location: { $regex: q.search, $options: "i" } },
    ];
  }

  return query;
}

function buildSort(sortBy) {
  switch (sortBy) {
    case "newest":
      return { postedDate: -1 };
    case "oldest":
      return { postedDate: 1 };
    case "salaryHigh":
      return { salaryMax: -1 };
    case "salaryLow":
      return { salaryMin: 1 };
    case "relevance":
    default:
      return { createdAt: -1 };
  }
}

const getJobs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 12);
    const skip = (page - 1) * limit;

    const query = buildFilterQuery(req.query, req);
    const sort = buildSort(req.query.sortBy);

    const [jobs, total] = await Promise.all([
      Job.find(query).sort(sort).skip(skip).limit(limit),
      Job.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Alias endpoints matching the requested API spec (/jobs/filter, /jobs/search)
const filterJobs = getJobs;
const searchJobs = getJobs;

const getJobById = async (req, res) => {
  try {
    // Ownership check on single-job lookups too — a signed-in user must
    // never be able to fetch another user's job by guessing/sharing an id
    // (e.g. via the Resume Analyzer's "View Details" modal).
    const job = await Job.findOne({ _id: req.params.id, ...ownerScope(req) });
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    res.json({ success: true, data: job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getFilterOptions = async (req, res) => {
  try {
    const scope = ownerScope(req);
    const [locations, companies, industries, employmentTypes, jobTypes, educations] = await Promise.all([
      Job.distinct("location", scope),
      Job.distinct("company", scope),
      Job.distinct("industry", scope),
      Job.distinct("employmentType", scope),
      Job.distinct("jobType", scope),
      Job.distinct("education", scope),
    ]);
    res.json({
      success: true,
      data: { locations, companies, industries, employmentTypes, jobTypes, educations },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getJobs, filterJobs, searchJobs, getJobById, getFilterOptions };
