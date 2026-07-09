export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runMigrations } = await import("./db/migrate");
  await runMigrations();
  const { seedScenarios } = await import("./db/seed");
  await seedScenarios();
}
