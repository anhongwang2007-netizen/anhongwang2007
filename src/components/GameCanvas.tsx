import React, { useEffect, useRef } from "react";
import { getSocket } from "../socket";
import { PlayerData, Projectile, WeaponType, WEAPONS } from "../types";

interface GameCanvasProps {
  localPlayer: Partial<PlayerData>;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ localPlayer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socket = getSocket();
  
  // Game state refs
  const playersRef = useRef<Map<string, PlayerData>>(new Map());
  const enemiesRef = useRef<any[]>([]);
  const bossRef = useRef<any>(null);
  const explosionsRef = useRef<any[]>([]);
  const powerupsRef = useRef<any[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const enemyProjectilesRef = useRef<any[]>([]);
  const worldXRef = useRef<number>(0);
  const lastShotTimeRef = useRef<number>(0);
  const keysRef = useRef<Set<string>>(new Set());
  
  // React state for UI updates
  const [hudData, setHudData] = React.useState({
    weaponType: localPlayer.weaponType || WeaponType.PISTOL,
    upgradeLevel: 0,
    ammoLevel: 0,
    shield: 0,
    message: "",
    currentWave: 0,
    boss: null as { hp: number; maxHp: number; name: string } | null,
    lastWeaponSwitch: 0
  });

  // Local power levels
  const upgradeLevelRef = useRef(0);
  const ammoLevelRef = useRef(0);
  
  // Local dimensions
  const dimsRef = useRef({ width: 800, height: 600 });

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        dimsRef.current = {
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        };
        if (canvasRef.current) {
          canvasRef.current.width = dimsRef.current.width;
          canvasRef.current.height = dimsRef.current.height;
        }
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // Socket listeners
    socket.emit("join", localPlayer);

    socket.on("waveStarted", ({ wave }: any) => {
        setHudData(h => ({ ...h, currentWave: wave, message: `WAVE ${wave} COMMENCING` }));
        setTimeout(() => setHudData(h => ({ ...h, message: "" })), 3000);
    });

    socket.on("waveCleared", ({ wave }: any) => {
        setHudData(h => ({ ...h, message: `WAVE ${wave} CLEARED` }));
        setTimeout(() => setHudData(h => ({ ...h, message: "" })), 3000);
    });

    socket.on("init", (data: any) => {
      const newPlayers = new Map();
      data.players.forEach((p: PlayerData) => newPlayers.set(p.id, p));
      playersRef.current = newPlayers;
      enemiesRef.current = data.enemies || [];
      powerupsRef.current = data.powerups || [];
      bossRef.current = data.boss || null;
      worldXRef.current = data.worldX || 0;
      setHudData(h => ({ 
        ...h, 
        currentWave: data.currentWave || 0,
        boss: data.boss ? { hp: data.boss.hp, maxHp: data.boss.maxHp || data.boss.hp, name: "MEGA SENTINEL PROTOCOL" } : null
      }));
    });

    socket.on("bossSpawned", (bossData: any) => {
      bossRef.current = bossData;
      setHudData(h => ({ ...h, boss: { hp: bossData.hp, maxHp: bossData.maxHp || bossData.hp, name: "MEGA SENTINEL PROTOCOL" } }));
    });

    socket.on("bossUpdate", (data: any) => {
      if (bossRef.current) {
          bossRef.current.hp = data.hp;
          if (data.x !== undefined) bossRef.current.x = data.x;
          if (data.y !== undefined) bossRef.current.y = data.y;
          if (data.phase !== undefined) bossRef.current.phase = data.phase;
          
          setHudData(h => ({
              ...h,
              boss: h.boss 
                ? { ...h.boss, hp: data.hp } 
                : { hp: data.hp, maxHp: bossRef.current.maxHp || 3000, name: "MEGA SENTINEL PROTOCOL" }
          }));
      }
    });

    socket.on("bossDefeated", ({ shooterId, score }: any) => {
      bossRef.current = null;
      setHudData(h => ({ ...h, boss: null }));
      const shooter = playersRef.current.get(shooterId);
      if (shooter) shooter.score = score;
    });

    socket.on("playerJoined", (player: PlayerData) => {
      playersRef.current.set(player.id, player);
    });

    socket.on("playerMoved", (player: PlayerData) => {
      const p = playersRef.current.get(player.id);
      if (p) {
        p.x = player.x;
        p.y = player.y;
      }
    });

    socket.on("spawnEnemy", (enemy: any) => {
        enemiesRef.current.push(enemy);
    });

    socket.on("enemyDestroyed", ({ enemyId, shooterId, score }: any) => {
        enemiesRef.current = enemiesRef.current.filter(e => e.id !== enemyId);
        const shooter = playersRef.current.get(shooterId);
        if (shooter) shooter.score = score;
    });

    socket.on("enemyHealthUpdate", ({ enemyId, hp }: any) => {
        const enemy = enemiesRef.current.find(e => e.id === enemyId);
        if (enemy) {
            enemy.hp = hp;
            enemy.lastHit = Date.now(); // 用於閃爍效果
        }
    });

    socket.on("playerLeft", (id: string) => {
      playersRef.current.delete(id);
    });

    socket.on("projectileFired", (projectile: Projectile) => {
      projectilesRef.current.push(projectile);
    });

    socket.on("playerHit", ({ id, hp }: { id: string, hp: number }) => {
      const p = playersRef.current.get(id);
      if (p) p.hp = hp;
    });

    socket.on("enemyExploded", (data: any) => {
        explosionsRef.current.push({
            ...data,
            startTime: Date.now(),
            duration: 500
        });
    });

    socket.on("playerRespawn", (player: PlayerData) => {
      const p = { ...player, lastRespawn: Date.now() };
      playersRef.current.set(player.id, p);
    });

    socket.on("removePowerup", ({ id }: any) => {
        powerupsRef.current = powerupsRef.current.filter(p => p.id !== id);
    });

    socket.on("spawnPowerup", (powerup: any) => {
        powerupsRef.current.push(powerup);
    });

    socket.on("playerPoweredUp", ({ id, upgradeLevel, ammoLevel, weaponType, shield, message }: any) => {
        const p = playersRef.current.get(id);
        if (p) {
            const oldWeapon = p.weaponType;
            (p as any).upgradeLevel = upgradeLevel;
            (p as any).ammoLevel = ammoLevel;
            if (weaponType) p.weaponType = weaponType;
            if (shield !== undefined) (p as any).shield = shield;

            if (id === socket.id) {
                const isSwitch = weaponType && weaponType !== oldWeapon;
                upgradeLevelRef.current = upgradeLevel || 0;
                ammoLevelRef.current = ammoLevel || 0;
                setHudData(h => ({
                    ...h,
                    weaponType: weaponType || (p.weaponType as WeaponType),
                    upgradeLevel: upgradeLevel || 0,
                    ammoLevel: ammoLevel || 0,
                    shield: shield !== undefined ? shield : (p as any).shield,
                    message: message || (isSwitch ? "" : h.message),
                    lastWeaponSwitch: isSwitch ? Date.now() : h.lastWeaponSwitch
                }));
                
                // Clear message after 2s
                if (message) setTimeout(() => setHudData(h => ({ ...h, message: "" })), 2000);
            }
        }
    });

    socket.on("playerShieldUpdate", ({ id, shield }: any) => {
        const p = playersRef.current.get(id);
        if (p) (p as any).shield = shield;
    });

    socket.on("scoreUpdate", ({ shooterId, targetId, shooterScore }: any) => {
      const shooter = playersRef.current.get(shooterId);
      if (shooter) shooter.score = shooterScore;
    });

    socket.on("enemyProjectileFired", (data: any) => {
        enemyProjectilesRef.current.push({
            ...data,
            vx: data.vx || -5,
            vy: data.vy || 0,
            createdAt: Date.now()
        });
    });

    // Input listeners
    const handleKeyDown = (e: KeyboardEvent) => {
        const key = e.key.toLowerCase();
        keysRef.current.add(key);
        
        if (key === 'q' || key === 'e') {
            const weaponTypes = Object.values(WeaponType);
            const me = playersRef.current.get(socket.id!);
            if (me) {
                const currentIndex = weaponTypes.indexOf(me.weaponType);
                let nextIndex = (currentIndex + (key === 'e' ? 1 : -1)) % weaponTypes.length;
                if (nextIndex < 0) nextIndex = weaponTypes.length - 1;
                socket.emit("changeWeapon", { weaponType: weaponTypes[nextIndex] });
            }
        }
    };
    const handleKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const handleMouseDown = (e: MouseEvent) => {
        if (e.button === 0) keysRef.current.add("mouse0");
    }
    const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 0) keysRef.current.delete("mouse0");
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);

    // Initial Join
    socket.emit("join", localPlayer);

    // Game loop
    let animationFrameId: number;
    const render = () => {
      update();
      draw();
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mouseup", handleMouseUp);
      socket.off("init");
      socket.off("playerJoined");
      socket.off("playerMoved");
      socket.off("spawnEnemy");
      socket.off("enemyDestroyed");
      socket.off("playerLeft");
      socket.off("projectileFired");
      socket.off("playerHit");
      socket.off("playerRespawn");
      socket.off("scoreUpdate");
      socket.off("enemyProjectileFired");
      socket.off("spawnPowerup");
      socket.off("removePowerup");
      socket.off("waveStarted");
      socket.off("waveCleared");
      socket.off("playerPoweredUp");
      socket.off("playerShieldUpdate");
      cancelAnimationFrame(animationFrameId);
    };
  }, [localPlayer.weaponType, localPlayer.color, localPlayer.hat, localPlayer.skin]);

  const update = () => {
    if (!bossRef.current) {
        worldXRef.current += 2; // Sync with server speed
    }
    const me = playersRef.current.get(socket.id!);
    if (!me) return;

    // Side scrolling forced movement
    if (!bossRef.current) {
        me.x += 2;
    }

    // Movement relative to screen
    const speed = 5;
    if (keysRef.current.has("w") || keysRef.current.has("arrowup")) me.y = Math.max(20, me.y - speed);
    if (keysRef.current.has("s") || keysRef.current.has("arrowdown")) me.y = Math.min(dimsRef.current.height - 20, me.y + speed);
    if (keysRef.current.has("a") || keysRef.current.has("arrowleft")) me.x = Math.max(worldXRef.current + 20, me.x - speed);
    if (keysRef.current.has("d") || keysRef.current.has("arrowright")) me.x = Math.min(worldXRef.current + dimsRef.current.width - 20, me.x + speed);

    // Side-scroller (always facing right)
    me.angle = 0;

    socket.emit("move", { x: me.x, y: me.y });

    // Shooting (straight right)
    const baseWeapon = WEAPONS[me.weaponType];
    const weapon = {
        ...baseWeapon,
        damage: baseWeapon.damage + (upgradeLevelRef.current * 8),
        fireRate: Math.max(40, baseWeapon.fireRate - (upgradeLevelRef.current * 15)),
        bulletCount: baseWeapon.bulletCount + ammoLevelRef.current
    };

    const now = Date.now();
    if (keysRef.current.has("mouse0") && now - lastShotTimeRef.current > weapon.fireRate) {
      lastShotTimeRef.current = now;
      
      // Main Weapon Firing
      for (let i = 0; i < weapon.bulletCount; i++) {
        const spreadFactor = (weapon.bulletCount > 1) ? (i / (weapon.bulletCount - 1)) - 0.5 : 0;
        const spreadAngle = spreadFactor * weapon.spread * 1.5;
        
        const projectile: Projectile = {
          id: Math.random().toString(36).substr(2, 9),
          ownerId: socket.id!,
          x: me.x + 30,
          y: me.y,
          vx: Math.cos(spreadAngle) * weapon.bulletSpeed + 2,
          vy: Math.sin(spreadAngle) * weapon.bulletSpeed,
          damage: weapon.damage,
          color: weapon.color
        };
        projectilesRef.current.push(projectile);
        socket.emit("shoot", projectile);
      }

      // Secondary Missiles (Equipment style)
      if (ammoLevelRef.current > 0) {
          const missile: Projectile = {
              id: "M_" + Math.random(),
              ownerId: socket.id!,
              x: me.x,
              y: me.y + (Math.random() > 0.5 ? 20 : -20),
              vx: 5,
              vy: (Math.random() - 0.5) * 4,
              damage: 15,
              color: "#ffcc00",
              isMissile: true
          } as any;
          projectilesRef.current.push(missile);
          socket.emit("shoot", missile);
      }
    }

    // Update projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
      const p = projectilesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;

      // Missile homing logic
      if ((p as any).isMissile) {
          let nearestEnemy = null;
          let minDist = 400;
          enemiesRef.current.forEach(e => {
              const d = Math.hypot(e.x - p.x, e.y - p.y);
              if (d < minDist) {
                  minDist = d;
                  nearestEnemy = e;
              }
          });
          if (nearestEnemy) {
              const angle = Math.atan2((nearestEnemy as any).y - p.y, (nearestEnemy as any).x - p.x);
              p.vx += Math.cos(angle) * 0.5;
              p.vy += Math.sin(angle) * 0.5;
              const spd = Math.hypot(p.vx, p.vy);
              if (spd > 10) { p.vx *= 10/spd; p.vy *= 10/spd; }
          }
      }

      if (p.x > worldXRef.current + dimsRef.current.width + 100) {
        projectilesRef.current.splice(i, 1);
        continue;
      }

      if (p.ownerId === socket.id) {
        let hitSomething = false;

        // Check boss
        if (bossRef.current) {
            const b = bossRef.current;
            const dist = Math.hypot(p.x - b.x, p.y - b.y);
            if (dist < 80) { // Large hitbox for boss
                socket.emit("enemyHit", { enemyId: b.id, damage: p.damage });
                hitSomething = true;
            }
        }

        // Check enemies
        if (!hitSomething) {
            for (const enemy of enemiesRef.current) {
                const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
                if (dist < 30) {
                    socket.emit("enemyHit", { enemyId: enemy.id, damage: p.damage });
                    hitSomething = true;
                    break;
                }
            }
        }

        if (hitSomething) {
            projectilesRef.current.splice(i, 1);
            continue;
        }

        // Check other players
        playersRef.current.forEach((other, id) => {
          if (id === socket.id) return;
          const dist = Math.hypot(p.x - other.x, p.y - other.y);
          if (dist < 20) {
            socket.emit("hit", { targetId: id, damage: p.damage });
            projectilesRef.current.splice(i, 1);
          }
        });
      }
    }

    // Move enemies
    enemiesRef.current.forEach(e => {
        if (e.type === "scout") {
            e.y += Math.sin(worldXRef.current / 50) * 2;
            e.x -= 1; // Move left relative to world
        } else if (e.type === "seeker") {
            e.x -= 1.5;
            e.y += Math.cos(worldXRef.current / 30) * 3;
        } else if (e.type === "shielded") {
            e.x -= 0.3;
        } else {
            e.x -= 0.5;
        }
    });

    // Update enemy projectiles
    for (let i = enemyProjectilesRef.current.length - 1; i >= 0; i--) {
        const ep = enemyProjectilesRef.current[i];
        
        if (ep.type === "homing") {
            const target = playersRef.current.get(ep.targetId);
            if (target) {
                const angle = Math.atan2(target.y - ep.y, target.x - ep.x);
                ep.vx += Math.cos(angle) * 0.2;
                ep.vy += Math.sin(angle) * 0.2;
                // Limit speed
                const speed = Math.hypot(ep.vx, ep.vy);
                if (speed > 6) {
                    ep.vx *= 6 / speed;
                    ep.vy *= 6 / speed;
                }
            }
        }

        ep.x += ep.vx;
        ep.y += ep.vy;

        // Cleanup
        if (ep.x < worldXRef.current - 100 || ep.x > worldXRef.current + dimsRef.current.width + 100) {
            enemyProjectilesRef.current.splice(i, 1);
            continue;
        }

        // Collision with player
        const me_obj = playersRef.current.get(socket.id!);
        if (me_obj) {
            const d = Math.hypot(ep.x - me_obj.x, ep.y - me_obj.y);
            if (d < 25) {
                socket.emit("hit", { targetId: socket.id, damage: ep.damage || 10 });
                enemyProjectilesRef.current.splice(i, 1);
                continue;
            }
        }
    }

    // Drone Satellites Collision (Local player only)
    const droneCount = upgradeLevelRef.current;
    if (droneCount > 0 && me) {
        const now = Date.now();
        for (let i = 0; i < Math.min(droneCount, 4); i++) {
            const angle = (now / 1000) + (i * Math.PI * 2 / Math.min(droneCount, 4));
            const dx = Math.cos(angle) * 55;
            const dy = Math.sin(angle) * 55;
            const droneX = me.x + dx;
            const droneY = me.y + dy;

            // Check boss
            if (bossRef.current) {
                const b = bossRef.current;
                const d = Math.hypot(droneX - b.x, droneY - b.y);
                if (d < 50) {
                    const lastHit = b.lastDroneTick || 0;
                    if (now - lastHit > 150) {
                        b.lastDroneTick = now;
                        socket.emit("enemyHit", { enemyId: b.id, damage: 8 + (upgradeLevelRef.current * 1.5) });
                    }
                }
            }

            // Check enemies
            enemiesRef.current.forEach(enemy => {
                const d = Math.hypot(droneX - enemy.x, enemy.y - droneY);
                if (d < 40) {
                    const lastHit = enemy.lastDroneTick || 0;
                    if (now - lastHit > 150) {
                        enemy.lastDroneTick = now;
                        socket.emit("enemyHit", { enemyId: enemy.id, damage: 8 + (upgradeLevelRef.current * 1.5) });
                    }
                }
            });
        }
    }

    // Update powerups (collision)
    for (let i = powerupsRef.current.length - 1; i >= 0; i--) {
        const pw = powerupsRef.current[i];
        const me = playersRef.current.get(socket.id!);
        if (me) {
            const d = Math.hypot(me.x - pw.x, me.y - pw.y);
            if (d < 40) {
                socket.emit("collectPowerup", pw);
                powerupsRef.current.splice(i, 1);
            }
        }
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const camX = worldXRef.current;

    // Clear
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax Stars
    ctx.fillStyle = "#fff";
    for(let i=0; i<50; i++) {
        const x = (i * 137.5 - camX * 0.2) % canvas.width;
        const y = (i * 921.7) % canvas.height;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x < 0 ? x + canvas.width : x, y, 1, 1);
    }
    ctx.globalAlpha = 1.0;

    // Draw everything relative to camera
    ctx.save();
    ctx.translate(-camX, 0);

    // Powerups
    powerupsRef.current.forEach((pw, idx) => {
        const bounce = Math.sin(Date.now() / 200) * 5;
        let color = "#00ff33";
        let label = "U";
        
        if (pw.type === "WEAPON") { color = "#ff00ff"; label = pw.subType[0]; }
        else if (pw.type === "SHIELD") { color = "#00aaff"; label = "🛡️"; }
        else if (pw.type === "AMMO") { color = "#ffaa00"; label = "A"; }
        else if (pw.type === "HEALTH") { color = "#ff4444"; label = "✚"; }

        ctx.fillStyle = color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(pw.x - 12, pw.y - 12 + bounce, 24, 24);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.strokeRect(pw.x - 14, pw.y - 14 + bounce, 28, 28);
        
        ctx.fillStyle = "white";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(label, pw.x, pw.y + 5 + bounce);
        
        ctx.shadowBlur = 0;
    });

    // Boss
    if (bossRef.current) {
        const b = bossRef.current;
        const color = b.type === "sentinel" ? "#00ffcc" : (b.type === "overlord" ? "#ff8800" : "#ff00aa");
        ctx.fillStyle = b.phase === 1 ? "#333" : "#500";
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.shadowBlur = 30;
        ctx.shadowColor = color;
        
        if (b.type === "sentinel") {
            // SENTINEL: Sleek sniper ship
            ctx.beginPath();
            ctx.moveTo(b.x - 80, b.y - 30);
            ctx.lineTo(b.x + 80, b.y - 10);
            ctx.lineTo(b.x + 80, b.y + 10);
            ctx.lineTo(b.x - 80, b.y + 30);
            ctx.lineTo(b.x - 40, b.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Sniper Barrel
            ctx.fillStyle = color;
            ctx.fillRect(b.x - 120, b.y - 5, 80, 10);
        } else if (b.type === "overlord") {
            // OVERLORD: Heavy hazard station
            const sides = 8;
            ctx.beginPath();
            for(let i=0; i<sides; i++) {
                const angle = (i / sides) * Math.PI * 2;
                const r = 80;
                ctx.lineTo(b.x + Math.cos(angle) * r, b.y + Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            
            // Emitters
            for(let i=0; i<4; i++) {
                const angle = (i / 4) * Math.PI * 2 + (Date.now() / 1000);
                const ex = b.x + Math.cos(angle) * 60;
                const ey = b.y + Math.sin(angle) * 60;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(ex, ey, 15, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // PRIME: Original design
            ctx.beginPath();
            ctx.moveTo(b.x - 60, b.y - 80);
            ctx.lineTo(b.x + 80, b.y);
            ctx.lineTo(b.x - 60, b.y + 80);
            ctx.lineTo(b.x - 30, b.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        // Core
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 20 + Math.sin(Date.now() / 100) * 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Enemies
    enemiesRef.current.forEach(e => {
        const isHit = e.lastHit && (Date.now() - e.lastHit < 100);
        
        if (e.type === "shielded") {
            ctx.strokeStyle = isHit ? "#fff" : "#00ffff";
            ctx.fillStyle = isHit ? "rgba(255,255,255,0.5)" : "#222266";
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#00ffff";
            ctx.beginPath();
            ctx.arc(e.x, e.y, 35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.fillRect(e.x - 20, e.y - 20, 40, 40);
        } else if (e.type === "seeker") {
            ctx.fillStyle = isHit ? "#fff" : "#ff00ff";
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ff00ff";
            ctx.beginPath();
            ctx.moveTo(e.x - 15, e.y - 15);
            ctx.lineTo(e.x + 15, e.y);
            ctx.lineTo(e.x - 15, e.y + 15);
            ctx.closePath();
            ctx.fill();
        } else if (e.type === "mine") {
            ctx.fillStyle = isHit ? "#fff" : (Math.sin(Date.now() / 100) > 0 ? "#ff5500" : "#aa0000");
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ff0000";
            const spikes = 8;
            ctx.beginPath();
            for(let i=0; i<spikes*2; i++) {
                const r = i % 2 === 0 ? 25 : 10;
                const angle = (i / (spikes*2)) * Math.PI * 2;
                ctx.lineTo(e.x + Math.cos(angle) * r, e.y + Math.sin(angle) * r);
            }
            ctx.closePath();
            ctx.fill();
            ctx.shadowBlur = 0;
        } else if (e.type === "turret") {
            ctx.fillStyle = isHit ? "#fff" : "#555";
            ctx.strokeStyle = "#ff0000";
            ctx.lineWidth = 2;
            ctx.shadowBlur = 10;
            ctx.shadowColor = "#ff0000";
            
            // Base
            ctx.fillRect(e.x - 25, e.y - 25, 50, 50);
            ctx.strokeRect(e.x - 25, e.y - 25, 50, 50);
            
            // Barrel
            ctx.fillStyle = "#333";
            ctx.fillRect(e.x - 45, e.y - 8, 20, 16);
            
            // Scanning LED
            ctx.fillStyle = (Math.sin(Date.now() / 200) > 0) ? "#f00" : "#300";
            ctx.beginPath();
            ctx.arc(e.x - 15, e.y, 4, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = isHit ? "#fff" : (e.type === "heavy" ? "#ff4400" : "#ffaa00");
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.fillStyle;
            
            ctx.beginPath();
            ctx.moveTo(e.x - 20, e.y);
            ctx.lineTo(e.x + 20, e.y - 15);
            ctx.lineTo(e.x + 10, e.y);
            ctx.lineTo(e.x + 20, e.y + 15);
            ctx.closePath();
            ctx.fill();
        }
        
        ctx.shadowBlur = 0;
        
        // Improved Health Bar Overlay
        const hpBarWidth = e.type === "shielded" ? 60 : 34;
        const hpPercent = e.hp / (e.maxHp || 30);
        
        // Background
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(e.x - hpBarWidth/2 - 1, e.y - 41, hpBarWidth + 2, 6);
        
        // Progress
        const barColor = e.type === "shielded" ? "#00d4ff" : (hpPercent > 0.5 ? "#00ff88" : (hpPercent > 0.25 ? "#ffaa00" : "#ff4444"));
        ctx.fillStyle = barColor;
        ctx.fillRect(e.x - hpBarWidth/2, e.y - 40, hpBarWidth * hpPercent, 4);

        // Border
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.strokeRect(e.x - hpBarWidth/2 - 1, e.y - 41, hpBarWidth + 2, 6);
    });

    // Projectiles
    projectilesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      
      if ((p as any).isMissile) {
          ctx.fillRect(p.x - 6, p.y - 3, 12, 6);
          ctx.fillStyle = "#fff";
          ctx.fillRect(p.x - 2, p.y - 1, 4, 2);
      } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.shadowBlur = 0;
    });

    // Enemy Projectiles
    enemyProjectilesRef.current.forEach(p => {
        ctx.fillStyle = p.type === "homing" ? "#ff00ff" : (p.type === "heavy" ? "#ffcc00" : (p.type === "fast" ? "#00ffff" : "#ff0000"));
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        if (p.type === "homing") {
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
            // Trail
            ctx.strokeStyle = ctx.fillStyle;
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        } else if (p.type === "heavy") {
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.stroke();
        } else if (p.type === "fast") {
            ctx.fillRect(p.x - 10, p.y - 1, 20, 2);
        } else {
            ctx.fillRect(p.x - 4, p.y - 2, 8, 4);
        }
        ctx.shadowBlur = 0;
    });

    // Players
    playersRef.current.forEach((p, id) => {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Shield Visual
      if ((p as any).shield > 0) {
          ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 32 + Math.sin(Date.now() / 100) * 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
          ctx.fill();
      }

      // Respawn Warp-In Effect
      const respawnDuration = 1200;
      const respawnElapsed = p.lastRespawn ? Date.now() - p.lastRespawn : 2000;
      const isRespawning = respawnElapsed < respawnDuration;
      const ratio = Math.min(1, respawnElapsed / respawnDuration);

      if (isRespawning) {
          // Digital scanlines and distortion field
          ctx.save();
          const glitchTime = Date.now() / 50;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1;
          
          // Outer digital rings
          for(let i=0; i<3; i++) {
              const ringRatio = (ratio + i/3) % 1;
              ctx.globalAlpha = (1 - ringRatio) * 0.5;
              ctx.beginPath();
              ctx.arc(0, 0, ringRatio * 100, 0, Math.PI * 2);
              ctx.stroke();
          }

          // Horizontal glitch lines
          ctx.globalAlpha = (1 - ratio) * 0.8;
          for(let i=0; i<8; i++) {
              const y = (Math.random() - 0.5) * 80;
              const xLen = 60 + Math.random() * 80;
              ctx.fillStyle = Math.random() > 0.5 ? p.color : "#fff";
              ctx.fillRect(-xLen / 2, y, xLen, 1);
          }

          // Vertical "digital rain" particles
          for(let i=0; i<12; i++) {
              const x = (Math.sin(i * 10 + Date.now()/100) * 40);
              const y = ((Date.now() / (2+i%3)) % 120) - 60;
              ctx.fillStyle = p.color;
              ctx.globalAlpha = (1 - ratio) * 0.6;
              ctx.fillRect(x, y, 2, 10);
          }
          ctx.restore();

          // Shield Shimmer Burst
          if (ratio > 0.5) {
              const shimmerRatio = (ratio - 0.5) / 0.5;
              ctx.save();
              ctx.strokeStyle = "#fff";
              ctx.lineWidth = 4 * (1 - shimmerRatio);
              ctx.shadowBlur = 15;
              ctx.shadowColor = "#fff";
              ctx.globalAlpha = (1 - shimmerRatio) * 0.9;
              ctx.beginPath();
              ctx.arc(0, 0, 30 + shimmerRatio * 50, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
          }

          // Apply transformation to the player body
          const glitchX = (Math.random() - 0.5) * 15 * (1 - ratio);
          const scaleX = Math.pow(ratio, 0.4); 
          const stretchY = 1 + (Math.sin(respawnElapsed / 10) * 0.8 * (1 - ratio));
          
          ctx.translate(glitchX, 0);
          ctx.scale(scaleX, stretchY);
          
          // Chromatic aberration flicker
          if (ratio < 0.8 && Math.random() < 0.2) {
              ctx.globalAlpha = 0.2;
          } else {
              ctx.globalAlpha = Math.min(1, ratio * 2.5);
          }
      }

      // Drone Satellites (Drones follow ship)
      const droneCount = (p as any).upgradeLevel || 0;
      const displayDrones = Math.min(droneCount, 4);
      for (let i = 0; i < displayDrones; i++) {
          const angle = (Date.now() / 1000) + (i * Math.PI * 2 / displayDrones);
          const dx = Math.cos(angle) * 55;
          const dy = Math.sin(angle) * 55;
          
          const pulse = Math.sin(Date.now() / 150) * 3;
          ctx.fillStyle = "#ff3333";
          ctx.shadowBlur = 12 + pulse;
          ctx.shadowColor = "#ff0000";
          ctx.beginPath();
          ctx.arc(dx, dy, 7, 0, Math.PI * 2);
          ctx.fill();
          
          // Glow core
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(dx, dy, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
      }

      // Body (Ship style facing right)
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      
      ctx.beginPath();
      ctx.moveTo(25, 0);
      ctx.lineTo(-15, -15);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-15, 15);
      ctx.closePath();
      ctx.fill();

      // Weapon Visual Indicator
      ctx.fillStyle = "#fff";
      if (p.weaponType === WeaponType.SHOTGUN) {
          ctx.fillRect(10, -8, 5, 16);
      } else if (p.weaponType === WeaponType.SMG) {
          ctx.fillRect(15, -3, 10, 6);
      } else if (p.weaponType === WeaponType.SNIPER) {
          ctx.fillRect(15, -1, 20, 2);
      }

      // Hat/Accents
      if (p.hat === "crown") {
          ctx.fillStyle = "#ffd700";
          ctx.fillRect(-10, -5, 5, 10);
      } else if (p.hat === "tophat") {
          ctx.fillStyle = "#222";
          ctx.fillRect(-10, -8, 8, 16);
      }

      ctx.restore();

      // Info
      ctx.fillStyle = "#fff";
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(p.name, p.x, p.y - 25);

      ctx.fillStyle = "#222";
      ctx.fillRect(p.x - 15, p.y + 20, 30, 3);
      ctx.fillStyle = "#00ffaa";
      ctx.fillRect(p.x - 15, p.y + 20, (p.hp / 100) * 30, 3);
      
      if (id === socket.id) {
          ctx.strokeStyle = "rgba(0, 255, 170, 0.4)";
          ctx.setLineDash([2, 4]);
          ctx.beginPath(); ctx.arc(p.x, p.y, 35, 0, Math.PI*2); ctx.stroke();
          ctx.setLineDash([]);
      }
    });

    // Explosions
    explosionsRef.current = explosionsRef.current.filter(ex => Date.now() - ex.startTime < ex.duration);
    explosionsRef.current.forEach(ex => {
        const elapsed = Date.now() - ex.startTime;
        const ratio = elapsed / ex.duration;
        const opacity = 1 - ratio;
        
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = "#ff5500";
        ctx.shadowBlur = 40 * opacity;
        ctx.shadowColor = "#ff5500";
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, ex.radius * ratio, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#ffff00";
        ctx.beginPath();
        ctx.arc(ex.x, ex.y, (ex.radius * 0.6) * ratio, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Draw Screen-space indicators (HUD Flash)
    const switchElapsed = Date.now() - hudData.lastWeaponSwitch;
    if (switchElapsed < 400) {
        const opacity = (1 - (switchElapsed / 400)) * 0.15;
        ctx.fillStyle = WEAPONS[hudData.weaponType]?.color || "#fff";
        ctx.globalAlpha = opacity;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0;
    }

    ctx.restore();
  };

  return (
    <div ref={containerRef} className="w-full h-full relative cursor-crosshair overflow-hidden bg-[#0c0c14]">
      <canvas ref={canvasRef} />
      
      {/* Boss HP Bar */}
      {hudData.boss && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 animate-in fade-in slide-in-from-top-4 duration-1000 z-50">
              <div className="flex justify-between items-end mb-1.5 font-mono text-xs uppercase tracking-[0.4em] text-pink-500 font-black">
                  <span className="drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]">{hudData.boss.name}</span>
                  <span className="text-white/80">{Math.ceil((hudData.boss.hp / hudData.boss.maxHp) * 100)}%</span>
              </div>
              <div className="h-4 w-full bg-black/80 border-2 border-pink-500/40 rounded-full overflow-hidden backdrop-blur-2xl shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 via-pink-500 to-rose-400 shadow-[0_0_25px_rgba(236,72,153,0.6)] transition-all duration-500 ease-out relative"
                    style={{ width: `${Math.max(0, (hudData.boss.hp / hudData.boss.maxHp) * 100)}%` }}
                  >
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-[-25deg] animate-[shine_2s_infinite]" />
                  </div>
              </div>
              {/* Secondary decorative bar for "threat level" feel */}
              <div className="flex gap-1 mt-1 justify-center">
                  {[...Array(20)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1 w-full rounded-full transition-colors duration-500 ${
                            (hudData.boss!.hp / hudData.boss!.maxHp) * 20 > i 
                            ? 'bg-pink-500/60 shadow-[0_0_5px_rgba(236,72,153,0.4)]' 
                            : 'bg-white/5'
                        }`} 
                      />
                  ))}
              </div>
          </div>
      )}

      {/* HUD overlays */}
      <div className="absolute top-4 right-4 bg-black/50 p-4 border border-white/20 backdrop-blur-md rounded-lg pointer-events-none">
          <h3 className="text-xs uppercase tracking-widest text-white/50 mb-2 font-mono">Leaderboard</h3>
          {(Array.from(playersRef.current.values()) as PlayerData[])
            .sort((a, b) => b.score - a.score)
            .map(p => (
                <div key={p.id} className="flex justify-between gap-8 text-sm font-mono">
                    <span style={{ color: p.color }}>{p.name.slice(0, 8)}</span>
                    <span className="text-white">{p.score}</span>
                </div>
            ))
          }
      </div>

      <div className="absolute bottom-4 left-4 flex flex-col gap-3 pointer-events-none">
          {hudData.message && (
              <div className="bg-white text-black px-3 py-1 font-bold text-xs animate-bounce rounded-sm shadow-[0_0_15px_#fff]">
                  {hudData.message}
              </div>
          )}
          <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                  <span className="text-[10px] text-white/50 uppercase font-mono mb-1">Wave {hudData.currentWave} | Power Lvl {hudData.upgradeLevel}</span>
                  
                  {/* Weapon Carousel */}
                  <div className="flex items-center gap-4 bg-black/40 p-3 rounded-lg border border-white/10 backdrop-blur-sm">
                      {(() => {
                          const weaponTypes = Object.values(WeaponType);
                          const currentIndex = weaponTypes.indexOf(hudData.weaponType);
                          
                          return [-1, 0, 1].map(offset => {
                              const index = (currentIndex + offset + weaponTypes.length) % weaponTypes.length;
                              const type = weaponTypes[index];
                              const isCurrent = offset === 0;
                              const weaponData = WEAPONS[type];
                              
                              return (
                                  <div 
                                    key={type} 
                                    className={`flex flex-col items-center transition-all duration-300 ${isCurrent ? 'scale-110 opacity-100' : 'scale-90 opacity-40 blur-[1px]'}`}
                                  >
                                      <div 
                                        className={`w-10 h-10 rounded-lg flex items-center justify-center border-2 shadow-lg mb-1`}
                                        style={{ 
                                            borderColor: isCurrent ? weaponData.color : 'rgba(255,255,255,0.1)',
                                            backgroundColor: isCurrent ? 'rgba(255,255,255,0.05)' : 'transparent',
                                            color: weaponData.color,
                                            boxShadow: isCurrent ? `0 0 20px -5px ${weaponData.color}` : 'none'
                                        }}
                                      >
                                          {/* Mini icons for weapon types */}
                                          {type === WeaponType.PISTOL && <div className="font-black text-lg">P</div>}
                                          {type === WeaponType.SHOTGUN && <div className="font-black text-lg">S</div>}
                                          {type === WeaponType.SMG && <div className="font-black text-lg">M</div>}
                                          {type === WeaponType.SNIPER && <div className="font-black text-lg">R</div>}
                                      </div>
                                      {isCurrent && (
                                          <div className="flex flex-col items-center">
                                              <span className="text-white text-sm font-black italic tracking-tighter uppercase leading-tight">{type}</span>
                                              <div className="flex gap-1 mt-1">
                                                  <span className="text-[7px] text-white/40 font-mono bg-white/5 px-1 rounded">Q</span>
                                                  <span className="text-[7px] text-white/40 font-mono bg-white/5 px-1 rounded">E</span>
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              );
                          });
                      })()}
                  </div>
              </div>
              <div className="text-white/50 text-[10px] font-mono tracking-widest bg-black/20 px-2 py-1 rounded w-fit">
                  AMMO: {hudData.ammoLevel} | SHIELD: {Math.ceil(hudData.shield)}%
              </div>
          </div>
          <div className="text-white/30 text-[9px] font-mono uppercase bg-black/40 px-2 py-0.5 rounded w-fit">WASD MOVE | MOUSE FIRE</div>
      </div>
    </div>
  );
};
