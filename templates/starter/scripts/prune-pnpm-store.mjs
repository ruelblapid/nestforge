// Trims a `pnpm deploy` tree for the runtime image:
//
//   node scripts/prune-pnpm-store.mjs <dir containing node_modules>
//
// @prisma/client declares `prisma` and `typescript` as OPTIONAL peers, but pnpm resolves them from the app's dev
// dependencies, so the Prisma CLI, its studio, engines and TypeScript (~400MB) ship with the app. The client does not
// need them at runtime. This cuts those two links, then deletes every package in the store that nothing reachable
// from the app's own dependencies still points at.
import { existsSync, lstatSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(process.argv[2] ?? '.', 'node_modules');
const store = join(root, '.pnpm');
if (!existsSync(store)) throw new Error(`No pnpm store at ${store}`);

// 1. Cut the optional peer links.
for (const entry of readdirSync(store)) {
	if (!entry.startsWith('@prisma+client@')) continue;
	for (const peer of ['prisma', 'typescript']) {
		rmSync(join(store, entry, 'node_modules', peer), { force: true, recursive: true });
	}
}

// 2. Walk from the app's top-level packages through each store entry's sibling links.
const storeReal = realpathSync(store);
const reachable = new Set();
const pending = [];

const visit = (linkPath) => {
	let target;
	try {
		target = realpathSync(linkPath);
	} catch {
		return; // dangling link
	}
	if (!target.startsWith(storeReal)) return;
	const entry = target.slice(storeReal.length + 1).split(/[\\/]/)[0];
	if (entry && !reachable.has(entry)) {
		reachable.add(entry);
		pending.push(entry);
	}
};

const links = (dir) =>
	readdirSync(dir).flatMap((name) =>
		name.startsWith('@') && !lstatSync(join(dir, name)).isSymbolicLink()
			? readdirSync(join(dir, name)).map((scoped) => join(dir, name, scoped))
			: [join(dir, name)],
	);

for (const name of readdirSync(root)) {
	if (name === '.pnpm' || name === '.bin' || name.startsWith('.')) continue;
	for (const link of links(root).filter((p) => p.startsWith(join(root, name)))) visit(link);
}
while (pending.length > 0) {
	const entry = pending.pop();
	const nested = join(store, entry, 'node_modules');
	if (existsSync(nested)) for (const link of links(nested)) visit(link);
}

// 3. Delete the rest.
let removed = 0;
for (const entry of readdirSync(store)) {
	if (entry === 'node_modules' || reachable.has(entry)) continue;
	rmSync(join(store, entry), { recursive: true, force: true });
	removed++;
}
console.log(`pruned ${removed} unreachable packages, kept ${reachable.size}`);
