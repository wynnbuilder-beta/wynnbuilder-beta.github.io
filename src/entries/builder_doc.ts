import './bootstrap';
import { runPageInit } from '@/lib/runPageInit';
import { initBuilderPage } from '@/builder/builder';
import { initRenderComputeGraphPage } from '@/debug/render_compute_graph';

runPageInit(async () => {
  await initBuilderPage();
  await initRenderComputeGraphPage();
});
