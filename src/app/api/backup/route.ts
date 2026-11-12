import fs from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { DB_PATH, backupName } from "@/lib/db";
import { backupPath, isBackupName } from "@/lib/backup";

// GET /api/backup : télécharge les données actuelles ; ?name=… : une sauvegarde (session requise, voir middleware)
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (name && !isBackupName(name)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const file = name ? backupPath(name) : DB_PATH;
  if (!fs.existsSync(file)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(fs.readFileSync(file), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="runn-ing_${name ?? backupName("export")}"`,
      "Cache-Control": "no-store",
    },
  });
}
