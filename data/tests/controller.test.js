import * as controller from '../../client/controller.js';

describe('Testing controller.js', () => {
  beforeAll(() => {
    const tdv = canvas.default.createCanvas(1000, 1000);
    const fpv = canvas.default.createCanvas(1000, 1000);
    const indexHtml = String(fs.readFileSync('client/index.html'));
    document.documentElement.innerHTML = indexHtml;
    view.initViewports(tdv, fpv);
  });

  afterAll(async () => {
    await storage.client.end();
  });
});
