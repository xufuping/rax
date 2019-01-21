const timeout = 10000;

describe('swiper nested', () => {
  let page;
  beforeAll(async() => {
    page = await global.__BROWSER__.newPage();
    await page.setViewport(global.__VIEWPORT__);
    await page.goto('http://localhost:9002/components/swiper/__tests__/nested.html');
  }, timeout);

  afterAll(async() => {
    await page.close();
  });

  it('should only scroll inner swiper in nested swiper', async() => {
    await page.waitFor(1000);

    // Only inner swiper changed.
    const innerSwiper = await page.$('#innerSwiper');
    const outerSwiper = await page.$('#outerSwiper');
    const innerSwiperBox = await innerSwiper.boundingBox();

    await page.mouse.move(
      innerSwiperBox.x + innerSwiperBox.width / 2,
      innerSwiperBox.y + innerSwiperBox.height / 2
    );

    // Move to center of inner swiper
    await page.mouse.down();
    await page.mouse.move(
      0,
      innerSwiperBox.y + innerSwiperBox.height / 2,
      { steps: 1 }
    );

    // Track to left side, make swiper-item change.
    await page.mouse.up();

    // Wait for animation end.
    await page.waitFor(500);

    const image = await page.screenshot();
    expect(image).toMatchImageSnapshot({
      failureThreshold: '0.01',
      failureThresholdType: 'percent',
    });

    // Only inner swiper moved.
    expect(await page.$eval('#innerSwiper', el => el.current)).toEqual(1);
    expect(await page.$eval('#outerSwiper', el => el.current)).toEqual(0);
  });

  it('should only scroll swiper in nested swiper and scroll-view', async() => {

  });
},
timeout
);


function wait(time) {
  return new Promise((done) => {
    setTimeout(done, time);
  });
}
