<template>
  <main class="container sponsor-page">
    <section class="sponsor-card">
      <h1>Sponsor</h1>
      <p class="sponsor-intro">ข้อมูลสำหรับผู้สนใจลงโฆษณาหรือสนับสนุนเว็บไซต์</p>

      <dl class="sponsor-details">
        <div class="sponsor-detail">
          <dt>เว็บคืออะไร</dt>
          <dd>เว็บแต่งตัว Costume Simulation Ragnarok Online PC</dd>
        </div>
        <div class="sponsor-detail">
          <dt>คนเข้าเท่าไร</dt>
          <dd>300+ Users/Day</dd>
        </div>
        <div class="sponsor-detail">
          <dt>กลุ่มเป้าหมายคือใคร</dt>
          <dd>ผู้เล่นที่เล่น Ragnarok Online PC</dd>
        </div>
        <div class="sponsor-detail">
          <dt>ตำแหน่ง Banner</dt>
          <dd>อยู่ด้านบน ก่อนเข้าใช้งานระบบแต่งตัว</dd>
        </div>
        <div class="sponsor-detail">
          <dt>ช่องทางติดต่อ</dt>
          <dd>
            <a
              href="https://www.facebook.com/emutochannel"
              target="_blank"
              rel="noopener noreferrer"
            >
              Facebook: EmutoChannel
            </a>
          </dd>
        </div>
      </dl>
    </section>
  </main>
</template>

<style scoped>
.sponsor-page {
  min-height: 90vh;
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.sponsor-card {
  max-width: 760px;
  margin: 0 auto;
  padding: clamp(1.25rem, 4vw, 2.5rem);
  border: 1px solid rgba(201, 166, 105, 0.65);
  border-radius: 0.75rem;
  background: rgba(24, 24, 28, 0.9);
  color: #f5ead7;
}

.sponsor-card h1 {
  margin-bottom: 0.5rem;
  color: #f0d6a3;
}

.sponsor-intro {
  margin-bottom: 1.5rem;
}

.sponsor-details {
  margin: 0;
}

.sponsor-detail {
  display: grid;
  grid-template-columns: minmax(150px, 0.8fr) 2fr;
  gap: 0.5rem 1.5rem;
  padding: 1rem 0;
  border-top: 1px solid rgba(201, 166, 105, 0.3);
}

.sponsor-detail dt {
  color: #f0d6a3;
}

.sponsor-detail dd {
  margin: 0;
}

.sponsor-detail a {
  color: #f0d6a3;
  overflow-wrap: anywhere;
}

@media (max-width: 575.98px) {
  .sponsor-detail {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
</style>
