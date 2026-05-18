import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;
  const POWER_UP_DROP_RATE = 0.4; // 40% chance to drop a power-up

  // Game state
  const players = new Map();
  let enemies: any[] = [];
  let powerups: any[] = [];
  let boss: any = null;
  let worldX = 0;
  let lastEnemySpawn = Date.now();
  let nextBossMilestone = 2000;

  // Wave system state
  let currentWave = 0;
  let enemiesSpawnedInWave = 0;
  let waveInProgress = false;
  let lastWaveEndTime = Date.now();
  const WAVE_DELAY = 5000; // 5 seconds between waves

  // Master game loop on server for enemies
  setInterval(() => {
    if (!boss) worldX += 2; // Scroll speed only if no boss
    
    // Spawn Boss check
    const totalScore = Array.from(players.values()).reduce((sum, p) => sum + p.score, 0);
    if (!boss && totalScore >= nextBossMilestone) {
      const bossTypes = ["prime", "sentinel", "overlord"];
      const selectedType = bossTypes[Math.floor(Math.random() * bossTypes.length)];
      
      boss = {
        id: "BOSS_" + Date.now(),
        type: selectedType,
        x: worldX + 1000,
        y: 300,
        hp: 3000,
        maxHp: 3000,
        phase: 1,
        lastShot: 0,
        pattern: 0
      };
      io.emit("bossSpawned", boss);
      nextBossMilestone += 10000;
    }

    // Boss Behavior
    if (boss) {
      // Smoothly move into view
      const targetX = worldX + 700;
      boss.x += (targetX - boss.x) * 0.05;
      boss.y = 300 + Math.sin(worldX / 100) * 150;

      const now = Date.now();
      const phase = boss.hp > 1500 ? 1 : 2;
      boss.phase = phase;
      
      // Update client with full boss state
      io.emit("bossUpdate", { 
          hp: boss.hp, 
          x: boss.x, 
          y: boss.y, 
          type: boss.type,
          phase: boss.phase 
      });

      if (boss.type === "sentinel") {
        // SENTINEL: Rapid fire sniper shots
        const shotInterval = phase === 1 ? 500 : 300;
        if (now - boss.lastShot > shotInterval) {
          boss.lastShot = now;
          // Target a random player
          const playerList = Array.from(players.values());
          if (playerList.length > 0) {
            const p = playerList[Math.floor(Math.random() * playerList.length)];
            const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
            io.emit("enemyProjectileFired", {
                id: "S_" + Math.random(),
                x: boss.x - 40,
                y: boss.y,
                vx: Math.cos(angle) * (phase === 1 ? 12 : 16),
                vy: Math.sin(angle) * (phase === 1 ? 12 : 16),
                damage: 15,
                type: "fast"
            });
          }
        }
      } else if (boss.type === "overlord") {
        // OVERLORD: Hazard specialist (mines and slow heavy beams)
        const shotInterval = phase === 1 ? 2000 : 1200;
        if (now - boss.lastShot > shotInterval) {
          boss.lastShot = now;
          boss.pattern = (boss.pattern + 1) % 2;
          
          if (boss.pattern === 0) {
            // Spawn mines
            for(let i=0; i<(phase === 1 ? 3 : 5); i++) {
                const mineY = 50 + Math.random() * 500;
                const mine = {
                  id: "BM_" + Math.random(),
                  x: boss.x - 50,
                  y: mineY,
                  type: "mine",
                  hp: 50,
                  maxHp: 50,
                  scoreReward: 0,
                  lastShot: 0
                };
                enemies.push(mine);
                io.emit("spawnEnemy", mine);
            }
          } else {
            // Triple wave of standard shots
            for (let i = -2; i <= 2; i++) {
                io.emit("enemyProjectileFired", {
                    id: "O_" + Math.random(),
                    x: boss.x - 50,
                    y: boss.y + (i * 40),
                    vx: -6,
                    vy: 0,
                    damage: 20,
                    type: "heavy"
                });
            }
          }
        }
      } else {
        // PRIME: Balanced circular and targeted attacks
        const shotInterval = phase === 1 ? 1200 : 600;
        if (now - boss.lastShot > shotInterval) {
          boss.lastShot = now;
          boss.pattern = (boss.pattern + 1) % 3;

          if (boss.pattern === 0) {
            // Circular burst
            const count = phase === 1 ? 16 : 32;
            const damage = phase === 1 ? 15 : 25;
            for (let i = 0; i < count; i++) {
              const angle = (i / count) * Math.PI * 2;
              io.emit("enemyProjectileFired", {
                id: "B_" + Math.random(),
                x: boss.x,
                y: boss.y,
                vx: Math.cos(angle) * (phase === 1 ? 5 : 7),
                vy: Math.sin(angle) * (phase === 1 ? 5 : 7),
                damage: damage,
                type: phase === 1 ? "standard" : "heavy"
              });
            }
          } else {
            // Target all players
            players.forEach(p => {
                const baseAngle = Math.atan2(p.y - boss.y, p.x - boss.x);
                const count = phase === 1 ? 1 : 3;
                const damage = phase === 1 ? 20 : 30;
                
                for (let i = 0; i < count; i++) {
                    const angle = baseAngle + (count > 1 ? (Math.random() - 0.5) * 0.2 : 0);
                    io.emit("enemyProjectileFired", {
                        id: "B_" + Math.random(),
                        x: boss.x,
                        y: boss.y,
                        vx: Math.cos(angle) * (phase === 1 ? 8 : 12),
                        vy: Math.sin(angle) * (phase === 1 ? 8 : 12),
                        damage: damage,
                        type: phase === 1 ? "standard" : "fast"
                    });
                }
            });
          }
        }
      }
    }

    // Wave system logic
    if (!boss) {
      const now = Date.now();
      
      // Start a new wave if none is in progress and delay has passed
      if (!waveInProgress && now - lastWaveEndTime > WAVE_DELAY) {
        currentWave++;
        enemiesSpawnedInWave = 0;
        waveInProgress = true;
        io.emit("waveStarted", { wave: currentWave });
      }

      // Spawn enemies for current wave
      if (waveInProgress) {
        const enemiesPerWave = 5 + (currentWave * 3);
        const spawnInterval = Math.max(500, 2000 - (currentWave * 100));

        if (enemiesSpawnedInWave < enemiesPerWave && now - lastEnemySpawn > spawnInterval) {
          const typeRoll = Math.random();
          let type = "scout";
          let hp = 30 + (currentWave * 5);
          let scoreReward = 50;

          // Dynamic enemy selection scaled by wave
          if (typeRoll > 0.94 - (currentWave * 0.01) && currentWave >= 2) {
            type = "turret";
            hp = 100 + (currentWave * 5);
            scoreReward = 150;
          } else if (typeRoll > 0.88 - (currentWave * 0.02)) {
            type = "mine";
            hp = 40 + currentWave;
            scoreReward = 60;
          } else if (typeRoll > 0.78 - (currentWave * 0.02) && currentWave >= 2) {
            type = "shielded";
            hp = 150 + (currentWave * 10);
            scoreReward = 200;
          } else if (typeRoll > 0.65 - (currentWave * 0.03)) {
            type = "seeker";
            hp = 20 + currentWave;
            scoreReward = 100;
          } else if (typeRoll > 0.45 - (currentWave * 0.04)) {
            type = "heavy";
            hp = 60 + (currentWave * 8);
            scoreReward = 75;
          }

          const enemy = {
            id: Math.random().toString(36).substr(2, 9),
            x: 1400 + worldX, // Spawn ahead
            y: 50 + Math.random() * 500,
            type: type,
            hp: hp,
            maxHp: hp,
            scoreReward: scoreReward,
            lastShot: 0
          };
          enemies.push(enemy);
          enemiesSpawnedInWave++;
          lastEnemySpawn = now;
          io.emit("spawnEnemy", enemy);
        }

        // Check if wave is cleared
        if (enemiesSpawnedInWave >= enemiesPerWave && enemies.length === 0) {
          waveInProgress = false;
          lastWaveEndTime = now;
          io.emit("waveCleared", { wave: currentWave });
        }
      }
    }

    // Enemy firing and behavior logic
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        const now = Date.now();
        
        // Mine behavior: check for proximity to any player
        if (e.type === "mine") {
            let triggered = false;
            players.forEach(p => {
                const dist = Math.hypot(p.x - e.x, p.y - e.y);
                if (dist < 100) triggered = true;
            });
            
            if (triggered) {
                // Explode
                io.emit("enemyExploded", { x: e.x, y: e.y, radius: 120 });
                // Damage nearby players
                players.forEach((p, id) => {
                    const dist = Math.hypot(p.x - e.x, p.y - e.y);
                    if (dist < 120) {
                        p.hp -= 30;
                        io.emit("playerHit", { id, hp: p.hp });
                    }
                });
                enemies.splice(i, 1);
                io.emit("enemyDestroyed", { enemyId: e.id });
                continue;
            }
        }
        
        if (e.type === "seeker" && (now - (e.lastShot || 0) > 3000)) {
            e.lastShot = now;
            let nearestPlayer = null;
            let minDist = Infinity;
            players.forEach(p => {
                const d = Math.hypot(p.x - e.x, p.y - e.y);
                if (d < minDist) {
                    minDist = d;
                    nearestPlayer = p;
                }
            });

            if (nearestPlayer) {
                io.emit("enemyProjectileFired", {
                    id: Math.random().toString(36).substr(2, 9),
                    x: e.x - 20,
                    y: e.y,
                    targetId: (nearestPlayer as any).id,
                    type: "homing",
                    vx: -4,
                    vy: 0
                });
            }
        } 
        else if (e.type === "shielded" && (now - (e.lastShot || 0) > 4000)) {
            e.lastShot = now;
            io.emit("enemyProjectileFired", {
                id: "S_" + Math.random(),
                x: e.x - 40,
                y: e.y,
                vx: -2.5,
                vy: 0,
                damage: 25,
                type: "heavy"
            });
        }
        else if (e.type === "scout" && (now - (e.lastShot || 0) > 2500)) {
            e.lastShot = now;
            // Burst of 3
            for(let i=0; i<3; i++) {
                setTimeout(() => {
                    io.emit("enemyProjectileFired", {
                        id: "SC_" + Math.random(),
                        x: e.x - 20,
                        y: e.y,
                        vx: -8,
                        vy: (Math.random() - 0.5) * 0.5,
                        damage: 8,
                        type: "fast"
                    });
                }, i * 150);
            }
        }
        else if (e.type === "heavy" && (now - (e.lastShot || 0) > 3500)) {
            e.lastShot = now;
            // Spread shot
            for(let j=-1; j<=1; j++) {
                io.emit("enemyProjectileFired", {
                    id: "H_" + Math.random(),
                    x: e.x - 30,
                    y: e.y,
                    vx: -5,
                    vy: j * 1.5,
                    damage: 15,
                    type: "standard"
                });
            }
        }
        else if (e.type === "turret" && (now - (e.lastShot || 0) > 2000)) {
            let playerInRange = false;
            players.forEach(p => {
                const distH = Math.abs(p.x - e.x);
                if (distH < 600) playerInRange = true;
            });

            if (playerInRange) {
                e.lastShot = now;
                // High speed sniper shot
                io.emit("enemyProjectileFired", {
                    id: "T_" + Math.random(),
                    x: e.x - 30,
                    y: e.y,
                    vx: -12,
                    vy: 0,
                    damage: 20,
                    type: "fast"
                });
            }
        }
    }

    // Cleanup offscreen enemies
    enemies = enemies.filter(e => e.x > worldX - 100);
    
    // Cleanup powerups (15s lifespan or offscreen)
    const now = Date.now();
    powerups = powerups.filter(p => {
        const isOffscreen = p.x < worldX - 100;
        const isExpired = now - p.createdAt > 15000;
        if (isOffscreen || isExpired) {
            io.emit("removePowerup", { id: p.id });
            return false;
        }
        return true;
    });

    // Sync state occasionally or just let events handle it
  }, 1000 / 60);

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Join with customizable character
    socket.on("join", (playerData) => {
      players.set(socket.id, {
        id: socket.id,
        x: 100,
        y: 300,
        angle: 0,
        hp: 100,
        score: 0,
        ...playerData
      });
      
      // Send initial state to the new player
      socket.emit("init", {
        players: Array.from(players.values()),
        enemies: enemies,
        powerups: powerups,
        worldX: worldX,
        currentWave: currentWave,
        boss: boss
      });
      
      // Broadcast to others
      socket.broadcast.emit("playerJoined", players.get(socket.id));
    });

    socket.on("move", (moveData) => {
      const player = players.get(socket.id);
      if (player) {
        player.x = moveData.x;
        player.y = moveData.y;
        socket.broadcast.emit("playerMoved", player);
      }
    });

    socket.on("shoot", (projectileData) => {
      socket.broadcast.emit("projectileFired", {
        ...projectileData,
        ownerId: socket.id
      });
    });

    socket.on("enemyHit", (data) => {
        if (data.enemyId.startsWith("BOSS_") && boss) {
          boss.hp -= data.damage;
          io.emit("bossUpdate", { 
              hp: boss.hp, 
              x: boss.x, 
              y: boss.y, 
              phase: boss.phase 
          });
          if (boss.hp <= 0) {
            const shooterId = socket.id;
            const shooter = players.get(shooterId);
            if (shooter) shooter.score += 2500;
            io.emit("bossDefeated", { shooterId: shooterId, score: shooter?.score });
            
            // Boss always drops multiple powerups
            for(let i=0; i<3; i++) {
                const newPowerup = {
                    id: "PW_" + Math.random(),
                    x: boss.x + (Math.random() - 0.5) * 100,
                    y: boss.y + (Math.random() - 0.5) * 100,
                    type: Math.random() > 0.5 ? "UPGRADE" : "AMMO",
                    createdAt: Date.now()
                };
                powerups.push(newPowerup);
                io.emit("spawnPowerup", newPowerup);
            }
            boss = null;
          }
          return;
        }

        const enemyIndex = enemies.findIndex(e => e.id === data.enemyId);
        if (enemyIndex !== -1) {
            const enemy = enemies[enemyIndex];
            enemy.hp -= data.damage;
            
            // Broadcast health update
            io.emit("enemyHealthUpdate", { enemyId: enemy.id, hp: enemy.hp });

            if (enemy.hp <= 0) {
                enemies.splice(enemyIndex, 1);
                const shooter = players.get(socket.id);
                if (shooter) {
                    shooter.score += enemy.scoreReward || 50;
                    io.emit("enemyDestroyed", { enemyId: data.enemyId, shooterId: socket.id, score: shooter.score });
                    
                    // Use configurable drop rate
                    if (Math.random() < POWER_UP_DROP_RATE) {
                        const roll = Math.random();
                        let type = "UPGRADE";
                        let subType = "";

                        // Define probabilities for different types
                        if (roll > 0.9) { // 10% of drops are weapons
                            type = "WEAPON";
                            const wRoll = Math.random();
                            if (wRoll > 0.6) subType = "SHOTGUN";
                            else if (wRoll > 0.3) subType = "SMG";
                            else subType = "SNIPER";
                        } else if (roll > 0.75) { // 15% of drops are shields
                            type = "SHIELD";
                        } else if (roll > 0.55) { // 20% of drops are health
                            type = "HEALTH";
                        } else if (roll > 0.3) { // 25% of drops are ammo
                            type = "AMMO";
                        } else { // 30% of drops are upgrades
                            type = "UPGRADE";
                        }

                        const newPowerup = {
                            id: "PW_" + Math.random(),
                            x: enemy.x,
                            y: enemy.y,
                            type: type,
                            subType: subType,
                            createdAt: Date.now()
                        };
                        powerups.push(newPowerup);
                        io.emit("spawnPowerup", newPowerup);
                    }
                }
            }
        }
    });

    socket.on("collectPowerup", (data) => {
        const player = players.get(socket.id);
        if (player) {
            // Check if powerup exists on server
            const pwIndex = powerups.findIndex(p => p.id === data.id);
            if (pwIndex === -1) return;
            const pw = powerups[pwIndex];
            powerups.splice(pwIndex, 1);

            if (pw.type === "UPGRADE") {
                player.upgradeLevel = (player.upgradeLevel || 0) + 1;
            } else if (pw.type === "AMMO") {
                player.ammoLevel = (player.ammoLevel || 0) + 1;
            } else if (pw.type === "WEAPON") {
                player.weaponType = pw.subType;
            } else if (pw.type === "SHIELD") {
                player.shield = 100;
            } else if (pw.type === "HEALTH") {
                player.hp = Math.min(100, (player.hp || 0) + 40);
                io.emit("playerHit", { id: socket.id, hp: player.hp });
            }

            io.emit("playerPoweredUp", { 
                id: socket.id, 
                upgradeLevel: player.upgradeLevel, 
                ammoLevel: player.ammoLevel,
                weaponType: player.weaponType,
                shield: player.shield,
                message: `SYSTEM: ${pw.type} ACQUIRED`
            });
            
            io.emit("removePowerup", { id: pw.id });
        }
    });

    socket.on("changeWeapon", (data) => {
        const player = players.get(socket.id);
        if (player) {
            player.weaponType = data.weaponType;
            io.emit("playerPoweredUp", { 
                id: socket.id, 
                upgradeLevel: player.upgradeLevel, 
                ammoLevel: player.ammoLevel,
                weaponType: player.weaponType,
                shield: player.shield
            });
        }
    });

    socket.on("hit", (hitData) => {
      const targetId = hitData.targetId;
      const targetPlayer = players.get(targetId);
      if (targetPlayer) {
        let damage = hitData.damage;
        
        // Shield absorption
        if (targetPlayer.shield && targetPlayer.shield > 0) {
            if (targetPlayer.shield >= damage) {
                targetPlayer.shield -= damage;
                damage = 0;
            } else {
                damage -= targetPlayer.shield;
                targetPlayer.shield = 0;
            }
        }

        targetPlayer.hp -= damage;
        
        if (targetPlayer.shield !== undefined) {
             io.emit("playerShieldUpdate", { id: targetId, shield: targetPlayer.shield });
        }

        if (targetPlayer.hp <= 0) {
          targetPlayer.hp = 100;
          targetPlayer.x = Math.random() * 800;
          targetPlayer.y = Math.random() * 600;
          
          const shooter = players.get(socket.id);
          if (shooter) {
            shooter.score += 1;
            io.emit("scoreUpdate", { shooterId: socket.id, targetId, shooterScore: shooter.score });
          }
          
          io.emit("playerRespawn", targetPlayer);
        } else {
          io.emit("playerHit", { id: targetId, hp: targetPlayer.hp });
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      players.delete(socket.id);
      io.emit("playerLeft", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
