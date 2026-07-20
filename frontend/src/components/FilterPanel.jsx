import { Search, SlidersHorizontal } from "lucide-react";

export default function FilterPanel({ filters, setFilters, options, showRemote = true }) {
  const update = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="glass-card rounded-xl3 p-5 shadow-soft space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink/70">
        <SlidersHorizontal size={15} /> Filters
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" />
        <input
          value={filters.search || ""}
          onChange={(e) => update("search", e.target.value)}
          placeholder="Search jobs, skills, company..."
          className="w-full pl-9 pr-3 py-2.5 rounded-full bg-white/80 border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
        />
      </div>

      <Select label="Location" value={filters.location} onChange={(v) => update("location", v)} items={options.locations} />
      <Select label="Company" value={filters.company} onChange={(v) => update("company", v)} items={options.companies} />
      <Select label="Industry" value={filters.industry} onChange={(v) => update("industry", v)} items={options.industries} />
      <Select
        label="Employment Type"
        value={filters.employmentType}
        onChange={(v) => update("employmentType", v)}
        items={options.employmentTypes}
      />
      <Select label="Job Category" value={filters.jobType} onChange={(v) => update("jobType", v)} items={options.jobTypes} />
      <Select label="Education" value={filters.education} onChange={(v) => update("education", v)} items={options.educations} />

      <div>
        <label className="text-xs font-semibold text-ink/50 mb-1 block">Experience</label>
        <input
          value={filters.experience || ""}
          onChange={(e) => update("experience", e.target.value)}
          placeholder="e.g. 2-4 years"
          className="w-full px-3 py-2 rounded-xl2 bg-white/80 border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-semibold text-ink/50 mb-1 block">Min Salary (₹/yr)</label>
          <input
            type="number"
            placeholder="e.g. 500000"
            value={filters.minSalary || ""}
            onChange={(e) => update("minSalary", e.target.value)}
            className="w-full px-3 py-2 rounded-xl2 bg-white/80 border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-ink/50 mb-1 block">Max Salary (₹/yr)</label>
          <input
            type="number"
            placeholder="e.g. 1200000"
            value={filters.maxSalary || ""}
            onChange={(e) => update("maxSalary", e.target.value)}
            className="w-full px-3 py-2 rounded-xl2 bg-white/80 border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
          />
        </div>
      </div>

      {showRemote && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={filters.remote === "true"}
            onChange={(e) => update("remote", e.target.checked ? "true" : "")}
            className="accent-accent-purple w-4 h-4"
          />
          Remote only
        </label>
      )}

      <button
        onClick={() => setFilters({})}
        className="w-full text-xs font-semibold rounded-full py-2.5 bg-black/5 hover:bg-black/10 transition-colors"
      >
        Clear Filters
      </button>
    </div>
  );
}

function Select({ label, value, onChange, items = [] }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink/50 mb-1 block">{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl2 bg-white/80 border border-black/10 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40"
      >
        <option value="">All</option>
        {items?.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </div>
  );
}
