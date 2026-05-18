export interface PlayerData {
  id: string;
  name: string;
  color: string;
  hat: string;
  skin: string;
  x: number;
  y: number;
  angle: number;
  hp: number;
  score: number;
  weaponType: WeaponType;
  lastRespawn?: number;
}

export enum WeaponType {
  PISTOL = "PISTOL",
  SHOTGUN = "SHOTGUN",
  SMG = "SMG",
  SNIPER = "SNIPER",
}

export interface WeaponStats {
  name: string;
  damage: number;
  fireRate: number; // ms between shots
  bulletSpeed: number;
  spread: number;
  bulletCount: number;
  color: string;
}

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  [WeaponType.PISTOL]: {
    name: "Pistol",
    damage: 20,
    fireRate: 400,
    bulletSpeed: 10,
    spread: 0.05,
    bulletCount: 1,
    color: "#fff",
  },
  [WeaponType.SHOTGUN]: {
    name: "Shotgun",
    damage: 15,
    fireRate: 800,
    bulletSpeed: 8,
    spread: 0.3,
    bulletCount: 5,
    color: "#ff0",
  },
  [WeaponType.SMG]: {
    name: "SMG",
    damage: 10,
    fireRate: 100,
    bulletSpeed: 12,
    spread: 0.1,
    bulletCount: 1,
    color: "#0ff",
  },
  [WeaponType.SNIPER]: {
    name: "Sniper",
    damage: 80,
    fireRate: 1500,
    bulletSpeed: 20,
    spread: 0,
    bulletCount: 1,
    color: "#f0f",
  },
};

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
}
