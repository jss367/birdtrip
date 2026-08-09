const { test, expect } = require("@playwright/test");
const { runAreaSearch, visibleOrder } = require("./helpers");

test("area search renders ranked stops from fixtures", async ({ page }) => {
  await runAreaSearch(page);
  const names = await visibleOrder(page);
  expect(names).toHaveLength(5);
});
