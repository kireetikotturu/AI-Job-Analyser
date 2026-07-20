import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  CartesianGrid,
} from "recharts";
import { Briefcase, Building2, MapPin, IndianRupee, Award, TrendingUp, UploadCloud } from "lucide-react";
import api from "../api/axios";
import StatCard from "../components/StatCard";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";

const COLORS = ["#6D5BF0", "#EE5FA0", "#F0703C", "#5BAE8C", "#4B9EF0", "#E0B84B"];

// Truncates a long skill/label so it doesn't overlap neighboring bars on
// the chart; the full name is still available via the tooltip.
function truncateLabel(label, max = 16) {
  const str = String(label || "");
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

// Salaries are stored as full annual rupee figures. Indian salaries are
// conventionally read in Lakhs (1L = ₹100,000), so anything at/above that
// is shown as "₹X.XL" (LPA) rather than a raw thousands figure.
function formatSalary(amount) {
  if (!amount) return "N/A";
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  return `₹${(amount / 1000).toFixed(0)}K`;
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/dashboard")
      .then((res) => setData(res.data.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load dashboard"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader label="Crunching job market data..." />;
  if (error)
    return (
      <div className="text-center py-20 text-red-500 text-sm font-medium">{error}</div>
    );
  if (!data || data.totalJobs === 0)
    return (
      <div className="text-center py-24">
        <p className="font-display text-xl font-semibold mb-2">No data yet</p>
        <p className="text-sm text-ink/50 mb-6">
          {user ? "Upload a job dataset first to see analytics here." : "Sign in and upload a job dataset to see analytics here."}
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
    );

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <motion.h1
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="font-display text-3xl font-semibold mb-1"
      >
        Market Dashboard
      </motion.h1>
      <p className="text-sm text-ink/50 mb-8">Live snapshot of your uploaded job dataset</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard icon={Briefcase} label="Total Jobs" value={data.totalJobs} tint="purple" delay={0} />
        <StatCard icon={Building2} label="Companies" value={data.totalCompanies} tint="pink" delay={0.05} />
        <StatCard icon={MapPin} label="Locations" value={data.totalLocations} tint="orange" delay={0.1} />
        <StatCard
          icon={IndianRupee}
          label="Average Salary"
          value={formatSalary(data.averageSalary)}
          tint="sage"
          delay={0.15}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-10">
        <ChartCard title="Jobs by Skill" icon={Award}>
          <ResponsiveContainer width="100%" height={Math.max(260, data.jobsBySkill.length * 38)}>
            <BarChart data={data.jobsBySkill} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis
                dataKey="skill"
                type="category"
                tick={{ fontSize: 11 }}
                width={110}
                tickFormatter={(v) => truncateLabel(v)}
              />
              <Tooltip formatter={(value, name, props) => [value, props.payload.skill]} />
              <Bar dataKey="count" fill="#EE5FA0" radius={[0, 6, 6, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs by Experience" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.jobsByExperience}
                dataKey="count"
                nameKey="experience"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.jobsByExperience.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs by Industry" icon={Building2}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.jobsByIndustry}
                dataKey="count"
                nameKey="industry"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.jobsByIndustry.map((_, i) => (
                  <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Jobs Posted Timeline (Weekly)" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.jobsTimeline}>
              <defs>
                <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6D5BF0" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#6D5BF0" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6D5BF0"
                strokeWidth={2.5}
                fill="url(#timelineFill)"
                dot={{ r: 2.5, fill: "#6D5BF0" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {data.topPayingCompanies?.length > 0 && (
          <ChartCard title="Top Paying Companies" icon={IndianRupee}>
            <ResponsiveContainer
              width="100%"
              height={Math.max(260, data.topPayingCompanies.length * 38)}
            >
              <BarChart data={data.topPayingCompanies} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatSalary(v)} />
                <YAxis
                  dataKey="company"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={110}
                  tickFormatter={(v) => truncateLabel(v)}
                />
                <Tooltip
                  formatter={(value, name, props) => [formatSalary(value), props.payload.company]}
                />
                <Bar dataKey="avgSalary" fill="#5BAE8C" radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <ListCard title="Top Skills" items={data.topSkills.map((s) => ({ label: s.skill, value: s.count }))} />
        <ListCard
          title="Most Hiring Companies"
          items={data.mostHiringCompanies.map((c) => ({ label: c.company, value: c.count }))}
        />
        <ListCard
          title="Top Locations"
          items={data.topLocations.map((l) => ({ label: l.location, value: l.count }))}
        />
      </div>
    </div>
  );
}

function ChartCard({ title, icon: Icon, children }) {
  return (
    <div className="glass-card rounded-xl3 p-5 shadow-card">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent-purple/10 text-accent-purple flex items-center justify-center">
          <Icon size={14} />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ListCard({ title, items }) {
  return (
    <div className="glass-card rounded-xl3 p-5 shadow-card">
      <h3 className="font-semibold text-sm mb-3">{title}</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center justify-between text-sm">
            <span className="text-ink/70 truncate">{i + 1}. {item.label}</span>
            <span className="font-semibold text-accent-purple text-xs bg-accent-purple/10 px-2 py-0.5 rounded-full">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}