import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import api from "../api/axios";
import JobCard from "../components/JobCard";
import FilterPanel from "../components/FilterPanel";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";

export default function AllJobs() {
  const [jobs, setJobs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({});
  const [sortBy, setSortBy] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [options, setOptions] = useState({});
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/jobs/filter-options").then((res) => setOptions(res.data.data));
  }, []);

  const fetchJobs = useCallback(
    (page = 1) => {
      setLoading(true);
      api
        .get("/jobs", { params: { ...filters, sortBy, page, limit: 9 } })
        .then((res) => {
          setJobs(res.data.data);
          setPagination(res.data.pagination);
        })
        .finally(() => setLoading(false));
    },
    [filters, sortBy]
  );

  useEffect(() => {
    const t = setTimeout(() => fetchJobs(1), 350);
    return () => clearTimeout(t);
  }, [fetchJobs]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="font-display text-3xl font-semibold mb-1">Data Explorer</h1>
        <p className="text-sm text-ink/50">{pagination.total} roles found across your dataset</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-fit">
          <FilterPanel filters={filters} setFilters={setFilters} options={options} />
        </aside>

        <div>
          <div className="flex items-center justify-end mb-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 rounded-xl2 bg-white/80 border border-black/10 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
            >
              <option value="newest">Newest</option>
              <option value="salaryHigh">Highest Salary</option>
              <option value="relevance">Most Relevant</option>
            </select>
          </div>

          {loading ? (
            <Loader label="Fetching jobs..." />
          ) : jobs.length === 0 ? (
            pagination.total === 0 && Object.keys(filters).length === 0 ? (
              <div className="text-center py-20">
                <p className="font-display text-lg font-semibold mb-2">No jobs yet</p>
                <p className="text-sm text-ink/50 mb-6">
                  {user
                    ? "Upload a job dataset first to browse listings here."
                    : "Sign in and upload a job dataset to browse listings here."}
                </p>
                {user && (
                  <button
                    onClick={() => navigate("/")}
                    className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-6 py-3 bg-ink text-white hover:opacity-90 transition-opacity"
                  >
                    <UploadCloud size={15} /> Upload Job Data
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-20 text-ink/50 text-sm">No jobs match your filters.</div>
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {jobs.map((job, i) => (
                <JobCard key={job._id} job={job} onView={setSelectedJob} delay={i} />
              ))}
            </div>
          )}

          <Pagination page={pagination.page} totalPages={pagination.totalPages} onChange={fetchJobs} />
        </div>
      </div>

      <Modal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
