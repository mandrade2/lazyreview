import { mkdir, rm } from "fs/promises"
import { join, dirname } from "path"
import { tmpdir } from "os"

export interface FixtureDefinition {
  name: string
  commits: Array<{ message: string; files: Record<string, string> }>
  dirty?: {
    modified?: Record<string, string>
    added?: Record<string, string>
    deleted?: string[]
    renamed?: Record<string, string>
    untracked?: Record<string, string>
  }
}

export interface BuiltFixture {
  path: string
  cleanup(): Promise<void>
}

export async function buildFixture(definition: FixtureDefinition): Promise<BuiltFixture> {
  const dir = join(tmpdir(), `lazyreview-${definition.name}-${Date.now()}`)
  await mkdir(dir, { recursive: true })

  try {
    await Bun.$`git -C ${dir} init`.quiet()
    await Bun.$`git -C ${dir} config user.email "test@example.com"`.quiet()
    await Bun.$`git -C ${dir} config user.name "Test User"`.quiet()

    for (const commit of definition.commits) {
      for (const [relativePath, content] of Object.entries(commit.files)) {
        const absolutePath = join(dir, relativePath)
        await mkdir(dirname(absolutePath), { recursive: true })
        await Bun.write(absolutePath, content)
      }
      await Bun.$`git -C ${dir} add .`.quiet()
      await Bun.$`git -C ${dir} commit -m ${commit.message}`.quiet()
    }

    if (definition.dirty) {
      for (const [relativePath, content] of Object.entries(definition.dirty.modified ?? {})) {
        await Bun.write(join(dir, relativePath), content)
      }

      for (const relativePath of definition.dirty.deleted ?? []) {
        await Bun.$`git -C ${dir} rm ${relativePath}`.quiet()
      }

      for (const [newPath, oldPath] of Object.entries(definition.dirty.renamed ?? {})) {
        await Bun.$`git -C ${dir} mv ${oldPath} ${newPath}`.quiet()
      }

      for (const [relativePath, content] of Object.entries(definition.dirty.added ?? {})) {
        const absolutePath = join(dir, relativePath)
        await mkdir(dirname(absolutePath), { recursive: true })
        await Bun.write(absolutePath, content)
        await Bun.$`git -C ${dir} add ${relativePath}`.quiet()
      }

      for (const [relativePath, content] of Object.entries(definition.dirty.untracked ?? {})) {
        const absolutePath = join(dir, relativePath)
        await mkdir(dirname(absolutePath), { recursive: true })
        await Bun.write(absolutePath, content)
      }
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true })
    throw error
  }

  return {
    path: dir,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true })
    },
  }
}

export function buildPageScrollFixture(): Promise<BuiltFixture> {
  const lineCount = 100
  const originalLines: string[] = []
  for (let i = 1; i <= lineCount; i++) {
    originalLines.push(`const v${i} = ${i};`)
  }
  const originalContent = originalLines.join("\n") + "\n"

  const modifiedLines = [...originalLines]
  for (let i = 41; i <= 80; i++) {
    modifiedLines[i - 1] = `const v${i} = ${i * 10};`
  }
  const modifiedContent = modifiedLines.join("\n") + "\n"

  return buildFixture({
    name: "page-scroll",
    commits: [
      {
        message: "initial",
        files: {
          "src/long.ts": originalContent,
        },
      },
    ],
    dirty: {
      modified: {
        "src/long.ts": modifiedContent,
      },
    },
  })
}

export function buildCommitReviewFixture(): Promise<BuiltFixture> {
  return buildFixture({
    name: "commit-review",
    commits: [
      {
        message: "initial commit",
        files: {
          "README.md": "# Commit Review Test\n\nA repo for testing commit review mode.\n",
          "src/index.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
        },
      },
      {
        message: "add farewell",
        files: {
          "src/index.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`
}
`,
        },
      },
    ],
  })
}

export async function buildBranchReviewFixture(): Promise<BuiltFixture> {
  const fixture = await buildFixture({
    name: "branch-review",
    commits: [
      {
        message: "initial commit",
        files: {
          "README.md": "# Branch Review Test\n\nA repo for testing branch review mode.\n",
          "src/index.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
        },
      },
    ],
  })

  const dir = fixture.path

  // Rename the default branch to a known name so the scenario can reference it.
  await Bun.$`git -C ${dir} branch -m main`.quiet()

  // Create a feature branch that adds a farewell function.
  await Bun.$`git -C ${dir} checkout -b feature`.quiet()
  await Bun.write(
    join(dir, "src/index.ts"),
    `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`
}
`,
  )
  await Bun.$`git -C ${dir} add .`.quiet()
  await Bun.$`git -C ${dir} commit -m "add farewell"`.quiet()

  // Add a utils file on main so the branches diverge.
  await Bun.$`git -C ${dir} checkout main`.quiet()
  await Bun.write(
    join(dir, "src/utils.ts"),
    `export function add(a: number, b: number): number {
  return a + b
}
`,
  )
  await Bun.$`git -C ${dir} add .`.quiet()
  await Bun.$`git -C ${dir} commit -m "add utils"`.quiet()

  // Leave HEAD on feature so the app compares feature vs main.
  await Bun.$`git -C ${dir} checkout feature`.quiet()

  return fixture
}

export async function buildIdenticalBranchesFixture(): Promise<BuiltFixture> {
  const fixture = await buildFixture({
    name: "identical-branches",
    commits: [
      {
        message: "initial commit",
        files: {
          "README.md": "# Identical Branches Test\n\nA repo for testing identical branches.\n",
          "src/index.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
        },
      },
    ],
  })

  const dir = fixture.path
  await Bun.$`git -C ${dir} branch -m main`.quiet()
  await Bun.$`git -C ${dir} checkout -b feature`.quiet()
  // Leave main checked out so both branches exist and are identical.
  await Bun.$`git -C ${dir} checkout main`.quiet()

  return fixture
}

export async function buildMergeConflictFixture(): Promise<BuiltFixture> {
  const fixture = await buildFixture({
    name: "merge-conflict",
    commits: [
      {
        message: "initial commit",
        files: {
          "README.md": "# Merge Conflict Test\n\nA repo for testing merge conflicts.\n",
          "src/index.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`,
          "src/utils.ts": `export function add(a: number, b: number): number {
  return a + b
}
`,
        },
      },
    ],
  })

  const dir = fixture.path
  await Bun.$`git -C ${dir} branch -m main`.quiet()

  // feature changes the greeting and adds a helper (the helper auto-merges).
  await Bun.$`git -C ${dir} checkout -b feature`.quiet()
  await Bun.write(
    join(dir, "src/index.ts"),
    `export function greet(name: string): string {
  return \`Bonjour, \${name}!\`
}
`,
  )
  await Bun.write(
    join(dir, "src/utils.ts"),
    `export function add(a: number, b: number): number {
  return a + b
}

export function subtract(a: number, b: number): number {
  return a - b
}
`,
  )
  await Bun.$`git -C ${dir} add .`.quiet()
  await Bun.$`git -C ${dir} commit -m "french greeting and subtract"`.quiet()

  // main changes the same greeting line, guaranteeing a conflict.
  await Bun.$`git -C ${dir} checkout main`.quiet()
  await Bun.write(
    join(dir, "src/index.ts"),
    `export function greet(name: string): string {
  return \`Hola, \${name}!\`
}
`,
  )
  await Bun.$`git -C ${dir} add .`.quiet()
  await Bun.$`git -C ${dir} commit -m "spanish greeting"`.quiet()

  // Merging feature leaves src/index.ts conflicted (UU); src/utils.ts merges
  // cleanly and stays staged as modified. Merge exits non-zero on conflict.
  await Bun.$`git -C ${dir} merge feature`.quiet().nothrow()

  return fixture
}

export function buildGoldenFixture(): Promise<BuiltFixture> {
  return buildFixture({
    name: "golden",
    commits: [
      {
        message: "initial commit",
        files: {
          ".gitignore": "node_modules/\ndist/\n*.log\n",
          "package.json": JSON.stringify(
            {
              name: "golden-repo",
              version: "1.0.0",
              dependencies: { "solid-js": "^1.9.0" },
            },
            null,
            2,
          ),
          "tsconfig.json": JSON.stringify(
            {
              compilerOptions: {
                target: "ESNext",
                module: "ESNext",
                jsx: "preserve",
                strict: true,
              },
            },
            null,
            2,
          ),
          "README.md": "# Golden Repo\n\nA sample TypeScript project for testing.\n",
          "src/index.ts": `import { greet } from "./utils"
import { config } from "./config"

export function main() {
  const message = greet(config.name)
  console.log(message)
}

main()
`,
          "src/utils.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function add(a: number, b: number): number {
  return a + b
}
`,
          "src/config.ts": `export const config = {
  name: "world",
  debug: false,
}
`,
          "src/legacy.ts": `export function oldHelper() {
  return "legacy"
}
`,
          "src/spinner.ts": `export function keepOne() {
  return 1
}

export function removedTwo() {
  return 2
}

export function keepThree() {
  return 3
}
`,
        },
      },
    ],
    dirty: {
      modified: {
        "src/index.ts": `import { greet, farewell } from "./utils"
import { config } from "./config"

export function main() {
  const message = greet(config.name)
  console.log(message)
  console.log(farewell(config.name))
}

export function startup() {
  main()
}

startup()
`,
        "src/utils.ts": `export function greet(name: string): string {
  return \`Hello, \${name}!\`
}

export function farewell(name: string): string {
  return \`Goodbye, \${name}!\`
}

export function add(a: number, b: number): number {
  return a + b
}

export function multiply(a: number, b: number): number {
  return a * b
}
`,
        // Pure deletion: the removedTwo block is deleted with no additions,
        // so keepThree is a surviving context line right after the deletion.
        // This covers the regression where the full view painted that
        // surviving line with the "removed" background.
        "src/spinner.ts": `export function keepOne() {
  return 1
}

export function keepThree() {
  return 3
}
`,
      },
      added: {
        "src/components/counter.tsx": `import { createSignal } from "solid-js"

export function Counter() {
  const [count, setCount] = createSignal(0)

  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Count: {count()}
    </button>
  )
}
`,
      },
      deleted: ["src/legacy.ts"],
      renamed: {
        "src/app.config.ts": "src/config.ts",
      },
      untracked: {
        "docs/guide.md": "# Guide\n\nThis is a new markdown file.\n",
      },
    },
  })
}
