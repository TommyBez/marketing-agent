import { config } from "dotenv";

config({ path: process.env.DOTENV_CONFIG_PATH ?? ".env.local" });

function parseArgs(args: string[]): { all: boolean; workspaceIds: string[] } {
  const all = args.includes("--all");
  const workspaceIds: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--workspace") {
      const workspaceId = args[index + 1];
      if (!workspaceId) {
        throw new Error("--workspace requires a UUID");
      }
      workspaceIds.push(workspaceId);
      index += 1;
    }
  }

  if (all && workspaceIds.length > 0) {
    throw new Error("Use either --all or --workspace, not both");
  }

  return { all, workspaceIds };
}

async function main() {
  const [{ grantPilotCredits }, { pool }] = await Promise.all([
    import("@/lib/cost-accounting/credits"),
    import("@/lib/db"),
  ]);

  try {
    const selection = parseArgs(process.argv.slice(2));
    const result = await grantPilotCredits(selection);
    console.log(JSON.stringify({ event: "pilot_credits_granted", ...result }));
  } finally {
    await pool.end();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
