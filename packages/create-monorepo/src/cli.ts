import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import prompts from "prompts";

type Vars = {
  ROOT_NAME: string;
  SCOPE: string;
  SCOPE_CONTRACTS: string;
  SCOPE_API: string;
};

function normalizeScope(input: string): string {
  const s = input.trim();
  if (!s) return "@app";
  return s.startsWith("@") ? s : `@${s}`;
}

function parseArgs(argv: string[]): {
  target?: string;
  scope?: string;
  yes: boolean;
} {
  const rest: string[] = [];
  let yes = false;
  let scope: string | undefined;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") yes = true;
    else if (a === "--scope" && argv[i + 1]) {
      scope = argv[++i];
    } else if (!a.startsWith("-")) rest.push(a);
  }
  return { target: rest[0], scope, yes };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyTree(
  fromDir: string,
  toDir: string,
  vars: Vars,
): Promise<void> {
  const entries = await fs.readdir(fromDir, { withFileTypes: true });
  await fs.mkdir(toDir, { recursive: true });
  for (const ent of entries) {
    const src = path.join(fromDir, ent.name);
    const destName = ent.name;
    const dest = path.join(toDir, destName);
    if (ent.isDirectory()) {
      await copyTree(src, dest, vars);
    } else {
      let body = await fs.readFile(src, "utf8");
      for (const [k, v] of Object.entries(vars)) {
        body = body.split(`{{${k}}}`).join(v);
      }
      await fs.writeFile(dest, body, "utf8");
    }
  }
}

async function main(): Promise<void> {
  const { target: targetArg, scope: scopeArg, yes } = parseArgs(process.argv);
  const templatesRoot = fileURLToPath(new URL("../templates", import.meta.url));

  if (!(await pathExists(templatesRoot))) {
    console.error(
      `Templates not found at ${templatesRoot}. If you run from source, use pnpm --filter @nb-hub/create-monorepo run dev.`,
    );
    process.exit(1);
  }

  let targetDir = targetArg;
  let scopeInput = scopeArg;

  if (!yes) {
    const r = await prompts(
      [
        {
          type: "text",
          name: "dir",
          message: "Project directory",
          initial: targetDir ?? "my-monorepo",
        },
        {
          type: "text",
          name: "scope",
          message: "npm scope (for @scope/contracts and @scope/api-server)",
          initial: scopeInput ?? "app",
        },
      ],
      { onCancel: () => process.exit(0) },
    );
    targetDir = r.dir as string;
    scopeInput = r.scope as string;
  } else {
    targetDir = targetDir ?? "my-monorepo";
    scopeInput = scopeInput ?? "app";
  }

  const absTarget = path.resolve(process.cwd(), targetDir);
  const ROOT_NAME = path.basename(absTarget);
  const SCOPE = normalizeScope(scopeInput);
  const SCOPE_CONTRACTS = `${SCOPE}/contracts`;
  const SCOPE_API = `${SCOPE}/api-server`;
  const vars: Vars = { ROOT_NAME, SCOPE, SCOPE_CONTRACTS, SCOPE_API };

  if (await pathExists(absTarget)) {
    const files = await fs.readdir(absTarget);
    if (files.length > 0) {
      console.error(`Target exists and is not empty: ${absTarget}`);
      process.exit(1);
    }
  }

  await fs.mkdir(absTarget, { recursive: true });
  await copyTree(templatesRoot, absTarget, vars);

  console.log(`Created monorepo at ${absTarget}`);
  console.log(`  Root name: ${ROOT_NAME}`);
  console.log(`  Packages: ${SCOPE_CONTRACTS}, ${SCOPE_API}, apps/web`);
  console.log("");
  console.log("Next:");
  console.log(`  cd ${targetDir}`);
  console.log("  pnpm install");
  console.log("  pnpm run build:all");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
