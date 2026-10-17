import { createStore } from "vuex";
import createPersistedState from "vuex-persistedstate";

export default createStore({
  state: {
    character: {
      gender: 1,
      job: ["0"],
      head: 1,
      headPalette: 1,
      headdir: 0,
      headgear: [0, 0, 0],
      garment: 0,
      bodyPalette: 0,
      action: 0,
      canvas: "200x200+100+150",
      outfit: 0,
    },
    headgear_type: {
      isTop: false,
      isMid: false,
      isBot: false,
      isGarment: false,
    },
    headgear_top_item: {},
    headgear_mid_item: {},
    headgear_bottom_item: {},
    garment_item: {},
    cash_mount_checked: 0,
    regular_mount_checked: 0,
  },
  getters: {},
  mutations: {
    SAVE_GENDER(state, gender) {
      state.character.gender = gender;
    },
    SAVE_HAIR_COLOR(state, id) {
      state.character.headPalette = id - 1;
    },
    SAVE_HEAD(state, id) {
      state.character.head = id;
    },
    SAVE_BODY_PALETTE(state, id) {
      state.character.bodyPalette = id;
    },
    SAVE_JOB(state, id) {
      state.character.job[0] = id.toString();
    },
    SAVE_HEADGEAR_TOP(state, viewID) {
      state.character.headgear[1] = viewID;
    },
    SAVE_HEADGEAR_TOP_ITEM(state, item) {
      state.headgear_top_item = item;
    },
    SAVE_HEADGEAR_MID(state, viewID) {
      state.character.headgear[2] = viewID;
    },
    SAVE_HEADGEAR_MID_ITEM(state, item) {

      state.headgear_mid_item = item;
    },
    SAVE_HEADGEAR_BOTTOM(state, viewID) {
      state.character.headgear[0] = viewID;
    },
    SAVE_HEADGEAR_BOTTOM_ITEM(state, item) {
      state.headgear_bottom_item = item;
    },
    SAVE_GARMENT(state, viewID) {
      state.character.garment = viewID;
    },
    SAVE_GARMENT_ITEM(state, item) {
      state.garment_item = item;
    },
    SAVE_CHARACTER_POSITION(state, side) {
      const action = Number(state.character.action);
      const actionBase = Math.floor(action / 8) * 8;
      const direction = action % 8;
      const directionStep = side === "left" ? 1 : -1;
      state.character.action =
        actionBase + (direction + directionStep + 8) % 8;
    },
    SAVE_CHARACTER_HEAD(state, side) {
      const positions = [1, 0, 2];
      let index = positions.indexOf(Number(state.character.headdir));
      if (index < 0) index = 1;
      const direction = side === "right" ? -1 : 1;
      index = Math.max(0, Math.min(positions.length - 1, index + direction));
      state.character.headdir = positions[index];
    },
    SAVE_ACTION(state, id) {
      const direction = Number(state.character.action) % 8;
      state.character.action = Number(id) + direction;
    },
    SAVE_OUTFIT(state, checked) {
      if (checked) {
        state.character.outfit = 1;
      } else {
        state.character.outfit = 0;
      }
    },
    SAVE_CASH_MOUNT(state, checked) {
      if (checked) {
        state.cash_mount_checked = 1;
      } else {
        state.cash_mount_checked = 0;
      }
    },
    SAVE_REGULAR_MOUNT(state, checked) {
      if (checked) {
        state.regular_mount_checked = 1;
      } else {
        state.regular_mount_checked = 0;
      }
    },
    RESET_CHARACTER(state, payload) {
      state.character.gender = 1;
      state.character.job = ["0"];
      state.character.head = 1;
      state.character.headPalette = 1;
      state.character.headgear = [0, 0, 0];
      state.character.garment = 0;
      state.character.bodyPalette = 0;
      state.character.action = 0;
      state.character.outfit = 0;
      state.character.headdir = 0;
    },
    SAVE_CHARACTER(state, character) {
      state.character = character;
    }
  },
  actions: {},
  modules: {},
  plugins: [createPersistedState()],
});
