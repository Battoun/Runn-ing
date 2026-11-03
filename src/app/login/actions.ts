"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { readDb } from "@/lib/db";
import { createSession } from "@/lib/auth";

export async function login(_: { error?: string; username?: string } | undefined, form: FormData) {
  const username = String(form.get("username") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const user = readDb().users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !ok) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit le bruteforce
    return { error: "Identifiant ou mot de passe incorrect.", username };
  }
  await createSession(user.id, user.username);
  redirect("/");
}
