import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data");
const filePath = path.join(dataDir, "pwa-installs.json");

interface InstallStats {
  count: number;
  lastInstalledAt: string | null;
  history: Array<{ timestamp: string; source?: string }>;
}

function getStats(): InstallStats {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    const initialData: InstallStats = { count: 0, lastInstalledAt: null, history: [] };
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
    return initialData;
  }
  try {
    const fileData = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(fileData);
  } catch {
    return { count: 0, lastInstalledAt: null, history: [] };
  }
}

export async function GET() {
  const stats = getStats();
  return NextResponse.json(stats);
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const stats = getStats();
    
    stats.count += 1;
    const now = new Date().toISOString();
    stats.lastInstalledAt = now;
    
    // Keep last 100 install records in history log
    stats.history.unshift({ timestamp: now, source: body.source || "unknown" });
    if (stats.history.length > 100) {
      stats.history = stats.history.slice(0, 100);
    }

    fs.writeFileSync(filePath, JSON.stringify(stats, null, 2));
    return NextResponse.json({ success: true, count: stats.count, stats });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
