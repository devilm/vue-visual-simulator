ไฟล์หลักที่ใช้เทียบคือ 2 ไฟล์นี้ ส่วนอีก 3 ไฟล์ใช้แค่ตรวจดู

ไฟล์หลัก

hateffectinfo.lub: ตาราง hatEffectTable ของ client มี 278 รายการ เก็บค่าที่ผมนำมาใช้ทั้งหมด ได้แก่ resourceFileName (ไฟล์ .str), hatEffectPos (แนวตั้ง), hatEffectPosX (แนวนอน) และ flag isRenderBeforeCharacter (วาดหลังตัวละคร)
itemdbnametbl.lub: ตารางชื่อ DB เป็น item ID (เช่น C_Released_Ground เป็น 410081) ใช้จับคู่ effect กับไอเทมของเรา
ไฟล์ที่ใช้แค่ตรวจดู

effecthatitemtable.lub: รายการ item ID 105 ตัวที่มี effect ใช้เช็คว่า 4 ชิ้นเดิมของเราอยู่ในนั้นไหม (มีแค่ Swirling Flame)
hateffectids.lub: ชื่อ HAT_EF_* เป็นเลข ID
hateffect_f.lub: ฟังก์ชันอ่านค่า เช่น IsRenderBeforeCharacter ใช้ดูความหมายของ flag
ข้อจำกัดของการเทียบ

ไฟล์ทั้งหมดเป็น Lua bytecode (5.1) ในเครื่องไม่มีเครื่องมืออ่านโดยตรง ผมจึงเขียนตัวอ่าน bytecode ชั่วคราวขึ้นมาแล้วลบทิ้งไปแล้ว
ไฟล์ที่เชื่อมไอเทมกับ effect จริงๆ คือ iteminfo ของ client ซึ่งไม่มีในโปรเจกต์ ผมจึงจับคู่จาก ชื่อ: HAT_EF_<ชื่อ> ตรงกับชื่อใน itemdbnametbl.lub วิธีนี้จับคู่ได้ 22 ชิ้น
2 ชิ้นต้องผูกด้วยมือ เพราะชื่อไม่ตรง
Dark Knight Cloak (480783) ผูกกับ HAT_EF_C_Dark_Lord_Cloak ซึ่งเป็นไฟล์ .str เดียวกับที่คุณตั้งไว้ แต่ยืนยันไม่ได้ว่า client ใช้ค่าตำแหน่งของ Dark Lord Cloak จริงหรือไม่
ROS 2026 (480866) ผูกกับ HAT_EF_C_Qualifier26_1st ซึ่งชี้ไปที่ MC1_3.str เดียวกัน
ถ้าอยากให้เป๊ะ 100% ต้องมี iteminfo ของ client ถ้าคุณมีไฟล์นี้ ผมเทียบซ้ำให้ได้

