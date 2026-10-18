const fs = require("fs");
const path = require("path");

const maximumActionIndex = 103;
const genderNames = { 0: "여", 1: "남" };

function hasAllSupportedActions(buffer) {
  if (
    buffer.length < 30 ||
    buffer[0] !== 0x41 ||
    buffer[1] !== 0x43
  ) {
    throw new Error("Invalid or truncated Ragnarok ACT file.");
  }

  const version = buffer.readUInt16LE(2);
  const actionCount = buffer.readUInt16LE(4);
  if (actionCount <= maximumActionIndex || actionCount > 600) return false;

  let offset = 16;
  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    if (offset + 4 > buffer.length) {
      throw new Error("Truncated ACT action.");
    }
    const frameCount = buffer.readUInt32LE(offset);
    offset += 4;
    if (frameCount > 1000) {
      throw new Error("ACT file has an invalid frame count.");
    }
    if (actionIndex <= maximumActionIndex && frameCount === 0) return false;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      if (offset + 36 > buffer.length) {
        throw new Error("Truncated ACT frame.");
      }
      offset += 32;
      const spriteCount = buffer.readUInt32LE(offset);
      offset += 4;
      if (spriteCount > 1000) {
        throw new Error("ACT frame has an invalid sprite count.");
      }
      const spriteSize = version >= 0x0205 ? 44 : version >= 0x0204 ? 36 : 32;
      const spriteBytes = spriteCount * spriteSize;
      if (offset + spriteBytes > buffer.length) {
        throw new Error("Truncated ACT sprite table.");
      }
      offset += spriteBytes;

      if (version >= 0x0200) {
        if (offset + 4 > buffer.length) {
          throw new Error("Truncated ACT event ID.");
        }
        offset += 4;
      }
      if (version >= 0x0203) {
        if (offset + 4 > buffer.length) {
          throw new Error("Truncated ACT attach-point count.");
        }
        const attachPointCount = buffer.readUInt32LE(offset);
        offset += 4;
        const attachPointBytes = attachPointCount * 16;
        if (
          attachPointCount > 1000 ||
          offset + attachPointBytes > buffer.length
        ) {
          throw new Error("Invalid ACT attach-point table.");
        }
        offset += attachPointBytes;
      }
    }
  }

  if (version >= 0x0201) {
    if (offset + 4 > buffer.length) {
      throw new Error("Truncated ACT event count.");
    }
    const eventCount = buffer.readUInt32LE(offset);
    offset += 4;
    const eventBytes = eventCount * 40;
    if (offset + eventBytes > buffer.length) {
      throw new Error("Truncated ACT event table.");
    }
    offset += eventBytes;
    if (version >= 0x0202) {
      const intervalBytes = actionCount * 4;
      if (offset + intervalBytes > buffer.length) {
        throw new Error("Truncated ACT action intervals.");
      }
      offset += intervalBytes;
    }
  }

  if (offset !== buffer.length) {
    throw new Error("ACT file contains unsupported trailing data.");
  }
  return true;
}

function getBodyPaletteDirectory(dataRoot, race) {
  return race === "doram"
    ? path.join(dataRoot, "palette", "도람족", "body")
    : path.join(dataRoot, "palette", "몸");
}

function getHairPaletteDirectory(dataRoot, race) {
  return race === "doram"
    ? path.join(dataRoot, "palette", "도람족", "머리")
    : path.join(dataRoot, "palette", "머리");
}

function getHairSpriteDirectory(dataRoot, race, genderName) {
  const raceDirectory = race === "doram" ? "도람족" : "인간족";
  return path.join(dataRoot, "sprite", raceDirectory, "머리통", genderName);
}

function getBodySpriteDirectory(dataRoot, race, genderName) {
  const raceDirectory = race === "doram" ? "도람족" : "인간족";
  return path.join(dataRoot, "sprite", raceDirectory, "몸통", genderName);
}

function copyHairAssets(dataRoot, hairDirectory, race, genderName) {
  const spriteDirectory = getHairSpriteDirectory(dataRoot, race, genderName);
  const paletteDirectory = getHairPaletteDirectory(dataRoot, race);
  const maximumHairStyle = race === "doram" ? 10 : 42;
  const styles = {};

  fs.mkdirSync(hairDirectory, { recursive: true });
  for (let hairStyle = 1; hairStyle <= maximumHairStyle; hairStyle += 1) {
    const stem = `${hairStyle}_${genderName}`;
    const sourceSpr = path.join(spriteDirectory, `${stem}.spr`);
    const sourceAct = path.join(spriteDirectory, `${stem}.act`);
    if (!fs.existsSync(sourceSpr) || !fs.existsSync(sourceAct)) continue;
    if (!hasAllSupportedActions(fs.readFileSync(sourceAct))) continue;

    const outputStem = String(hairStyle);
    fs.copyFileSync(sourceSpr, path.join(hairDirectory, `${outputStem}.spr`));
    fs.copyFileSync(sourceAct, path.join(hairDirectory, `${outputStem}.act`));
    const availablePalettes = [];
    for (let palette = 0; palette <= 8; palette += 1) {
      const paletteName = `머리${stem}_${palette}.pal`;
      const sourcePalette = path.join(paletteDirectory, paletteName);
      const outputPalette = path.join(
        hairDirectory,
        `${outputStem}_${palette}.pal`
      );
      if (fs.existsSync(sourcePalette)) {
        fs.copyFileSync(sourcePalette, outputPalette);
        availablePalettes.push(palette);
      } else if (palette === 0) {
        const sprite = fs.readFileSync(sourceSpr);
        if (sprite.length < 1024) {
          throw new Error(`SPR file has no embedded palette: ${sourceSpr}`);
        }
        fs.writeFileSync(outputPalette, sprite.subarray(sprite.length - 1024));
        availablePalettes.push(palette);
      }
    }
    if (availablePalettes.includes(0)) {
      styles[hairStyle] = availablePalettes;
    }
  }

  return styles;
}

function prepareLocalJobAssets(resourceRoot, outputDirectory, jobListPath) {
  const dataRoot = path.join(resourceRoot, "data");
  const jobMapPath = path.join(__dirname, "local-job-sprite-map.json");
  const jobMap = JSON.parse(fs.readFileSync(jobMapPath, "utf8"));
  const jobList = fs.readFileSync(jobListPath, "utf8");
  const boardJobIds = new Set(
    [...jobList.matchAll(/id:\s*(\d+),\s*name:/g)].map((match) => match[1])
  );
  const missingMappings = [...boardJobIds].filter(
    (jobId) => !Object.prototype.hasOwnProperty.call(jobMap, jobId)
  );
  if (missingMappings.length) {
    throw new Error(
      `Job sprite map is missing board IDs: ${missingMappings.join(", ")}`
    );
  }

  fs.mkdirSync(outputDirectory, { recursive: true });
  const manifest = { jobs: {} };
  const hairstylesByRaceAndGender = new Map();
  let preparedVariants = 0;
  let missingVariants = 0;
  let preparedHairStyles = 0;

  for (const jobId of [...boardJobIds].sort(
    (left, right) => Number(left) - Number(right)
  )) {
    const job = jobMap[jobId];
    for (const [gender, genderName] of Object.entries(genderNames)) {
      const spriteStem = job[gender === "1" ? "male" : "female"];
      if (!spriteStem) {
        missingVariants += 1;
        continue;
      }

      const bodyBase = `${spriteStem}_${genderName}`;
      const bodyDirectory = getBodySpriteDirectory(
        dataRoot,
        job.race,
        genderName
      );
      const sourceSpr = path.join(bodyDirectory, `${bodyBase}.spr`);
      const sourceAct = path.join(bodyDirectory, `${bodyBase}.act`);
      const sourceImf = path.join(dataRoot, "imf", `${bodyBase}.imf`);
      if (
        !fs.existsSync(sourceSpr) ||
        !fs.existsSync(sourceAct) ||
        !hasAllSupportedActions(fs.readFileSync(sourceAct))
      ) {
        missingVariants += 1;
        console.warn(`No complete local body assets for job ${jobId}, gender ${gender}.`);
        continue;
      }

      const bodyPaletteDirectory = getBodyPaletteDirectory(dataRoot, job.race);
      const bodyPalettes = [];
      for (let palette = 0; palette <= 7; palette += 1) {
        const palettePath = path.join(
          bodyPaletteDirectory,
          `${bodyBase}_${palette}.pal`
        );
        if (fs.existsSync(palettePath)) bodyPalettes.push(palette);
      }
      if (!bodyPalettes.includes(0)) {
        const sprite = fs.readFileSync(sourceSpr);
        if (sprite.length < 1024) {
          throw new Error(`SPR file has no embedded palette: ${sourceSpr}`);
        }
        bodyPalettes.push(0);
      }
      const relativeOutputDirectory = path.join(jobId, gender);
      const variantOutputDirectory = path.join(
        outputDirectory,
        relativeOutputDirectory
      );
      fs.mkdirSync(variantOutputDirectory, { recursive: true });
      fs.copyFileSync(sourceSpr, path.join(variantOutputDirectory, "body.spr"));
      fs.copyFileSync(sourceAct, path.join(variantOutputDirectory, "body.act"));
      if (fs.existsSync(sourceImf)) {
        fs.copyFileSync(sourceImf, path.join(variantOutputDirectory, "body.imf"));
      }
      for (const palette of bodyPalettes) {
        const sourcePalette = path.join(
          bodyPaletteDirectory,
          `${bodyBase}_${palette}.pal`
        );
        if (fs.existsSync(sourcePalette)) {
          fs.copyFileSync(
            sourcePalette,
            path.join(variantOutputDirectory, `body_${palette}.pal`)
          );
        } else if (palette === 0) {
          const sprite = fs.readFileSync(sourceSpr);
          fs.writeFileSync(
            path.join(variantOutputDirectory, "body_0.pal"),
            sprite.subarray(sprite.length - 1024)
          );
        }
      }

      const hairKey = `${job.race}:${gender}`;
      if (!hairstylesByRaceAndGender.has(hairKey)) {
        const hairDirectory = path.join(
          outputDirectory,
          "hair",
          job.race,
          gender
        );
        const hairstyles = copyHairAssets(
          dataRoot,
          hairDirectory,
          job.race,
          genderName
        );
        hairstylesByRaceAndGender.set(hairKey, hairstyles);
        preparedHairStyles += Object.keys(hairstyles).length;
      }
      const hairstyles = hairstylesByRaceAndGender.get(hairKey);
      if (Object.keys(hairstyles).length === 0) {
        missingVariants += 1;
        console.warn(`No complete local hairstyles for job ${jobId}, gender ${gender}.`);
        continue;
      }

      manifest.jobs[jobId] = manifest.jobs[jobId] || {};
      manifest.jobs[jobId][gender] = {
        race: job.race,
        hasImf: fs.existsSync(sourceImf),
        bodyPalettes,
        hairstyles,
      };
      preparedVariants += 1;
    }
  }

  fs.writeFileSync(
    path.join(outputDirectory, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(
    `Prepared ${preparedVariants} job/gender variants and ` +
      `${preparedHairStyles} hairstyle variants; ${missingVariants} combinations ` +
      `will use the renderer API.`
  );
}

const [, , resourceRoot, outputDirectory, jobListPath] = process.argv;
if (!resourceRoot || !outputDirectory || !jobListPath) {
  throw new Error(
    "Usage: node prepare-local-job-assets.js <resource-root> <output-directory> <job-list.vue>"
  );
}

prepareLocalJobAssets(resourceRoot, outputDirectory, jobListPath);
