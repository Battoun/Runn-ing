import { readDb } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Tools } from "./Tools";

export default function ToolsPage() {
  const { profile } = readDb().settings;
  return (
    <>
      <PageHeader title="Outils" subtitle="Calculateurs d'allure, prédictions et zones d'entraînement." />
      <Tools vma={profile.vma} fcMax={profile.fcMax} fcRepos={profile.fcRepos} />
    </>
  );
}
