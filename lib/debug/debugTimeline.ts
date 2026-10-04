import { skateboardAnalysis, SKATEBOARD_DURATION_SECONDS } from './skateboardAnalysis';
import { buildTimelineDebugReport } from './timelineDebug';

const durationSeconds = skateboardAnalysis.metadata.durationSeconds ?? SKATEBOARD_DURATION_SECONDS;
console.log(buildTimelineDebugReport(skateboardAnalysis, durationSeconds));
