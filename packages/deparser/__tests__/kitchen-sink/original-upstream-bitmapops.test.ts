
import { FixtureTestUtils } from '../../test-utils';
const fixtures = new FixtureTestUtils();

it('original-upstream-bitmapops', async () => {
  await fixtures.runFixtureTests([
  "original/upstream/bitmapops-1.sql",
  "original/upstream/bitmapops-2.sql",
  "original/upstream/bitmapops-3.sql",
  "original/upstream/bitmapops-4.sql",
  "original/upstream/bitmapops-5.sql",
  "original/upstream/bitmapops-6.sql",
  "original/upstream/bitmapops-7.sql",
  "original/upstream/bitmapops-8.sql",
  "original/upstream/bitmapops-9.sql",
  "original/upstream/bitmapops-10.sql"
]);
});
