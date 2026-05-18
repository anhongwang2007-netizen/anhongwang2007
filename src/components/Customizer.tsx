import React from "react";
import { WeaponType, WEAPONS } from "../types";
import { motion } from "motion/react";
import { Crosshair, Shield, Zap, Target, MousePointer2, Move, Info } from "lucide-react";

interface CustomizerProps {
  name: string;
  setName: (name: string) => void;
  color: string;
  setColor: (color: string) => void;
  hat: string;
  setHat: (hat: string) => void;
  skin: string;
  setSkin: (skin: string) => void;
  weapon: WeaponType;
  setWeapon: (weapon: WeaponType) => void;
  onJoin: () => void;
}

const COLORS = ["#ff0055", "#00ffaa", "#0088ff", "#ffff00", "#ff8800", "#aa00ff"];
const HATS = ["none", "crown", "tophat"];
const SKINS = ["plain", "striped", "dotted"];

export const Customizer: React.FC<CustomizerProps> = ({
  name, setName, color, setColor, hat, setHat, skin, setSkin, weapon, setWeapon, onJoin
}) => {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 md:p-8 font-sans overflow-x-hidden">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 bg-[#0c0c14]/50 p-6 md:p-12 border border-white/5 backdrop-blur-xl rounded-[2rem]"
      >
        {/* Left Side: Avatar Preview */}
        <div className="flex flex-col items-center justify-center space-y-8">
          <div className="text-center">
            <h1 className="text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-none mb-2">
              NEON<br />STRIKE
            </h1>
            <p className="text-white/30 font-mono text-[10px] uppercase tracking-[0.5em]">Tactical Multiplayer Protocol v2.4</p>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-4 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"></div>
            <div className="relative w-56 h-56 bg-[#05050a] border-2 border-white/10 rounded-full flex items-center justify-center overflow-hidden shadow-2xl shadow-indigo-500/10">
              <motion.div 
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="w-36 h-36 relative shadow-2xl"
                style={{ backgroundColor: color, boxShadow: `0 0 40px ${color}44` }}
              >
                {/* Skin Pattern */}
                {skin === "striped" && (
                  <div className="absolute inset-0 flex flex-col justify-around opacity-30 select-none">
                    <div className="h-4 bg-black"></div>
                    <div className="h-4 bg-black"></div>
                    <div className="h-4 bg-black"></div>
                  </div>
                )}
                {skin === "dotted" && (
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 place-items-center opacity-30 select-none">
                    {[...Array(9)].map((_, i) => <div key={i} className="w-3 h-3 bg-black rounded-full"></div>)}
                  </div>
                )}
                
                {/* Eye/Face indicator */}
                <div className="absolute top-1/2 right-2 w-5 h-5 bg-white shadow-lg"></div>
                
                {/* Hat */}
                {hat === "crown" && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-1 items-end pointer-events-none">
                     <div className="w-4 h-8 bg-yellow-400"></div>
                     <div className="w-5 h-16 bg-yellow-500 shadow-lg"></div>
                     <div className="w-4 h-8 bg-yellow-400"></div>
                  </div>
                )}
                {hat === "tophat" && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none">
                     <div className="w-20 h-14 bg-[#111] shadow-xl"></div>
                     <div className="w-32 h-3 bg-[#111]"></div>
                  </div>
                )}
              </motion.div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white text-black p-2 rounded-lg shadow-xl">
               <Shield size={16} />
            </div>
          </div>

          <div className="w-full max-w-sm">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-white/40 mb-3 font-mono">
              <Info size={12} />
              Protocol Identification Name
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ENTER CALLSIGN..."
              maxLength={15}
              className="w-full bg-white/5 border-2 border-white/10 p-5 font-mono text-2xl focus:border-white focus:bg-white/10 transition-all focus:outline-none uppercase text-center"
            />
          </div>
        </div>

        {/* Right Side: Options */}
        <div className="space-y-8">
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-mono flex items-center gap-2">
                <Target size={14} /> Weaponry Selection
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(WEAPONS).map(([type, stats]) => (
                <button
                  key={type}
                  onClick={() => setWeapon(type as WeaponType)}
                  className={`group relative p-4 border-2 transition-all flex flex-col items-start overflow-hidden ${
                    weapon === type ? 'border-white bg-white text-black shadow-lg' : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30'
                  }`}
                >
                  <span className="text-xl font-black italic uppercase tracking-tighter relative z-10">{stats.name}</span>
                  <span className="text-[10px] opacity-60 font-mono relative z-10">Power: {stats.damage} | Rate: {stats.fireRate}ms</span>
                  {weapon === type && (
                    <motion.div layoutId="activeWeapon" className="absolute top-2 right-2 text-black">
                      <Crosshair size={14} />
                    </motion.div>
                  )}
                </button>
              ))}
            </div>
          </section>

          <section>
             <h3 className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 font-mono flex items-center gap-2">
               <Zap size={14} /> Digital Signature
             </h3>
             <div className="flex flex-wrap gap-4">
               {COLORS.map(c => (
                 <button
                   key={c}
                   onClick={() => setColor(c)}
                   style={{ backgroundColor: c }}
                   className={`w-12 h-12 rounded-2xl border-4 transition-all duration-300 ${color === c ? 'border-white scale-110 shadow-2xl' : 'border-transparent opacity-40 hover:opacity-100'}`}
                 />
               ))}
             </div>
          </section>

          <div className="grid grid-cols-2 gap-8">
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 font-mono">Headgear</h3>
              <div className="flex flex-wrap gap-2">
                {HATS.map(h => (
                  <button
                    key={h}
                    onClick={() => setHat(h)}
                    className={`px-5 py-2.5 border-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${hat === h ? 'bg-white text-black border-white' : 'border-white/10 text-white/50 hover:border-white/40'}`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3 className="text-[10px] uppercase tracking-[0.4em] text-white/40 mb-4 font-mono">Chassis</h3>
              <div className="flex flex-wrap gap-2">
                {SKINS.map(s => (
                  <button
                    key={s}
                    onClick={() => setSkin(s)}
                    className={`px-5 py-2.5 border-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${skin === s ? 'bg-white text-black border-white' : 'border-white/10 text-white/50 hover:border-white/40'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="pt-4 space-y-4">
            <div className="flex gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
               <div className="flex flex-col items-center gap-1 text-white/40">
                  <Move size={16} />
                  <span className="text-[8px] font-mono">WASD</span>
               </div>
               <div className="w-[1px] bg-white/10"></div>
               <div className="flex flex-col items-center gap-1 text-white/40">
                  <MousePointer2 size={16} />
                  <span className="text-[8px] font-mono">FIRE</span>
               </div>
               <div className="ml-auto text-[10px] text-white/30 font-mono self-center">MULTIPLE UNITS DETECTED ONLINE</div>
            </div>
            
            <button 
              onClick={onJoin}
              disabled={!name.trim()}
              className="w-full py-7 bg-white text-black text-2xl font-black italic uppercase tracking-tighter hover:bg-[#00ffaa] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed group relative"
            >
              DEPLOY TO ARENA
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
