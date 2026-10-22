// Job id -> body sprite resource table.
//
// Every entry points at `data/sprite/<race>/몸통/<gender>/<name>_<gender>.{spr,act}` and the matching
// `data/imf/<name>_<gender>.imf`. Ids follow the client's JT_* identity table (jobidentity.lub), which is
// also what the job list / mount lists in the UI use.
//
//   only  : "m" | "f" - the job only exists for one gender, so that gender is always rendered.
//   imf   : alternative IMF base name(s) when the IMF is spelled differently than the sprite.

export const RACE_HUMAN = "human";
export const RACE_DORAM = "doram";

const human = (name, only, imf) => ({ race: RACE_HUMAN, name, only, imf });
const doram = (name, only, imf) => ({ race: RACE_DORAM, name, only, imf });

const NOVICE = human("초보자");
const SWORDMAN = human("검사");
const MAGICIAN = human("마법사");
const ARCHER = human("궁수");
const ACOLYTE = human("성직자");
const MERCHANT = human("상인");
const THIEF = human("도둑");

const KNIGHT = human("기사");
const PRIEST = human("프리스트");
const WIZARD = human("위저드");
const BLACKSMITH = human("제철공");
const HUNTER = human("헌터");
const ASSASSIN = human("어세신");
const CRUSADER = human("크루세이더");
const MONK = human("몽크");
const SAGE = human("세이지");
const ROGUE = human("로그");
const ALCHEMIST = human("연금술사");
const BARD = human("바드", "m");
const DANCER = human("무희", "f");

const LORD_KNIGHT = human("로드나이트");
const HIGH_PRIEST = human("하이프리");
const HIGH_WIZARD = human("하이위저드");
const WHITESMITH = human("화이트스미스");
const SNIPER = human("스나이퍼");
const ASSASSIN_CROSS = human("어쌔신크로스", undefined, ["어세신크로스", "어쌔신크로스"]);
const PALADIN = human("팔라딘");
const CHAMPION = human("챔피온");
const PROFESSOR = human("프로페서");
const STALKER = human("스토커");
const CREATOR = human("크리에이터");
const CLOWN = human("클라운", "m");
const GYPSY = human("집시", "f");

const PECO_KNIGHT = human("페코페코_기사");
const PECO_CRUSADER = human("신페코크루세이더");
const PECO_LORD_KNIGHT = human("로드페코");
const PECO_PALADIN = human("페코팔라딘");

const RUNE_KNIGHT = human("룬나이트");
const WARLOCK = human("워록");
const RANGER = human("레인져");
const ARCH_BISHOP = human("아크비숍");
const MECHANIC = human("미케닉");
const GUILLOTINE_CROSS = human("길로틴크로스");
const ROYAL_GUARD = human("가드");
const SORCERER = human("소서러");
const MINSTREL = human("민스트럴", "m");
const WANDERER = human("원더러", "f");
const SURA = human("슈라");
const GENETIC = human("제네릭");
const SHADOW_CHASER = human("쉐도우체이서");

const RUNE_DRAGON = human("룬나이트쁘띠");
const GRYPHON_GUARD = human("그리폰가드");
const WARG_RANGER = human("레인져늑대");
const MADOGEAR = human("마도기어");

const SUPER_NOVICE = human("슈퍼노비스");
const GUNSLINGER = human("건너");
const NINJA = human("닌자");
const TAEKWON = human("태권소년");
const STAR_GLADIATOR = human("권성");
const SOUL_LINKER = human("소울링커");

const STAR_EMPEROR = human("성제");
const SOUL_REAPER = human("소울리퍼");

// Costumes.
const WEDDING = human("결혼");
const SANTA = human("산타");
const SUMMER = human("여름");
const SUMMER2 = human("여름2");
const HANBOK = human("한복");
const OKTOBERFEST = human("옥토버패스트");

const JOBS = {
  0: NOVICE,
  1: SWORDMAN,
  2: MAGICIAN,
  3: ARCHER,
  4: ACOLYTE,
  5: MERCHANT,
  6: THIEF,
  7: KNIGHT,
  8: PRIEST,
  9: WIZARD,
  10: BLACKSMITH,
  11: HUNTER,
  12: ASSASSIN,
  13: PECO_KNIGHT,
  14: CRUSADER,
  15: MONK,
  16: SAGE,
  17: ROGUE,
  18: ALCHEMIST,
  19: BARD,
  20: DANCER,
  21: PECO_CRUSADER,
  22: WEDDING,
  23: SUPER_NOVICE,
  24: GUNSLINGER,
  25: NINJA,
  26: SANTA,
  27: SUMMER,
  28: HANBOK,
  29: OKTOBERFEST,
  30: SUMMER2,

  // Transcended first classes.
  4001: NOVICE,
  4002: SWORDMAN,
  4003: MAGICIAN,
  4004: ARCHER,
  4005: ACOLYTE,
  4006: MERCHANT,
  4007: THIEF,

  // Transcended second classes.
  4008: LORD_KNIGHT,
  4009: HIGH_PRIEST,
  4010: HIGH_WIZARD,
  4011: WHITESMITH,
  4012: SNIPER,
  4013: ASSASSIN_CROSS,
  4014: PECO_LORD_KNIGHT,
  4015: PALADIN,
  4016: CHAMPION,
  4017: PROFESSOR,
  4018: STALKER,
  4019: CREATOR,
  4020: CLOWN,
  4021: GYPSY,
  4022: PECO_PALADIN,

  // Taekwon / Star Gladiator / Soul Linker.
  4046: TAEKWON,
  4047: STAR_GLADIATOR,
  4048: human("권성융합"),
  4049: SOUL_LINKER,

  // Third classes (and their transcended forms).
  4054: RUNE_KNIGHT,
  4055: WARLOCK,
  4056: RANGER,
  4057: ARCH_BISHOP,
  4058: MECHANIC,
  4059: GUILLOTINE_CROSS,
  4060: RUNE_KNIGHT,
  4061: WARLOCK,
  4062: RANGER,
  4063: ARCH_BISHOP,
  4064: MECHANIC,
  4065: GUILLOTINE_CROSS,
  4066: ROYAL_GUARD,
  4067: SORCERER,
  4068: MINSTREL,
  4069: WANDERER,
  4070: SURA,
  4071: GENETIC,
  4072: SHADOW_CHASER,
  4073: ROYAL_GUARD,
  4074: SORCERER,
  4075: MINSTREL,
  4076: WANDERER,
  4077: SURA,
  4078: GENETIC,
  4079: SHADOW_CHASER,

  // Third class regular mounts (dragon, gryphon, warg, mado gear).
  4080: RUNE_DRAGON,
  4081: RUNE_DRAGON,
  4082: GRYPHON_GUARD,
  4083: GRYPHON_GUARD,
  4084: WARG_RANGER,
  4085: WARG_RANGER,
  4086: MADOGEAR,
  4087: MADOGEAR,

  // Cash mounts.
  4114: human("두꺼비닌자"),
  4115: human("페코건너"),
  4116: human("페코검사"),
  4117: human("두꺼비소울링커"),
  4118: human("화이트스미스멧돼지"),
  4119: human("상인멧돼지"),
  4120: human("제네릭멧돼지"),
  4121: human("크리에이터멧돼지"),
  4122: human("타조궁수"),
  4123: human("권성포링"),
  4124: human("노비스포링"),
  4125: human("몽크알파카"),
  4126: human("복사알파카"),
  4127: human("슈라알파카"),
  4128: human("슈퍼노비스포링"),
  4129: human("아크비숍알파카"),
  4130: human("여우마법사"),
  4131: human("여우세이지"),
  4132: human("여우소서러"),
  4133: human("여우워록"),
  4134: human("여우위저드"),
  4135: human("여우프로페서"),
  4136: human("여우하이위저드"),
  4137: human("연금술사멧돼지"),
  4138: human("제철공멧돼지"),
  4139: human("챔피온알파카"),
  4140: human("켈베로스길로틴크로스"),
  4141: human("켈베로스도둑"),
  4142: human("켈베로스로그"),
  4143: human("켈베로스쉐도우체이서"),
  4144: human("켈베로스스토커"),
  4145: human("켈베로스어쎄신"),
  4146: human("켈베로스어쎄신크로스"),
  4147: human("타조무희", "f"),
  4148: human("타조민스트럴", "m"),
  4149: human("타조바드", "m"),
  4150: human("타조스나이퍼"),
  4151: human("타조원더러", "f"),
  4152: human("타조짚시", "f"),
  4153: human("타조크라운", "m"),
  4154: human("타조헌터"),
  4155: human("태권소년포링"),
  4156: human("프리스트알파카"),
  4157: human("하이프리스트알파카"),
  4183: human("노비스포링"),
  4184: human("페코검사"),
  4185: human("여우마법사"),
  4186: human("타조궁수"),
  4187: human("복사알파카"),
  4188: human("상인멧돼지"),
  4189: human("켈베로스도둑"),
  4190: SUPER_NOVICE,
  4191: SUPER_NOVICE,
  4192: human("슈퍼노비스포링"),
  4193: human("슈퍼노비스포링"),
  4197: human("미케닉멧돼지"),
  4198: human("타조레인져"),
  4199: human("사자기사"),
  4200: human("사자로드나이트"),
  4201: human("사자로얄가드"),
  4202: human("사자룬나이트"),
  4203: human("사자크루세이더"),
  4204: human("사자팔라딘"),

  // Expanded classes.
  4211: human("kagerou", "m"),
  4212: human("oboro", "f"),
  4213: human("frog_kagerou", "m"),
  4214: human("frog_oboro", "f"),
  4215: human("rebellion"),
  4216: human("peco_rebellion"),
  4218: doram("summoner"),
  4219: doram("cart_summoner"),
  4239: STAR_EMPEROR,
  4240: SOUL_REAPER,
  4243: human("성제융합"),
  4245: human("해태성제"),
  4246: human("해태소울리퍼"),

  // Fourth classes.
  4252: human("dragon_knight"),
  4253: human("meister"),
  4254: human("shadow_cross"),
  4255: human("arch_mage"),
  4256: human("cardinal"),
  4257: human("windhawk"),
  4258: human("imperial_guard"),
  4259: human("biolo"),
  4260: human("abyss_chaser"),
  4261: human("elemetal_master"),
  4262: human("inquisitor"),
  4263: human("troubadour", "m"),
  4264: human("trouvere", "f"),

  // Fourth class cash mounts.
  4265: human("dragon_knight_riding"),
  4266: human("meister_riding"),
  4267: human("shadow_cross_riding"),
  4268: human("arch_mage_riding"),
  4269: human("cardinal_riding"),
  4270: human("windhawk_riding"),
  4271: human("imperial_guard_riding"),
  4272: human("biolo_riding"),
  4273: human("abyss_chaser_riding"),
  4274: human("elemetal_master_riding"),
  4275: human("inquisitor_riding"),
  4276: human("troubadour_riding", "m"),
  4277: human("trouvere_riding", "f"),

  // Fourth class regular mounts.
  4278: human("wolf_windhawk"),
  4279: human("meister_madogear1"),
  4280: human("dragon_knight_chicken"),
  4281: human("imperial_guard_chicken"),

  // Extended fourth classes.
  4302: human("sky_emperor"),
  4303: human("soul_ascetic"),
  4304: human("shinkiro", "m"),
  4305: human("shiranui", "f"),
  4306: human("night_watch"),
  4307: human("hyper_novice"),
  4308: doram("spirit_handler"),
  4309: human("sky_emperor_riding"),
  4310: human("soul_ascetic_riding"),
  4311: human("shinkiro_riding", "m"),
  4312: human("shiranui_riding", "f"),
  4313: human("night_watch_riding"),
  4314: human("hyper_novice_riding"),
  4315: doram("spirit_handler_riding"),
  4316: human("sky_emperor2"),
};

export const DORAM_JOB_IDS = Object.keys(JOBS)
  .map(Number)
  .filter((id) => JOBS[id].race === RACE_DORAM);

export function parseJobId(job) {
  const value = Array.isArray(job) ? job[0] : job;
  const jobId = Number(value);
  return Number.isFinite(jobId) ? jobId : 0;
}

export function isDoramJob(job) {
  return JOBS[parseJobId(job)]?.race === RACE_DORAM;
}

// Returns the sprite resource for a job. Unknown ids fall back to the novice sprite.
// `gender` is "male" | "female"; the result carries the gender that is actually available.
export function resolveJobSprite(job, gender) {
  const requestedId = parseJobId(job);
  const jobId = JOBS[requestedId] ? requestedId : 0;
  const entry = JOBS[jobId];

  let resolvedGender = gender === "male" ? "male" : "female";
  if (entry.only === "m") {
    resolvedGender = "male";
  } else if (entry.only === "f") {
    resolvedGender = "female";
  }

  const imfNames = entry.imf ? [...entry.imf] : [entry.name];

  return {
    jobId,
    race: entry.race,
    name: entry.name,
    imfNames,
    gender: resolvedGender,
  };
}
