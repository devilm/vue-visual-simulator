const fs = require("fs");
const path = require("path");
const { TextDecoder } = require("util");

const maximumActionIndex = 103;
const decoder = new TextDecoder("euc-kr");

function assertRange(buffer, offset, length, label) {
  if (offset < 0 || length < 0 || offset + length > buffer.length) {
    throw new Error(`Truncated ${label} Lua bytecode.`);
  }
}

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
  if (actionCount <= maximumActionIndex || actionCount > 600) {
    return false;
  }

  let offset = 16;
  for (let actionIndex = 0; actionIndex < actionCount; actionIndex += 1) {
    assertRange(buffer, offset, 4, "ACT action");
    const frameCount = buffer.readUInt32LE(offset);
    offset += 4;
    if (frameCount > 1000) {
      throw new Error("ACT file has an invalid frame count.");
    }
    if (actionIndex <= maximumActionIndex && frameCount === 0) {
      return false;
    }

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      assertRange(buffer, offset, 36, "ACT frame");
      offset += 32;
      const spriteCount = buffer.readUInt32LE(offset);
      offset += 4;
      if (spriteCount > 1000) {
        throw new Error("ACT frame has an invalid sprite count.");
      }
      const spriteSize = version >= 0x0205 ? 44 : version >= 0x0204 ? 36 : 32;
      assertRange(buffer, offset, spriteCount * spriteSize, "ACT sprites");
      offset += spriteCount * spriteSize;

      if (version >= 0x0200) {
        assertRange(buffer, offset, 4, "ACT event ID");
        offset += 4;
      }
      if (version >= 0x0203) {
        assertRange(buffer, offset, 4, "ACT attach-point count");
        const attachPointCount = buffer.readUInt32LE(offset);
        offset += 4;
        if (attachPointCount > 1000) {
          throw new Error("ACT frame has an invalid attach-point count.");
        }
        assertRange(buffer, offset, attachPointCount * 16, "ACT attach points");
        offset += attachPointCount * 16;
      }
    }
  }

  if (version >= 0x0201) {
    assertRange(buffer, offset, 4, "ACT event count");
    const eventCount = buffer.readUInt32LE(offset);
    offset += 4;
    assertRange(buffer, offset, eventCount * 40, "ACT event table");
    offset += eventCount * 40;
    if (version >= 0x0202) {
      assertRange(buffer, offset, actionCount * 4, "ACT action intervals");
      offset += actionCount * 4;
    }
  }

  if (offset !== buffer.length) {
    throw new Error("ACT file contains unsupported trailing data.");
  }
  return true;
}

function readLuaPrototype(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (
    buffer.length < 12 ||
    buffer[0] !== 0x1b ||
    buffer.toString("ascii", 1, 4) !== "Lua" ||
    buffer[4] !== 0x51 ||
    buffer[6] !== 1 ||
    buffer[7] !== 4 ||
    buffer[8] !== 4 ||
    buffer[9] !== 4 ||
    buffer[10] !== 8
  ) {
    throw new Error(`Unsupported Lua 5.1 bytecode file: ${filePath}`);
  }

  let offset = 12;
  function readUInt32() {
    assertRange(buffer, offset, 4, filePath);
    const value = buffer.readUInt32LE(offset);
    offset += 4;
    return value;
  }

  function readString() {
    const length = readUInt32();
    if (length === 0) return null;
    assertRange(buffer, offset, length, filePath);
    const value = decoder.decode(buffer.subarray(offset, offset + length - 1));
    offset += length;
    return value;
  }

  function readPrototype() {
    readString();
    assertRange(buffer, offset, 12, filePath);
    offset += 12;

    const codeCount = readUInt32();
    assertRange(buffer, offset, codeCount * 4, filePath);
    const code = [];
    for (let index = 0; index < codeCount; index += 1) {
      code.push(readUInt32());
    }

    const constantCount = readUInt32();
    const constants = [];
    for (let index = 0; index < constantCount; index += 1) {
      assertRange(buffer, offset, 1, filePath);
      const type = buffer[offset];
      offset += 1;
      if (type === 0) {
        constants.push(null);
      } else if (type === 1) {
        assertRange(buffer, offset, 1, filePath);
        constants.push(buffer[offset] !== 0);
        offset += 1;
      } else if (type === 3) {
        assertRange(buffer, offset, 8, filePath);
        constants.push(buffer.readDoubleLE(offset));
        offset += 8;
      } else if (type === 4) {
        constants.push(readString());
      } else {
        throw new Error(`Unsupported Lua constant type ${type} in ${filePath}.`);
      }
    }

    const prototypeCount = readUInt32();
    for (let index = 0; index < prototypeCount; index += 1) {
      readPrototype();
    }

    const lineInfoCount = readUInt32();
    assertRange(buffer, offset, lineInfoCount * 4, filePath);
    offset += lineInfoCount * 4;

    const localCount = readUInt32();
    for (let index = 0; index < localCount; index += 1) {
      readString();
      assertRange(buffer, offset, 8, filePath);
      offset += 8;
    }

    const upvalueCount = readUInt32();
    for (let index = 0; index < upvalueCount; index += 1) {
      readString();
    }

    return { code, constants };
  }

  const prototype = readPrototype();
  if (offset !== buffer.length) {
    throw new Error(`Unexpected trailing data in ${filePath}.`);
  }
  return prototype;
}

function executeLuaTable(filePath, globals = new Map()) {
  const { code, constants } = readLuaPrototype(filePath);
  const registers = new Map();
  let result;

  function getRegisterOrConstant(index) {
    return index & 0x100
      ? constants[index & 0xff]
      : registers.get(index);
  }

  for (let pc = 0; pc < code.length; pc += 1) {
    const instruction = code[pc];
    const opcode = instruction & 0x3f;
    const a = (instruction >>> 6) & 0xff;
    const b = (instruction >>> 23) & 0x1ff;
    const c = (instruction >>> 14) & 0x1ff;
    const bx = (instruction >>> 14) & 0x3ffff;

    if (opcode === 0) {
      registers.set(a, registers.get(b));
    } else if (opcode === 1) {
      registers.set(a, constants[bx]);
    } else if (opcode === 5) {
      registers.set(a, globals.get(constants[bx]));
    } else if (opcode === 6) {
      const table = registers.get(b);
      if (!(table instanceof Map)) {
        throw new Error(`Invalid table lookup in ${filePath}.`);
      }
      registers.set(a, table.get(getRegisterOrConstant(c)));
    } else if (opcode === 7) {
      globals.set(constants[bx], registers.get(a));
    } else if (opcode === 9) {
      const table = registers.get(a);
      if (!(table instanceof Map)) {
        throw new Error(`Invalid table assignment in ${filePath}.`);
      }
      const key = getRegisterOrConstant(b);
      if (key == null) {
        throw new Error(`Invalid table key in ${filePath}.`);
      }
      table.set(key, getRegisterOrConstant(c));
    } else if (opcode === 10) {
      result = new Map();
      registers.set(a, result);
    } else if (opcode === 34) {
      const table = registers.get(a);
      if (!(table instanceof Map)) {
        throw new Error(`Invalid array assignment in ${filePath}.`);
      }
      let block = c;
      if (block === 0) {
        block = code[pc + 1];
        pc += 1;
      }
      let maximumRegister = a;
      registers.forEach((value, index) => {
        maximumRegister = Math.max(maximumRegister, index);
      });
      const count = b || maximumRegister - a;
      for (let index = 0; index < count; index += 1) {
        table.set((block - 1) * 50 + index + 1, registers.get(a + index + 1));
      }
    } else if (opcode !== 30) {
      throw new Error(`Unsupported Lua opcode ${opcode} in ${filePath}.`);
    }
  }

  return { globals, result };
}

function prepareNoviceEquipment(
  resourceRoot,
  outputDirectory,
  itemsPath,
  jobsManifestPath
) {
  const luaDirectory = path.join(
    resourceRoot,
    "data",
    "luafiles514",
    "lua files",
    "datainfo"
  );
  const accessoryIdPath = path.join(luaDirectory, "AccessoryId.lub");
  const accessoryNamePath = path.join(luaDirectory, "AccName.lub");
  const idResult = executeLuaTable(accessoryIdPath);
  const accessoryIds = idResult.globals.get("ACCESSORY_IDs");
  if (!(accessoryIds instanceof Map)) {
    throw new Error("AccessoryId.lub did not define ACCESSORY_IDs.");
  }

  const nameResult = executeLuaTable(accessoryNamePath, idResult.globals);
  const accessoryNames = nameResult.globals.get("AccNameTable");
  if (!(accessoryNames instanceof Map)) {
    throw new Error("AccName.lub did not define AccNameTable.");
  }

  const robeIdPath = path.join(luaDirectory, "SpriteRobeId.lub");
  const robeNamePath = path.join(luaDirectory, "SpriteRobeName.lub");
  const robeIdResult = executeLuaTable(robeIdPath);
  if (!(robeIdResult.globals.get("SPRITE_ROBE_IDs") instanceof Map)) {
    throw new Error("SpriteRobeId.lub did not define SPRITE_ROBE_IDs.");
  }
  const robeNameResult = executeLuaTable(
    robeNamePath,
    robeIdResult.globals
  );
  const robeNames = robeNameResult.globals.get("RobeNameTable");
  if (!(robeNames instanceof Map)) {
    throw new Error("SpriteRobeName.lub did not define RobeNameTable.");
  }

  const items = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
  const viewIds = new Set(
    items
      .filter(
        (item) =>
          (item.top || item.mid || item.bot) &&
          Number.isInteger(Number(item.viewID)) &&
          Number(item.viewID) > 0
      )
      .map((item) => Number(item.viewID))
  );

  const male = String.fromCharCode(0xb0a8);
  const accessoryDirectory = path.join(
    resourceRoot,
    "data",
    "sprite",
    String.fromCharCode(0xc545, 0xc138, 0xc0ac, 0xb9ac),
    male
  );
  const headgearDirectory = path.join(outputDirectory, "headgear");
  fs.mkdirSync(headgearDirectory, { recursive: true });

  const supportedViewIds = [];
  let missingMetadata = 0;
  let missingAssets = 0;
  let incompleteActions = 0;

  for (const viewId of [...viewIds].sort((left, right) => left - right)) {
    const spriteName = accessoryNames.get(viewId);
    if (typeof spriteName !== "string") {
      missingMetadata += 1;
      continue;
    }

    const sourceBase = path.join(accessoryDirectory, `${male}${spriteName}`);
    const sourceSprite = `${sourceBase}.spr`;
    const sourceAction = `${sourceBase}.act`;
    if (!fs.existsSync(sourceSprite) || !fs.existsSync(sourceAction)) {
      missingAssets += 1;
      continue;
    }

    const actionBuffer = fs.readFileSync(sourceAction);
    if (!hasAllSupportedActions(actionBuffer)) {
      incompleteActions += 1;
      continue;
    }

    fs.copyFileSync(sourceSprite, path.join(headgearDirectory, `${viewId}.spr`));
    fs.copyFileSync(sourceAction, path.join(headgearDirectory, `${viewId}.act`));
    supportedViewIds.push(viewId);
  }

  const supportedViewIdSet = new Set(supportedViewIds);
  for (const filename of fs.readdirSync(headgearDirectory)) {
    const match = /^(\d+)\.(?:spr|act)$/i.exec(filename);
    if (match && !supportedViewIdSet.has(Number(match[1]))) {
      fs.rmSync(path.join(headgearDirectory, filename));
    }
  }

  fs.writeFileSync(
    path.join(headgearDirectory, "manifest.json"),
    `${JSON.stringify({ viewIds: supportedViewIds }, null, 2)}\n`
  );

  const equipmentRoot = path.join(path.dirname(outputDirectory), "jobs", "equipment");
  const genderNames = { 0: "\uC5EC", 1: male };
  for (const [gender, genderName] of Object.entries(genderNames)) {
    const genderAccessoryDirectory = path.join(
      resourceRoot,
      "data",
      "sprite",
      String.fromCharCode(0xc545, 0xc138, 0xc0ac, 0xb9ac),
      genderName
    );
    const localHeadgearDirectory = path.join(
      equipmentRoot,
      "headgear",
      gender
    );
    fs.mkdirSync(localHeadgearDirectory, { recursive: true });
    const genderViewIds = [];
    for (const viewId of [...viewIds].sort((left, right) => left - right)) {
      const spriteName = accessoryNames.get(viewId);
      if (typeof spriteName !== "string") continue;

      const sourceBases = [
        path.join(genderAccessoryDirectory, `${genderName}${spriteName}`),
        path.join(genderAccessoryDirectory, spriteName),
      ];
      const sourceBase = sourceBases.find(
        (candidate) =>
          fs.existsSync(`${candidate}.spr`) &&
          fs.existsSync(`${candidate}.act`)
      );
      if (!sourceBase) continue;

      const sourceSprite = `${sourceBase}.spr`;
      const sourceAction = `${sourceBase}.act`;
      if (!hasAllSupportedActions(fs.readFileSync(sourceAction))) continue;

      fs.copyFileSync(
        sourceSprite,
        path.join(localHeadgearDirectory, `${viewId}.spr`)
      );
      fs.copyFileSync(
        sourceAction,
        path.join(localHeadgearDirectory, `${viewId}.act`)
      );
      genderViewIds.push(viewId);
    }

    const supportedGenderViewIds = new Set(genderViewIds);
    for (const filename of fs.readdirSync(localHeadgearDirectory)) {
      const match = /^(\d+)\.(?:spr|act)$/i.exec(filename);
      if (match && !supportedGenderViewIds.has(Number(match[1]))) {
        fs.rmSync(path.join(localHeadgearDirectory, filename));
      }
    }
    fs.writeFileSync(
      path.join(localHeadgearDirectory, "manifest.json"),
      `${JSON.stringify({ viewIds: genderViewIds }, null, 2)}\n`
    );
  }

  const garmentDirectory = path.join(outputDirectory, "garment");
  fs.mkdirSync(garmentDirectory, { recursive: true });
  const garmentViewIds = new Set(
    items
      .filter(
        (item) =>
          item.garment &&
          Number.isInteger(Number(item.viewID)) &&
          Number(item.viewID) > 0
      )
      .map((item) => Number(item.viewID))
  );
  const supportedGarmentViewIds = [];
  let missingGarmentMetadata = 0;
  let missingGarmentAssets = 0;
  let incompleteGarmentActions = 0;
  const robeRoot = path.join(
    resourceRoot,
    "data",
    "sprite",
    "\uB85C\uBE0C"
  );
  for (const viewId of [...garmentViewIds].sort((left, right) => left - right)) {
    const robeName = robeNames.get(viewId);
    if (typeof robeName !== "string") {
      missingGarmentMetadata += 1;
      continue;
    }

    const garmentName = robeName.toLowerCase();
    const robeDirectory = path.join(robeRoot, garmentName);
    const jobSpecificBase = path.join(
      robeDirectory,
      "\uB0A8",
      "\uCD08\uBCF4\uC790_\uB0A8"
    );
    const fallbackBase = path.join(robeDirectory, garmentName);
    const sourceBase =
      fs.existsSync(`${jobSpecificBase}.spr`) &&
      fs.existsSync(`${jobSpecificBase}.act`)
        ? jobSpecificBase
        : fallbackBase;
    const sourceSprite = `${sourceBase}.spr`;
    const sourceAction = `${sourceBase}.act`;
    if (!fs.existsSync(sourceSprite) || !fs.existsSync(sourceAction)) {
      missingGarmentAssets += 1;
      continue;
    }

    if (!hasAllSupportedActions(fs.readFileSync(sourceAction))) {
      incompleteGarmentActions += 1;
      continue;
    }

    fs.copyFileSync(sourceSprite, path.join(garmentDirectory, `${viewId}.spr`));
    fs.copyFileSync(sourceAction, path.join(garmentDirectory, `${viewId}.act`));
    supportedGarmentViewIds.push(viewId);
  }

  const supportedGarmentViewIdSet = new Set(supportedGarmentViewIds);
  for (const filename of fs.readdirSync(garmentDirectory)) {
    const match = /^(\d+)\.(?:spr|act)$/i.exec(filename);
    if (match && !supportedGarmentViewIdSet.has(Number(match[1]))) {
      fs.rmSync(path.join(garmentDirectory, filename));
    }
  }
  fs.writeFileSync(
    path.join(garmentDirectory, "manifest.json"),
    `${JSON.stringify({ viewIds: supportedGarmentViewIds }, null, 2)}\n`
  );

  const jobsManifest = JSON.parse(fs.readFileSync(jobsManifestPath, "utf8"));
  const jobMap = JSON.parse(
    fs.readFileSync(path.join(__dirname, "local-job-sprite-map.json"), "utf8")
  );
  let preparedJobGarments = 0;
  let jobGarmentFallbacks = 0;
  let jobGarmentVariants = 0;
  for (const [jobId, genderVariants] of Object.entries(jobsManifest.jobs)) {
    const job = jobMap[jobId];
    for (const [gender, variant] of Object.entries(genderVariants)) {
      const genderName = genderNames[gender];
      const spriteStem = job?.[gender === "1" ? "male" : "female"];
      if (!spriteStem) continue;

      const bodyName = `${spriteStem}_${genderName}`;
      const outputGarmentDirectory = path.join(
        path.dirname(outputDirectory),
        "jobs",
        jobId,
        gender,
        "garment"
      );
      fs.mkdirSync(outputGarmentDirectory, { recursive: true });
      const jobGarmentViewIds = [];
      let skippedGarments = 0;
      for (const viewId of [...garmentViewIds].sort(
        (left, right) => left - right
      )) {
        const robeName = robeNames.get(viewId);
        if (typeof robeName !== "string") {
          skippedGarments += 1;
          continue;
        }

        const garmentName = robeName.toLowerCase();
        const robeDirectory = path.join(robeRoot, garmentName);
        const classBase = path.join(robeDirectory, genderName, bodyName);
        const genericBase = path.join(robeDirectory, garmentName);
        const actionBase = fs.existsSync(`${classBase}.act`)
          ? classBase
          : genericBase;
        if (!fs.existsSync(`${actionBase}.act`)) {
          skippedGarments += 1;
          continue;
        }
        const actionBuffer = fs.readFileSync(`${actionBase}.act`);
        if (!hasAllSupportedActions(actionBuffer)) {
          skippedGarments += 1;
          continue;
        }

        const spriteCandidates = [
          classBase,
          path.join(
            robeDirectory,
            `${garmentName}${variant.race === "doram" ? "_doram" : ""}`
          ),
          genericBase,
        ];
        const spriteBase = spriteCandidates.find((candidate) =>
          fs.existsSync(`${candidate}.spr`)
        );
        if (!spriteBase) {
          skippedGarments += 1;
          continue;
        }

        fs.copyFileSync(
          `${spriteBase}.spr`,
          path.join(outputGarmentDirectory, `${viewId}.spr`)
        );
        fs.copyFileSync(
          `${actionBase}.act`,
          path.join(outputGarmentDirectory, `${viewId}.act`)
        );
        jobGarmentViewIds.push(viewId);
      }

      const supportedJobGarmentIds = new Set(jobGarmentViewIds);
      for (const filename of fs.readdirSync(outputGarmentDirectory)) {
        const match = /^(\d+)\.(?:spr|act)$/i.exec(filename);
        if (match && !supportedJobGarmentIds.has(Number(match[1]))) {
          fs.rmSync(path.join(outputGarmentDirectory, filename));
        }
      }
      fs.writeFileSync(
        path.join(outputGarmentDirectory, "manifest.json"),
        `${JSON.stringify({ viewIds: jobGarmentViewIds }, null, 2)}\n`
      );
      variant.garmentViewIds = jobGarmentViewIds;
      preparedJobGarments += jobGarmentViewIds.length;
      jobGarmentFallbacks += skippedGarments;
      jobGarmentVariants += 1;
    }
  }
  fs.writeFileSync(
    jobsManifestPath,
    `${JSON.stringify(jobsManifest, null, 2)}\n`
  );

  console.log(
    `Prepared ${supportedViewIds.length} headgear sprite pairs; skipped ` +
      `${missingMetadata} without metadata, ${missingAssets} without a local SPR/ACT pair, ` +
      `and ${incompleteActions} without all supported actions.`
  );
  console.log(
    `Prepared ${supportedGarmentViewIds.length} Novice garment sprite pairs; skipped ` +
      `${missingGarmentMetadata} without metadata, ${missingGarmentAssets} without a local SPR/ACT pair, ` +
      `and ${incompleteGarmentActions} without all supported actions.`
  );
  console.log(
    `Prepared ${preparedJobGarments} job/gender garment sprite pairs across ` +
      `${jobGarmentVariants} available variants; ${jobGarmentFallbacks} ` +
      `job/gender/equipment combinations will use the renderer API.`
  );
}

const [, , resourceRoot, outputDirectory, itemsPath, jobsManifestPath] =
  process.argv;
if (!resourceRoot || !outputDirectory || !itemsPath || !jobsManifestPath) {
  throw new Error(
    "Usage: node prepare-novice-equipment-assets.js <resource-root> <output-directory> <items-json> <jobs-manifest>"
  );
}

prepareNoviceEquipment(resourceRoot, outputDirectory, itemsPath, jobsManifestPath);
