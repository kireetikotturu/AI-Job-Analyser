const fs = require("fs");
const Job = require("../models/Job");
const ResumeUpload = require("../models/ResumeUpload");
const { extractTextFromResume } = require("../utils/parseResume");
const { analyzeResumeAgainstJobs } = require("../utils/aiService");
const { initialTotal, resolveRequestedTotal, planSnapshot, BASIC_CAP } = require("../utils/matchPlan");

// Runs the AI match, trims/sorts to `total`, and maps into the shape stored
// on ResumeUpload.recommendedJobs / returned to the client. Shared by the
// initial analysis and every "unlock more matches" re-run.
async function runMatch(resumeText, jobs, total) {
  const shortlistSize = Math.min(300, Math.max(40, total * 2));
  const { overallAtsScore, suggestedImprovements, results } = await analyzeResumeAgainstJobs(
    resumeText,
    jobs,
    shortlistSize
  );

  const jobMap = new Map(jobs.map((j) => [String(j._id), j]));
  const recommendedJobs = results
    .filter((r) => jobMap.has(r.id))
    .map((r) => {
      const job = jobMap.get(r.id);
      return {
        job: job._id,
        jobTitle: job.jobTitle,
        company: job.company,
        jobType: job.jobType,
        atsScore: r.atsScore,
        matchPercent: r.matchPercent,
        matchedSkills: r.matchedSkills || [],
        missingSkills: r.missingSkills || [],
        applyLink: job.applyLink,
      };
    })
    .sort((a, b) => b.matchPercent - a.matchPercent)
    .slice(0, total);

  return { overallAtsScore, suggestedImprovements, recommendedJobs };
}

// Only Pro users get the AI's "Suggested Improvements" bullets — Basic
// users still see the button/section, but the frontend renders an upgrade
// prompt instead of the content. Stripped server-side (not just hidden in
// the UI) so a Basic account can't read them straight from the API
// response either.
function shapeForPlan(doc, isPro) {
  return {
    id: doc._id,
    overallAtsScore: doc.overallAtsScore,
    suggestedImprovements: isPro ? doc.suggestedImprovements : [],
    suggestedImprovementsLocked: !isPro,
    recommendedJobs: doc.recommendedJobs,
    matchesUnlocked: doc.matchesUnlocked,
    fileName: doc.originalFileName || doc.fileName,
  };
}

// POST /resume — requires a signed-in user (see resumeRoutes). Runs the
// first pass: Basic plan starts at the Top 5 matches / 20 max, Pro starts
// at the Top 20 with no dropdown ceiling below 100.
const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No resume file uploaded" });
    }

    // A resume can never be analyzed before the user has their own job
    // dataset uploaded — there'd be nothing to match against, and this is
    // also the UX rule requested: "Please upload your Job Excel/CSV file
    // before uploading your resume."
    const hasJobData = await Job.exists({ owner: req.user._id });
    if (!hasJobData) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        code: "NO_JOB_DATA",
        message: "Please upload your Job Excel/CSV file before uploading your resume.",
      });
    }

    const resumeText = await extractTextFromResume(req.file.path);

    if (!resumeText || resumeText.trim().length < 30) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({
        success: false,
        message: "Could not extract enough text from the resume. Please upload a valid PDF/DOCX.",
      });
    }

    const isPro = req.user.isPro();
    // Basic plan: 20 matches/day shared across every resume analyzed today,
    // not reset per upload — so a new resume only gets whatever's left of
    // today's budget (which may be less than 5, or 0 once it's spent).
    const usedToday = req.user.getDailyMatchesUsed();
    const remainingToday = Math.max(0, BASIC_CAP - usedToday);
    const total = initialTotal(isPro, remainingToday);

    const jobs = await Job.find({ owner: req.user._id }).limit(500);

    const { overallAtsScore, suggestedImprovements, recommendedJobs } = await runMatch(resumeText, jobs, total);

    const resumeDoc = await ResumeUpload.create({
      fileName: req.file.originalname,
      extractedText: resumeText.slice(0, 10000),
      overallAtsScore,
      suggestedImprovements,
      recommendedJobs,
      matchesUnlocked: total,
      user: req.user._id,
      storedFileName: req.file.filename,
      originalFileName: req.file.originalname,
    });

    if (!isPro) {
      req.user.addDailyMatches(total);
      await req.user.save();
    }

    res.status(200).json({
      success: true,
      data: shapeForPlan(resumeDoc, isPro),
      progress: planSnapshot(isPro, total, isPro ? null : Math.max(0, BASIC_CAP - req.user.getDailyMatchesUsed())),
    });
  } catch (error) {
    console.error("Resume analysis error:", error);
    if (req.file) fs.unlink(req.file.path, () => {});
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /resume/:id/matches { requested } — re-runs the AI analysis against
// the SAME already-uploaded resume + job dataset (no re-upload needed) to
// unlock more matches. `requested` is an additive +N for Basic plans or an
// absolute total for Pro plans — see utils/matchPlan.
const requestMoreMatches = async (req, res) => {
  try {
    const doc = await ResumeUpload.findOne({ _id: req.params.id, user: req.user._id });
    if (!doc) return res.status(404).json({ success: false, message: "Resume analysis not found." });

    const isPro = req.user.isPro();
    const usedToday = req.user.getDailyMatchesUsed();
    const remainingToday = Math.max(0, BASIC_CAP - usedToday);
    const total = resolveRequestedTotal(isPro, doc.matchesUnlocked, req.body.requested, remainingToday);
    if (total === null) {
      return res.status(400).json({ success: false, message: "That match count isn't available on your plan." });
    }

    const jobs = await Job.find({ owner: req.user._id }).limit(500);
    if (jobs.length === 0) {
      return res.status(400).json({
        success: false,
        code: "NO_JOB_DATA",
        message: "Your job dataset is empty. Please re-upload your Job Excel/CSV file.",
      });
    }

    // Only the MATCHED JOB LIST is refreshed here. overallAtsScore and
    // suggestedImprovements were generated once, at the initial analysis,
    // and intentionally stay untouched from this point on — re-running the
    // AI on a bigger shortlist would otherwise regenerate fresh wording
    // for both every single time "unlock more" is clicked, which made the
    // same resume show different advice/score on every click instead of
    // one stable result.
    const { recommendedJobs } = await runMatch(doc.extractedText, jobs, total);

    // Only the newly-revealed portion counts against today's shared budget
    // — matches already shown for this resume were already charged earlier.
    const increment = total - doc.matchesUnlocked;

    // Atomic update instead of the previous load -> mutate -> doc.save()
    // pattern. That pattern relies on Mongoose's optimistic-concurrency
    // version check, which throws a VersionError if anything touches this
    // document between the initial findOne and the save (e.g. a
    // double-fired "unlock more" click). findOneAndUpdate applies the
    // change atomically and sidesteps that failure mode entirely.
    const updatedDoc = await ResumeUpload.findOneAndUpdate(
      { _id: doc._id, user: req.user._id },
      { $set: { recommendedJobs, matchesUnlocked: total } },
      { new: true }
    );

    if (!isPro && increment > 0) {
      req.user.addDailyMatches(increment);
      await req.user.save();
    }

    res.status(200).json({
      success: true,
      data: shapeForPlan(updatedDoc, isPro),
      progress: planSnapshot(isPro, total, isPro ? null : Math.max(0, BASIC_CAP - req.user.getDailyMatchesUsed())),
    });
  } catch (error) {
    console.error("Resume match expansion error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Lets the frontend show the plan's starting point / cap before any file
// is uploaded (e.g. "Basic plan — up to 20 matches").
const getResumeUsage = async (req, res) => {
  try {
    const isPro = req.user.isPro();
    const remainingToday = Math.max(0, BASIC_CAP - req.user.getDailyMatchesUsed());
    res.json({ success: true, data: planSnapshot(isPro, 0, isPro ? null : remainingToday) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { analyzeResume, requestMoreMatches, getResumeUsage, shapeForPlan };