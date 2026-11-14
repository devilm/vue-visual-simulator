<template>
  <div class="effect-headgear-list">
    <div class="slot-tabs" role="group" :aria-label="$t('effectHeadgear')">
      <button
        v-for="slot in slots"
        :key="slot.id"
        type="button"
        class="btn btn-sm"
        :class="activeSlot === slot.id ? 'btn-primary' : 'btn-outline-secondary'"
        :aria-pressed="activeSlot === slot.id"
        @click="activeSlot = slot.id"
      >
        {{ $t(slot.label) }}
      </button>
    </div>

    <ul v-if="filteredItems.length" class="ul-item-list">
      <li v-for="item in filteredItems" :key="item.id" class="li-item">
        <img
          v-lazy="{
            src: `https://static.divine-pride.net/images/items/item/${item.id}.png`,
            delay: 250,
          }"
          class="img-item"
          :class="{ 'item-selected': selectedItem.id === item.id }"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          :title="item.name"
          :alt="item.name"
          role="button"
          :aria-label="item.name"
          :aria-pressed="selectedItem.id === item.id"
          @click="selectItem(item)"
        />
      </li>
    </ul>
    <div v-else class="empty-state">
      {{ $t("noEffectHeadgear") }}
    </div>
  </div>
</template>

<script>
import effectItems from "@/db/effectheadgear.json";

const slots = [
  { id: "top", label: "top" },
  { id: "mid", label: "mid" },
  { id: "bot", label: "bot" },
];

export default {
  name: "EffectHeadgearSelector",
  props: {
    item_filter: {
      type: String,
      default: "",
    },
  },
  data() {
    return {
      activeSlot: "top",
      slots,
      effectItems,
    };
  },
  computed: {
    filteredItems() {
      const query = this.item_filter.trim().toLowerCase();
      return this.effectItems.filter(
        (item) =>
          item[this.activeSlot] === true &&
          item.name.toLowerCase().includes(query)
      );
    },
    selectedItem() {
      const selections = this.$store.state.effect_headgear_items || {};
      return selections[this.activeSlot] || {};
    },
  },
  methods: {
    selectItem(item) {
      if (Number(this.selectedItem.id) === Number(item.id)) {
        this.$store.commit("SAVE_EFFECT_HEADGEAR_ITEM", {
          slot: this.activeSlot,
          item: {},
        });
        return;
      }

      this.$store.commit("SAVE_EFFECT_HEADGEAR_ITEM", {
        slot: this.activeSlot,
        item,
      });
    },
  },
};
</script>

<style scoped>
.effect-headgear-list {
  min-height: 100%;
}

.slot-tabs {
  display: flex;
  gap: 0.35rem;
  padding: 0.4rem 0.75rem 0;
}

.ul-item-list {
  min-height: 54px;
  margin-bottom: 0;
  padding-top: 6px;
  padding-left: 1rem;
  list-style: none;
}

.li-item {
  float: left;
  width: 32px;
  height: 32px;
  background: url("~@/assets/img/interface/item-bg.png");
}

.img-item {
  display: block;
  width: 24px;
  height: 24px;
  margin-right: auto;
  margin-left: auto;
  cursor: pointer;
}

.item-selected {
  outline: 2px dashed #0d6efd;
  border-radius: 5px;
  filter: contrast(105%) brightness(110%);
}

.empty-state {
  padding: 1rem;
  color: #7e7e7e;
  font-size: 0.85rem;
}
</style>
