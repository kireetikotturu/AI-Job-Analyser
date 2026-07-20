import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import anime from "animejs";

export default function StatCard({ icon: Icon, label, value, tint = "purple", delay = 0 }) {
  const tints = {
    purple: "from-accent-purple/15 to-accent-purple/5 text-accent-purple",
    pink: "from-accent-pink/15 to-accent-pink/5 text-accent-pink",
    orange: "from-accent-orange/15 to-accent-orange/5 text-accent-orange",
    sage: "from-sage to-sage/40 text-emerald-700",
  };

  const numberRef = useRef(null);
  // Only whole numbers get the count-up treatment — formatted strings like
  // "₹4.5L" (average salary) can't be interpolated, so those just render
  // as-is below.
  const isNumeric = typeof value === "number" && Number.isFinite(value);

  useEffect(() => {
    if (!isNumeric || !numberRef.current) return;
    const counter = { val: 0 };
    const animation = anime({
      targets: counter,
      val: value,
      round: 1,
      duration: 1100,
      delay: delay * 1000 + 150,
      easing: "easeOutExpo",
      update: () => {
        if (numberRef.current) numberRef.current.textContent = counter.val.toLocaleString("en-IN");
      },
    });
    return () => animation.pause();
  }, [value, isNumeric, delay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -4 }}
      className="glass-card rounded-xl3 p-5 shadow-card flex items-center gap-4"
    >
      <div className={`w-12 h-12 rounded-xl2 bg-gradient-to-br ${tints[tint]} flex items-center justify-center`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-2xl font-bold font-display leading-none">
          {isNumeric ? <span ref={numberRef}>0</span> : value}
        </p>
        <p className="text-xs text-ink/50 mt-1 font-medium">{label}</p>
      </div>
    </motion.div>
  );
}
