const { chromium } = require('playwright');
const path = require('path');

async function checkSlides() {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1123, height: 794 }, // 297mm x 210mm at 96dpi
    });
    const page = await context.newPage();

    const htmlPath = 'file://' + path.resolve(__dirname, 'presentation.html');
    await page.goto(htmlPath);

    const totalSlides = await page.$$eval('.slide', slides => slides.length);
    console.log(`Total slides: ${totalSlides}`);

    const issues = [];

    for (let i = 1; i <= totalSlides; i++) {
        // スライドを表示
        await page.evaluate((slideNum) => {
            const slides = document.querySelectorAll('.slide');
            slides.forEach(s => s.classList.remove('active'));
            slides[slideNum - 1].classList.add('active');
        }, i);

        await page.waitForTimeout(500);

        // スライドのサイズを確認
        const slideInfo = await page.evaluate((slideNum) => {
            const slide = document.querySelectorAll('.slide')[slideNum - 1];
            const rect = slide.getBoundingClientRect();

            // スライド内のすべての要素がはみ出していないか確認
            const children = slide.querySelectorAll('*');
            let hasOverflow = false;
            let overflowElements = [];

            children.forEach(child => {
                const childRect = child.getBoundingClientRect();
                if (childRect.bottom > rect.bottom + 5 || childRect.right > rect.right + 5) {
                    hasOverflow = true;
                    overflowElements.push({
                        tag: child.tagName,
                        class: child.className,
                        bottom: childRect.bottom,
                        right: childRect.right,
                        slideBottom: rect.bottom,
                        slideRight: rect.right,
                        overflow: {
                            bottom: childRect.bottom - rect.bottom,
                            right: childRect.right - rect.right
                        }
                    });
                }
            });

            return {
                slideNumber: slideNum,
                width: rect.width,
                height: rect.height,
                hasOverflow,
                overflowElements
            };
        }, i);

        if (slideInfo.hasOverflow) {
            issues.push(slideInfo);
            console.log(`\n⚠️  スライド ${i} に問題があります:`);
            console.log(`   スライドサイズ: ${slideInfo.width}px x ${slideInfo.height}px`);
            slideInfo.overflowElements.forEach(el => {
                if (el.overflow.bottom > 5) {
                    console.log(`   - ${el.tag} が下方向に ${el.overflow.bottom.toFixed(2)}px はみ出しています`);
                }
                if (el.overflow.right > 5) {
                    console.log(`   - ${el.tag} が右方向に ${el.overflow.right.toFixed(2)}px はみ出しています`);
                }
            });
        } else {
            console.log(`✓ スライド ${i}: OK`);
        }

        // スクリーンショットを保存
        await page.screenshot({
            path: `slide-${i}.png`,
            fullPage: false
        });
    }

    await browser.close();

    console.log('\n====== 確認結果 ======');
    if (issues.length === 0) {
        console.log('✓ すべてのスライドが正常に収まっています');
    } else {
        console.log(`⚠️  ${issues.length}個のスライドに問題があります:`);
        issues.forEach(issue => {
            console.log(`  - スライド ${issue.slideNumber}`);
        });
    }
}

checkSlides().catch(console.error);
