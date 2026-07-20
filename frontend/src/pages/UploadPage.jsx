import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import anime from "animejs";
import UploadDropzone from "../components/UploadDropzone";
import FormatGuide from "../components/FormatGuide";
import { ArrowRight, LayoutDashboard, FileSearch, Search, Sparkles } from "lucide-react";

const FEATURES = [
  {
    image: "https://res.cloudinary.com/dlz2pxovx/image/upload/v1784450441/Screenshot_2026-07-19_140558_rjhnlx.png",
    icon: LayoutDashboard,
    title: "Market Dashboard",
    desc: "Live charts on top skills, hiring companies, salary bands, and posting trends — refreshed the moment you upload a new dataset.",
    path: "/dashboard",
    tint: "from-accent-purple to-accent-pink",
  },
  {
    image: "https://res.cloudinary.com/dlz2pxovx/image/upload/v1784450441/Screenshot_2026-07-19_135520_tkwdhx.png",
    icon: Search,
    title: "Browse & Apply to Jobs",
    desc: "Search and filter every stored listing by skill, location, salary, and job type, then apply straight from the card.",
    path: "/jobs",
    tint: "from-accent-orange to-accent-pink",
  },
  {
    image: "https://res.cloudinary.com/dlz2pxovx/image/upload/v1784450441/Screenshot_2026-07-19_140933_xxmthr.png",
    icon: FileSearch,
    title: "AI Resume Analyzer",
    desc: "Upload a resume to get an ATS score and instantly see which jobs in your dataset match it best.",
    path: "/resume-analyzer",
    tint: "from-accent-pink to-accent-purple",
  },
];

export default function UploadPage() {
  const navigate = useNavigate();

  // The format guide is a controlled accordion: collapsed by default so the
  // page stays clean, opened manually via the toggle button, or forced open
  // automatically the moment an upload comes back flagged (wrong file type,
  // failed request, row errors, or unmapped columns) so the person sees
  // exactly what went wrong without having to go hunting for it.
  const [guideOpen, setGuideOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const handleIssue = () => {
    setFlagged(true);
    setGuideOpen(true);
  };

  const handleToggle = () => {
    setFlagged(false);
    setGuideOpen((o) => !o);
  };

  // Two soft, blurred color blobs drifting slowly behind the hero — a small
  // anime.js touch that gives the page some ambient life without competing
  // with the (framer-motion-driven) content in front of it.
  const blobARef = useRef(null);
  const blobBRef = useRef(null);

  useEffect(() => {
    const animations = [];
    if (blobARef.current) {
      animations.push(
        anime({
          targets: blobARef.current,
          translateX: [0, 40, -20, 0],
          translateY: [0, -30, 20, 0],
          scale: [1, 1.08, 0.96, 1],
          duration: 14000,
          easing: "easeInOutSine",
          loop: true,
        })
      );
    }
    if (blobBRef.current) {
      animations.push(
        anime({
          targets: blobBRef.current,
          translateX: [0, -35, 25, 0],
          translateY: [0, 25, -25, 0],
          scale: [1, 0.94, 1.06, 1],
          duration: 17000,
          easing: "easeInOutSine",
          loop: true,
        })
      );
    }
    return () => animations.forEach((a) => a.pause());
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-73px)] bg-hero-gradient px-6 py-16 overflow-hidden">
      <div
        ref={blobARef}
        className="pointer-events-none absolute -top-20 -left-24 w-80 h-80 rounded-full blur-3xl"
      />
      <div
        ref={blobBRef}
        className="pointer-events-none absolute top-40 -right-24 w-96 h-96 rounded-full bg-accent-orange/20 blur-3xl"
      />

      <div className="relative max-w-5xl mx-auto text-center">
        <motion.p
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold tracking-widest uppercase text-accent-orange mb-3"
        >
          Dataset Upload
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
className='font-display text-4xl sm:text-5xl font-semibold leading-[1.1] mb-4'        >
          Turn Your Raw Data into
          <br />
          Market Intelligence
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-ink/55 max-w-xl mx-auto mb-8"
        >
          Upload your Excel or CSV job dataset — we'll validate, de-duplicate, categorize and store
          every record automatically.
        </motion.p>

        <UploadDropzone onIssue={handleIssue} />

        <FormatGuide open={guideOpen} onToggle={handleToggle} flagged={flagged} />

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-10 flex items-center justify-center gap-3"
        >
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 text-sm font-semibold rounded-full px-6 py-3 bg-ink text-white hover:opacity-90 transition-opacity"
          >
            Go to Dashboard <ArrowRight size={15} />
          </button>
        </motion.div>

        {/* What you can do next — a visual, screenshot-led tour of the
            app's three core pages instead of a plain text list, so the
            upload screen doubles as a product intro for first-time users. */}
        <div className="mt-16">
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-ink/40 mb-6"
          >
            <Sparkles size={12} className="text-accent-purple" /> What you can do with this data
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {FEATURES.map((f, i) => (
              <motion.button
                key={f.title}
                onClick={() => navigate(f.path)}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.08 }}
                whileHover={{ y: -6 }}
                className="group text-left rounded-xl3 bg-white border border-black/10 shadow-card hover:shadow-glow transition-shadow duration-300 overflow-hidden flex flex-col"
              >
                {/* Equal-size preview for every card: fixed aspect ratio +
                    object-cover, so a tall or wide screenshot never distorts
                    the grid. */}
                <div className="w-full aspect-video overflow-hidden bg-black/5 relative">
                  <img
                    src={f.image}
                    alt={`${f.title} preview`}
                    loading="lazy"
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div
                    className={`w-10 h-10 rounded-xl2 bg-gradient-to-br ${f.tint} flex items-center justify-center mb-3 text-white shadow-glow -mt-9 relative z-10 ring-4 ring-white`}
                  >
                    <f.icon size={17} />
                  </div>
                  <h3 className="font-display font-semibold text-sm mb-1.5">{f.title}</h3>
                  <p className="text-xs text-ink/50 leading-relaxed mb-4">{f.desc}</p>
                  <span className="mt-auto inline-flex items-center gap-1 text-xs font-semibold text-accent-purple opacity-70 group-hover:opacity-100 group-hover:gap-1.5 transition-all">
                    Explore <ArrowRight size={13} />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
