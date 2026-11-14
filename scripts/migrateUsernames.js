require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const { getUsernameError } = require("../utils/username");

const DRY_RUN = process.argv.includes("--dry-run");
const BASE_MAX = 15; // leaves room for "_" + up to 4 digits within the 20-char limit

const NEEDS_USERNAME = [{ username: { $exists: false } }, { username: null }];

// "José Álvarez" -> "jose_alvarez". Names with no latin letters -> "member".
const makeBase = (fullName) => {
  let base = String(fullName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!base) base = "member";
  if (!/^[a-z]/.test(base)) base = `u_${base}`;
  base = base.slice(0, BASE_MAX).replace(/_+$/, "");
  if (base.length < 3) base = `${base}_user`.slice(0, BASE_MAX);
  return base;
};

const isFree = (candidate, taken) =>
  !taken.has(candidate) && !getUsernameError(candidate);

const pickUsername = (base, taken) => {
  if (isFree(base, taken)) return base;
  for (let n = 1; n <= 9999; n++) {
    const candidate = `${base}_${n}`;
    if (isFree(candidate, taken)) return candidate;
  }
  throw new Error(`Could not generate a username for "${base}"`);
};

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(DRY_RUN ? "DRY RUN: nothing will be written" : "LIVE RUN");

  const existing = await User.find({ username: { $type: "string" } })
    .select("username")
    .lean();
  const taken = new Set(existing.map((u) => u.username));

  // Oldest accounts first, so they get the cleanest names
  const users = await User.find({ $or: NEEDS_USERNAME })
    .select("fullName createdAt")
    .sort({ createdAt: 1 })
    .lean();

  console.log(`${users.length} user(s) need a username`);

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    const base = makeBase(user.fullName);
    let saved = false;

    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      const username = pickUsername(base, taken);

      if (DRY_RUN) {
        taken.add(username);
        console.log(`[dry] ${user.fullName} -> ${username}`);
        saved = true;
        updated++;
        continue;
      }

      try {
        await User.updateOne(
          { _id: user._id, $or: NEEDS_USERNAME },
          { $set: { username } },
          { timestamps: false },
        );
        taken.add(username);
        console.log(`${user.fullName} -> ${username}`);
        saved = true;
        updated++;
      } catch (err) {
        if (err.code === 11000) {
          taken.add(username); // someone grabbed it meanwhile, try the next one
          continue;
        }
        console.error(`Failed for ${user._id}:`, err.message);
        break;
      }
    }

    if (!saved) failed++;
  }

  if (!DRY_RUN) await User.createIndexes();

  console.log(`Done. Updated: ${updated}, failed: ${failed}`);
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
