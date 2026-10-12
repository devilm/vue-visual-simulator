<template>
    <footer class="site-footer">
        <div class="container">
            <section class="rights-notice" aria-label="Ragnarok Online copyright notice">
                <p class="rights-title">
                    &copy; Gravity Co., Ltd. &amp; Lee MyoungJin(studio DTDS). All rights reserved.
                    สงวนลิขสิทธิ์ทั้งหมด
                </p>
                <p class="rights-description">
                    ลิขสิทธิ์ทรัพย์สินทางปัญญาของเกม Ragnarok Online เป็นของ บริษัทกราวิตี้
                    (Gravity Co., Ltd)
                </p>
            </section>

            <div class="footer-meta">
                <small class="project-credit">&copy; {{ projectName }} 2026</small>
                <nav class="footer-links" aria-label="Project links">
                    <a
                        v-if="projectGit"
                        class="footer-link"
                        :href="projectGit"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Project GitHub"
                    >
                        <i class="fa-brands fa-github" aria-hidden="true"></i>
                    </a>
                    <a
                        v-if="authorGit"
                        class="footer-link"
                        :href="authorGit"
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Author GitHub"
                    >
                        <i class="fa-brands fa-github" aria-hidden="true"></i>
                    </a>
                </nav>
            </div>
        </div>
    </footer>
</template>

<script>
export default {
    name: 'Footer',
    props: ["projectName", "projectGit", "authorGit"],
}
</script>

<style scoped>
.site-footer {
    padding: 1.5rem 0 1rem;
    border-top: 2px solid rgba(201, 166, 105, 0.8);
    background: rgba(24, 24, 28, 0.96);
    color: antiquewhite;
}

.rights-notice {
    max-width: 54rem;
    margin: 0 auto;
    text-align: center;
}

.rights-title {
    margin: 0 0 0.35rem;
    color: #f0d6a3;
    font-size: 0.9rem;
    font-weight: 600;
    line-height: 1.6;
}

.rights-description {
    margin: 0;
    color: rgba(255, 239, 215, 0.76);
    font-size: 0.8rem;
    line-height: 1.6;
}

.footer-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 239, 215, 0.16);
    color: rgba(255, 239, 215, 0.58);
}

.project-credit {
    font-size: 0.75rem;
}

.footer-links {
    display: flex;
    gap: 1rem;
}

.footer-link {
    color: inherit;
    font-size: 1.1rem;
    line-height: 1;
    transition: color 0.15s ease-in-out;
}

.footer-link:hover {
    color: #f0d6a3;
}

@media (max-width: 575.98px) {
    .footer-meta {
        flex-direction: column;
        gap: 0.65rem;
    }
}
</style>
