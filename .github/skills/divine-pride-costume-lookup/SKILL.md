---
name: divine-pride-costume-lookup
description: Look up Ragnarok Online costume items on Divine Pride and fill their item ID, equipment location, and viewID in src/db/items.json.
---

# Divine Pride Costume Lookup

When the user provides one or more costume names, look up each item on [Divine Pride](https://www.divine-pride.net/) and update or add its entry in `src/db/items.json`, as requested.

## Lookup procedure

1. Search Divine Pride using the costume name provided by the user. Confirm the result is the same item; do not rely on a similar name alone.
2. From the item page, record its item ID.
3. Read the item's `Location` and map each costume equipment location to the existing JSON boolean field:
   - Top Headgear (Costume) → `"top": true`
   - Middle Headgear (Costume) → `"mid": true`
   - Lower Headgear (Costume) → `"bot": true`
   - Garment (Costume) → `"garment": true`
   An item may have more than one applicable location; preserve all applicable flags.
4. In the page's `Preview` section, use the number shown as `Accessory sprite/class ID` for `viewID`. If that label is not present and the page instead shows `Equipment effect: N`, use `N` as `viewID`. Do not confuse either value with the item's item ID.
5. Find the matching object in `src/db/items.json`. If it exists, update its `id`, applicable location flags, and `viewID`, preserving its name and all unrelated properties and formatting. If it does not exist and the user asked to add it, append a new object using the same JSON field conventions. Do not change other entries.

## Accuracy and reporting

- Use the values shown on Divine Pride; never infer an ID, location, or `viewID`, and do not substitute `0` for a value that is missing.
- If no exact match is found, the result is ambiguous, or a required value is unavailable, stop and ask the user how to proceed rather than guessing.
- After making changes, report each costume's item ID, location flag(s), `viewID`, and Divine Pride page link. Clearly identify any item that could not be completed.
