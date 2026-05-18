/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import { Customizer } from "./components/Customizer";
import { GameCanvas } from "./components/GameCanvas";
import { WeaponType } from "./types";

export default function App() {
  const [gameState, setGameState] = useState<"menu" | "playing">("menu");
  
  // Player state
  const [name, setName] = useState("");
  const [color, setColor] = useState("#ff0055");
  const [hat, setHat] = useState("none");
  const [skin, setSkin] = useState("plain");
  const [weapon, setWeapon] = useState<WeaponType>(WeaponType.PISTOL);

  if (gameState === "menu") {
    return (
      <Customizer 
        name={name}
        setName={setName}
        color={color}
        setColor={setColor}
        hat={hat}
        setHat={setHat}
        skin={skin}
        setSkin={setSkin}
        weapon={weapon}
        setWeapon={setWeapon}
        onJoin={() => setGameState("playing")}
      />
    );
  }

  return (
    <div className="w-screen h-screen overflow-hidden">
      <GameCanvas 
        localPlayer={{
          name,
          color,
          hat,
          skin,
          weaponType: weapon
        }}
      />
      
      {/* HUD: Back to menu button */}
      <button 
        onClick={() => setGameState("menu")}
        className="absolute top-4 left-4 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-xs uppercase backdrop-blur-md rounded-md cursor-pointer pointer-events-auto"
      >
        Abandoned Mission (Back to Menu)
      </button>
    </div>
  );
}
